import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@ados/db";
import { validateGitHubToken } from "@ados/agents";
import { resolveProjectRepositories } from "@ados/shared";
import { requireUser } from "../lib/auth";
import { startTicketWorkflow, terminateTicketWorkflow } from "../lib/temporal";

const createTicketSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1),
  body: z.string().default(""),
  priority: z.enum(["P0", "P1", "P2", "P3"]).default("P2"),
  source: z.enum(["manual", "github", "jira"]).default("manual"),
  externalId: z.string().optional(),
});

async function loadProjectRepositories(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { repositories: { orderBy: { sortOrder: "asc" } } },
  });
  if (!project) return [];
  return resolveProjectRepositories({
    repositories: project.repositories,
    repoFullName: project.repoFullName,
    defaultBranch: project.defaultBranch,
  });
}

export async function ticketRoutes(app: FastifyInstance) {
  app.get("/api/tickets", async (request) => {
    const user = await requireUser(request);
    const query = request.query as {
      status?: string;
      priority?: string;
      projectId?: string;
      source?: string;
    };

    const tickets = await prisma.ticket.findMany({
      where: {
        project: { userId: user.id },
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.priority ? { priority: query.priority as never } : {}),
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.source ? { source: query.source as never } : {}),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            repoFullName: true,
            repositories: { orderBy: { sortOrder: "asc" } },
          },
        },
        pullRequests: true,
        workflowRuns: { orderBy: { startedAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });

    return { tickets };
  });

  app.get("/api/tickets/stats", async (request) => {
    const user = await requireUser(request);
    const tickets = await prisma.ticket.findMany({
      where: { project: { userId: user.id } },
      select: { priority: true, status: true },
    });

    const byPriority = { P0: 0, P1: 0, P2: 0, P3: 0 };
    let pending = 0;
    let withDocs = 0;
    for (const t of tickets) {
      byPriority[t.priority] += 1;
      if (!["completed", "failed", "rejected"].includes(t.status)) pending += 1;
      if (["completed", "pr_created", "approved"].includes(t.status)) withDocs += 1;
    }

    return { byPriority, pending, total: tickets.length, withDocs };
  });

  app.get("/api/tickets/:id", async (request, reply) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const ticket = await prisma.ticket.findFirst({
      where: { id, project: { userId: user.id } },
      include: {
        project: { include: { repositories: { orderBy: { sortOrder: "asc" } } } },
        pullRequests: true,
        workflowRuns: {
          orderBy: { startedAt: "desc" },
          include: {
            events: { orderBy: { createdAt: "asc" } },
            artifacts: { orderBy: { createdAt: "asc" } },
            review: true,
          },
        },
      },
    });
    if (!ticket) return reply.status(404).send({ error: "Not found" });
    return { ticket };
  });

  app.post("/api/tickets", async (request) => {
    const user = await requireUser(request);
    const body = createTicketSchema.parse(request.body);
    const project = await prisma.project.findFirst({
      where: { id: body.projectId, userId: user.id },
    });
    if (!project) throw Object.assign(new Error("Project not found"), { statusCode: 404 });

    const ticket = await prisma.ticket.create({
      data: {
        projectId: body.projectId,
        createdById: user.id,
        title: body.title,
        body: body.body,
        priority: body.priority,
        source: body.source,
        externalId: body.externalId,
      },
      include: { project: { include: { repositories: { orderBy: { sortOrder: "asc" } } } } },
    });
    return { ticket };
  });

  app.post("/api/tickets/:id/run", async (request, reply) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };

    const ticket = await prisma.ticket.findFirst({
      where: { id, project: { userId: user.id } },
      include: { project: { include: { repositories: { orderBy: { sortOrder: "asc" } } } } },
    });
    if (!ticket) return reply.status(404).send({ error: "Not found" });

    const repositories = await loadProjectRepositories(ticket.projectId);
    if (repositories.length === 0) {
      return reply.status(400).send({ error: "Project has no connected repositories." });
    }

    if (repositories.some((r) => r.repoFullName === "demo/sample-app")) {
      return reply.status(400).send({
        error: "This ticket uses a demo repository. Create a new ticket with your connected GitHub repo.",
      });
    }

    const integration = await prisma.integration.findUnique({
      where: { userId_type: { userId: user.id, type: "github" } },
    });

    if (!integration?.accessToken) {
      return reply.status(400).send({
        error: "Connect your GitHub account in Settings before running the agent.",
      });
    }

    const tokenCheck = await validateGitHubToken(integration.accessToken);
    if (!tokenCheck.valid) {
      return reply.status(400).send({
        error: tokenCheck.error ?? "Invalid GitHub token. Reconnect GitHub in Settings.",
      });
    }

    const activeRun = await prisma.workflowRun.findFirst({
      where: {
        ticketId: ticket.id,
        status: { in: ["running", "awaiting_plan_approval", "awaiting_approval"] },
      },
    });
    if (activeRun) {
      return reply.status(400).send({ error: "A workflow is already running for this ticket." });
    }

    const run = await prisma.workflowRun.create({
      data: { ticketId: ticket.id, status: "running", currentStep: "starting" },
    });

    const workflowId = `ticket-${ticket.id}-${run.id}`;
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { temporalWorkflowId: workflowId },
    });

    try {
      await startTicketWorkflow({
        workflowId,
        runId: run.id,
        ticketId: ticket.id,
        projectId: ticket.projectId,
        repositories,
        title: ticket.title,
        body: ticket.body,
        githubToken: integration.accessToken,
      });
    } catch (err) {
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: "failed", errorMessage: String(err) },
      });
      throw err;
    }

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "claimed" },
    });

    return { run, workflowId };
  });

  app.post("/api/tickets/:id/revise", async (request, reply) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { prompt?: string };

    if (!body.prompt?.trim()) {
      return reply.status(400).send({ error: "Describe what you want changed in the plan or code." });
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id, project: { userId: user.id } },
      include: { project: { include: { repositories: { orderBy: { sortOrder: "asc" } } } }, pullRequests: true },
    });
    if (!ticket) return reply.status(404).send({ error: "Not found" });

    if (!["completed", "pr_created"].includes(ticket.status)) {
      return reply.status(400).send({
        error: "Revisions are available after a PR has been created and the ticket is completed.",
      });
    }
    if (ticket.pullRequests.length === 0) {
      return reply.status(400).send({ error: "No pull request found for this ticket." });
    }

    const repositories = await loadProjectRepositories(ticket.projectId);

    const integration = await prisma.integration.findUnique({
      where: { userId_type: { userId: user.id, type: "github" } },
    });
    if (!integration?.accessToken) {
      return reply.status(400).send({ error: "Connect your GitHub account in Settings before revising." });
    }

    const tokenCheck = await validateGitHubToken(integration.accessToken);
    if (!tokenCheck.valid) {
      return reply.status(400).send({
        error: tokenCheck.error ?? "Invalid GitHub token. Reconnect GitHub in Settings.",
      });
    }

    const activeRun = await prisma.workflowRun.findFirst({
      where: {
        ticketId: ticket.id,
        status: { in: ["running", "awaiting_plan_approval", "awaiting_approval"] },
      },
    });
    if (activeRun) {
      return reply.status(400).send({ error: "A workflow is already running for this ticket." });
    }

    const run = await prisma.workflowRun.create({
      data: { ticketId: ticket.id, status: "running", currentStep: "revision_starting" },
    });

    const workflowId = `ticket-${ticket.id}-revision-${run.id}`;
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { temporalWorkflowId: workflowId },
    });

    try {
      await startTicketWorkflow({
        workflowId,
        runId: run.id,
        ticketId: ticket.id,
        projectId: ticket.projectId,
        repositories,
        title: ticket.title,
        body: ticket.body,
        githubToken: integration.accessToken,
        mode: "revision",
        revisionPrompt: body.prompt.trim(),
      });
    } catch (err) {
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: "failed", errorMessage: String(err) },
      });
      throw err;
    }

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "claimed" },
    });

    return { run, workflowId };
  });

  app.post("/api/tickets/:id/cancel", async (request, reply) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };

    const ticket = await prisma.ticket.findFirst({
      where: { id, project: { userId: user.id } },
    });
    if (!ticket) return reply.status(404).send({ error: "Not found" });

    const activeRun = await prisma.workflowRun.findFirst({
      where: {
        ticketId: ticket.id,
        status: { in: ["running", "awaiting_plan_approval", "awaiting_approval"] },
      },
    });
    if (!activeRun) {
      return reply.status(400).send({ error: "No active workflow to cancel." });
    }

    if (activeRun.temporalWorkflowId) {
      try {
        await terminateTicketWorkflow(activeRun.temporalWorkflowId);
      } catch {
        // Workflow may already be finished on Temporal side
      }
    }

    await prisma.workflowRun.update({
      where: { id: activeRun.id },
      data: {
        status: "failed",
        currentStep: "cancelled",
        errorMessage: "Cancelled by user",
        completedAt: new Date(),
      },
    });
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "failed" },
    });

    return { ok: true };
  });

  app.get("/api/plan-queue", async (request) => {
    const user = await requireUser(request);
    const runs = await prisma.workflowRun.findMany({
      where: {
        status: "awaiting_plan_approval",
        ticket: { project: { userId: user.id } },
      },
      include: {
        ticket: { include: { project: true } },
        artifacts: { where: { type: { in: ["plan", "detailed-plan"] } } },
      },
      orderBy: { startedAt: "desc" },
    });
    return { runs };
  });

  app.post("/api/plan-queue/:runId/approve", async (request, reply) => {
    const user = await requireUser(request);
    const { runId } = request.params as { runId: string };
    const body = (request.body ?? {}) as { notes?: string };

    const run = await prisma.workflowRun.findFirst({
      where: {
        id: runId,
        status: "awaiting_plan_approval",
        ticket: { project: { userId: user.id } },
      },
    });
    if (!run?.temporalWorkflowId) {
      return reply.status(404).send({ error: "Run not found or not awaiting plan approval" });
    }

    const { signalApprovePlan } = await import("../lib/temporal");
    await signalApprovePlan(run.temporalWorkflowId, {
      reviewerId: user.id,
      notes: body.notes,
    });

    return { ok: true };
  });

  app.post("/api/plan-queue/:runId/reject", async (request, reply) => {
    const user = await requireUser(request);
    const { runId } = request.params as { runId: string };
    const body = (request.body ?? {}) as { notes?: string };

    const run = await prisma.workflowRun.findFirst({
      where: {
        id: runId,
        status: "awaiting_plan_approval",
        ticket: { project: { userId: user.id } },
      },
    });
    if (!run?.temporalWorkflowId) {
      return reply.status(404).send({ error: "Run not found or not awaiting plan approval" });
    }

    const { signalRejectPlan } = await import("../lib/temporal");
    await signalRejectPlan(run.temporalWorkflowId, {
      reviewerId: user.id,
      notes: body.notes,
    });

    return { ok: true };
  });

  app.post("/api/plan-queue/:runId/revise", async (request, reply) => {
    const user = await requireUser(request);
    const { runId } = request.params as { runId: string };
    const body = (request.body ?? {}) as { prompt?: string };

    if (!body.prompt?.trim()) {
      return reply.status(400).send({ error: "Revision prompt is required." });
    }

    const run = await prisma.workflowRun.findFirst({
      where: {
        id: runId,
        status: "awaiting_plan_approval",
        ticket: { project: { userId: user.id } },
      },
    });
    if (!run?.temporalWorkflowId) {
      return reply.status(404).send({ error: "Run not found or not awaiting plan approval" });
    }

    const { signalRevisePlan } = await import("../lib/temporal");
    await signalRevisePlan(run.temporalWorkflowId, {
      reviewerId: user.id,
      prompt: body.prompt.trim(),
    });

    return { ok: true };
  });

  app.get("/api/review-queue", async (request) => {
    const user = await requireUser(request);
    const runs = await prisma.workflowRun.findMany({
      where: {
        status: "awaiting_approval",
        ticket: { project: { userId: user.id } },
      },
      include: {
        ticket: { include: { project: true } },
        artifacts: { where: { type: { in: ["plan", "change-summary", "detailed-plan"] } } },
      },
      orderBy: { startedAt: "desc" },
    });
    return { runs };
  });

  app.post("/api/review-queue/:runId/approve", async (request, reply) => {
    const user = await requireUser(request);
    const { runId } = request.params as { runId: string };
    const body = (request.body ?? {}) as { notes?: string };

    const run = await prisma.workflowRun.findFirst({
      where: {
        id: runId,
        status: "awaiting_approval",
        ticket: { project: { userId: user.id } },
      },
    });
    if (!run?.temporalWorkflowId) {
      return reply.status(404).send({ error: "Run not found or not awaiting approval" });
    }

    const { signalApproveReview } = await import("../lib/temporal");
    await signalApproveReview(run.temporalWorkflowId, {
      reviewerId: user.id,
      notes: body.notes,
    });

    await prisma.reviewDecision.upsert({
      where: { runId },
      update: { approved: true, reviewerId: user.id, notes: body.notes },
      create: { runId, approved: true, reviewerId: user.id, notes: body.notes },
    });

    return { ok: true };
  });

  app.post("/api/review-queue/:runId/reject", async (request, reply) => {
    const user = await requireUser(request);
    const { runId } = request.params as { runId: string };
    const body = (request.body ?? {}) as { notes?: string };

    const run = await prisma.workflowRun.findFirst({
      where: {
        id: runId,
        status: "awaiting_approval",
        ticket: { project: { userId: user.id } },
      },
    });
    if (!run?.temporalWorkflowId) {
      return reply.status(404).send({ error: "Run not found or not awaiting approval" });
    }

    const { signalRejectReview } = await import("../lib/temporal");
    await signalRejectReview(run.temporalWorkflowId, {
      reviewerId: user.id,
      notes: body.notes,
    });

    await prisma.reviewDecision.upsert({
      where: { runId },
      update: { approved: false, reviewerId: user.id, notes: body.notes },
      create: { runId, approved: false, reviewerId: user.id, notes: body.notes },
    });

    return { ok: true };
  });
}
