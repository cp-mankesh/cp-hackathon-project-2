import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { prisma } from "@ados/db";
import { buildApp } from "../app";
import { SESSION_COOKIE } from "../lib/auth";

vi.mock("../lib/temporal", () => ({
  startTicketWorkflow: vi.fn().mockResolvedValue("test-workflow-id"),
  signalApproveReview: vi.fn().mockResolvedValue(undefined),
  signalRejectReview: vi.fn().mockResolvedValue(undefined),
  signalApprovePlan: vi.fn().mockResolvedValue(undefined),
  signalRejectPlan: vi.fn().mockResolvedValue(undefined),
  signalRevisePlan: vi.fn().mockResolvedValue(undefined),
  terminateTicketWorkflow: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@ados/agents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ados/agents")>();
  return {
    ...actual,
    validateGitHubToken: vi.fn().mockResolvedValue({ valid: true, login: "test-user" }),
  };
});

const TEST_EMAIL = `test-${Date.now()}@ados.test`;

describe("API integration", () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  let userId: string;
  let projectId: string;
  let ticketId: string;

  beforeAll(async () => {
    app = await buildApp();

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/dev-login",
    });
    expect(login.statusCode).toBe(200);
    const setCookie = login.cookies.find((c) => c.name === SESSION_COOKIE);
    expect(setCookie?.value).toBeTruthy();
    sessionCookie = `${SESSION_COOKIE}=${setCookie!.value}`;

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: sessionCookie },
    });
    const meBody = me.json<{ user: { id: string } }>();
    userId = meBody.user.id;

    const repoName = `test-org/test-repo-${Date.now()}`;
    const project = await prisma.project.create({
      data: {
        userId,
        name: "Test Project",
        repoFullName: repoName,
        defaultBranch: "main",
        repositories: {
          create: {
            repoFullName: repoName,
            defaultBranch: "main",
            sortOrder: 0,
          },
        },
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    if (ticketId) {
      await prisma.workflowRun.deleteMany({ where: { ticketId } });
      await prisma.ticket.deleteMany({ where: { id: ticketId } });
    }
    if (projectId) {
      await prisma.project.deleteMany({ where: { id: projectId } });
    }
    await app.close();
  });

  it("GET /api/health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", service: "ados-api" });
  });

  it("GET /api/auth/me requires session", async () => {
    const unauthorized = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(unauthorized.statusCode).toBe(401);

    const authorized = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: sessionCookie },
    });
    expect(authorized.statusCode).toBe(200);
    expect(authorized.json<{ user: { email: string } }>().user.email).toBeTruthy();
  });

  it("GET /api/projects returns user projects", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/projects",
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ projects: Array<{ id: string }> }>();
    expect(body.projects.some((p) => p.id === projectId)).toBe(true);
  });

  it("GET /api/projects/public works without auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/projects/public" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("projects");
  });

  it("POST /api/tickets creates manual ticket", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: { cookie: sessionCookie, "content-type": "application/json" },
      payload: {
        projectId,
        title: "Unit test ticket",
        body: "Created by vitest",
        priority: "P1",
        source: "manual",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ ticket: { id: string; title: string; status: string } }>();
    ticketId = body.ticket.id;
    expect(body.ticket.title).toBe("Unit test ticket");
    expect(body.ticket.status).toBe("pending");
  });

  it("GET /api/tickets/stats returns priority breakdown", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tickets/stats",
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ byPriority: Record<string, number>; total: number }>();
    expect(body.byPriority).toHaveProperty("P0");
    expect(body.total).toBeGreaterThan(0);
  });

  it("GET /api/tickets/:id returns ticket detail", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/tickets/${ticketId}`,
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ ticket: { id: string } }>().ticket.id).toBe(ticketId);
  });

  it("POST /api/tickets/:id/run starts workflow", async () => {
    await prisma.integration.upsert({
      where: { userId_type: { userId, type: "github" } },
      update: { accessToken: "test-token" },
      create: { userId, type: "github", accessToken: "test-token" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/tickets/${ticketId}/run`,
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ workflowId: string; run: { id: string } }>();
    expect(body.workflowId).toContain(ticketId);
    expect(body.run.id).toBeTruthy();
  });

  it("POST /api/webhooks/github creates ticket from issue event", async () => {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    const res = await app.inject({
      method: "POST",
      url: "/api/webhooks/github",
      headers: { "x-github-event": "issues", "content-type": "application/json" },
      payload: {
        action: "opened",
        issue: { id: 1, number: 99, title: "Webhook issue", body: "From github" },
        repository: {
          full_name: project!.repoFullName,
          default_branch: "main",
        },
      },
    });
    expect(res.statusCode).toBe(200);

    const created = await prisma.ticket.findFirst({
      where: { projectId, externalId: "99", source: "github" },
    });
    expect(created?.title).toBe("Webhook issue");
    if (created) {
      await prisma.ticket.delete({ where: { id: created.id } });
    }
  });

  it("POST /api/webhooks/jira creates ticket from webhook", async () => {
    await prisma.project.update({
      where: { id: projectId },
      data: { name: "TESTPROJ" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/webhooks/jira",
      headers: { "content-type": "application/json" },
      payload: {
        projectKey: "TESTPROJ",
        issue: {
          key: "TEST-1",
          fields: { summary: "Jira issue", description: "From jira", priority: { name: "High" } },
        },
      },
    });
    expect(res.statusCode).toBe(200);

    const created = await prisma.ticket.findFirst({
      where: { projectId, externalId: "TEST-1", source: "jira" },
    });
    expect(created?.title).toBe("Jira issue");
    if (created) {
      await prisma.ticket.delete({ where: { id: created.id } });
    }
  });

  it("GET /api/integrations returns connected integrations", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/integrations",
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("integrations");
  });

  it("DELETE /api/integrations/:type disconnects integration", async () => {
    await prisma.integration.upsert({
      where: { userId_type: { userId, type: "github" } },
      update: { accessToken: "test-token" },
      create: { userId, type: "github", accessToken: "test-token" },
    });

    const res = await app.inject({
      method: "DELETE",
      url: "/api/integrations/github",
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const remaining = await prisma.integration.findUnique({
      where: { userId_type: { userId, type: "github" } },
    });
    expect(remaining).toBeNull();
  });

  it("POST /api/github/sync imports issues from GitHub repos", async () => {
    await prisma.integration.upsert({
      where: { userId_type: { userId, type: "github" } },
      update: { accessToken: "test-token" },
      create: { userId, type: "github", accessToken: "test-token" },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          number: 42,
          title: "Sync test issue",
          body: "From GitHub",
          html_url: "https://github.com/test-org/test-repo/issues/42",
          state: "open",
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.inject({
      method: "POST",
      url: "/api/github/sync",
      headers: { cookie: sessionCookie, "content-type": "application/json" },
      payload: { projectId },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ created: number; imported: number }>();
    expect(body.created).toBeGreaterThan(0);
    expect(body.imported).toBeGreaterThan(0);

    const ticket = await prisma.ticket.findFirst({
      where: { projectId, source: "github", externalId: "42" },
    });
    expect(ticket?.title).toBe("Sync test issue");

    vi.unstubAllGlobals();
    if (ticket) {
      await prisma.ticket.delete({ where: { id: ticket.id } });
    }
  });

  it("POST /api/github/import imports a single issue", async () => {
    await prisma.integration.upsert({
      where: { userId_type: { userId, type: "github" } },
      update: { accessToken: "test-token" },
      create: { userId, type: "github", accessToken: "test-token" },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        number: 7,
        title: "Single import issue",
        body: "One issue only",
        html_url: "https://github.com/test-org/test-repo/issues/7",
        state: "open",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const repoFullName = project.repoFullName!;

    const res = await app.inject({
      method: "POST",
      url: "/api/github/import",
      headers: { cookie: sessionCookie, "content-type": "application/json" },
      payload: { projectId, repoFullName, number: 7 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ created: boolean; ticket: { title: string } }>();
    expect(body.created).toBe(true);
    expect(body.ticket.title).toBe("Single import issue");

    vi.unstubAllGlobals();
    const ticket = await prisma.ticket.findFirst({
      where: { projectId, source: "github", externalId: "7" },
    });
    if (ticket) {
      await prisma.ticket.delete({ where: { id: ticket.id } });
    }
  });

  it("GET /api/monitor/llm returns usage stats", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/monitor/llm",
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ totalTokens: number; stats: unknown[] }>();
    expect(typeof body.totalTokens).toBe("number");
    expect(Array.isArray(body.stats)).toBe(true);
  });

  it("POST /api/auth/logout clears session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: sessionCookie },
    });
    expect(me.statusCode).toBe(401);
  });
});

describe("Review queue API", () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  let runId: string;
  let ticketId: string;
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    app = await buildApp();

    const login = await app.inject({ method: "POST", url: "/api/auth/dev-login" });
    const setCookie = login.cookies.find((c) => c.name === SESSION_COOKIE);
    sessionCookie = `${SESSION_COOKIE}=${setCookie!.value}`;
    userId = login.json<{ user: { id: string } }>().user.id;

    const repoName = `review-test/${Date.now()}`;
    const project = await prisma.project.create({
      data: {
        userId,
        name: "Review Test",
        repoFullName: repoName,
        repositories: {
          create: {
            repoFullName: repoName,
            defaultBranch: "main",
            sortOrder: 0,
          },
        },
      },
    });
    projectId = project.id;

    const ticket = await prisma.ticket.create({
      data: {
        projectId,
        source: "manual",
        title: "Review queue test",
        status: "awaiting_human_review",
      },
    });
    ticketId = ticket.id;

    const run = await prisma.workflowRun.create({
      data: {
        ticketId,
        status: "awaiting_approval",
        currentStep: "human_review",
        temporalWorkflowId: `ticket-${ticketId}-review-test`,
      },
    });
    runId = run.id;
  });

  afterAll(async () => {
    await prisma.reviewDecision.deleteMany({ where: { runId } });
    await prisma.workflowRun.deleteMany({ where: { id: runId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await app.close();
  });

  it("GET /api/review-queue lists awaiting runs", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/review-queue",
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ runs: Array<{ id: string }> }>();
    expect(body.runs.some((r) => r.id === runId)).toBe(true);
  });

  it("POST /api/review-queue/:runId/reject signals workflow", async () => {
    const rejectRun = await prisma.workflowRun.create({
      data: {
        ticketId,
        status: "awaiting_approval",
        currentStep: "human_review",
        temporalWorkflowId: `ticket-${ticketId}-reject-test`,
      },
    });

    const { signalRejectReview } = await import("../lib/temporal");
    const res = await app.inject({
      method: "POST",
      url: `/api/review-queue/${rejectRun.id}/reject`,
      headers: { cookie: sessionCookie, "content-type": "application/json" },
      payload: { notes: "Needs more work" },
    });
    expect(res.statusCode).toBe(200);
    expect(signalRejectReview).toHaveBeenCalled();

    await prisma.reviewDecision.deleteMany({ where: { runId: rejectRun.id } });
    await prisma.workflowRun.delete({ where: { id: rejectRun.id } });
  });

  it("POST /api/review-queue/:runId/approve signals workflow", async () => {
    const { signalApproveReview } = await import("../lib/temporal");
    const res = await app.inject({
      method: "POST",
      url: `/api/review-queue/${runId}/approve`,
      headers: { cookie: sessionCookie, "content-type": "application/json" },
      payload: { notes: "Looks good" },
    });
    expect(res.statusCode).toBe(200);
    expect(signalApproveReview).toHaveBeenCalled();
  });

  it("POST /api/review-queue/:runId/reject returns 404 when not awaiting", async () => {
    const completedRun = await prisma.workflowRun.create({
      data: {
        ticketId,
        status: "completed",
        currentStep: "done",
        temporalWorkflowId: `ticket-${ticketId}-completed`,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/review-queue/${completedRun.id}/reject`,
      headers: { cookie: sessionCookie, "content-type": "application/json" },
      payload: { notes: "Too late" },
    });
    expect(res.statusCode).toBe(404);

    await prisma.workflowRun.delete({ where: { id: completedRun.id } });
  });
});
