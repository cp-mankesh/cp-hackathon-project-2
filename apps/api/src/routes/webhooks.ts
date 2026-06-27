import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@ados/db";
import { requireUser } from "../lib/auth";

export async function webhookRoutes(app: FastifyInstance) {
  app.post("/api/webhooks/github", async (request) => {
    const event = request.headers["x-github-event"] as string;
    const payload = request.body as {
      action?: string;
      issue?: {
        id: number;
        number: number;
        title: string;
        body?: string;
        html_url: string;
      };
      repository?: { full_name: string; default_branch: string };
    };

    if (event === "issues" && payload.action === "opened" && payload.issue && payload.repository) {
      const project = await prisma.project.findFirst({
        where: { repoFullName: payload.repository.full_name },
      });
      if (project) {
        await prisma.ticket.create({
          data: {
            projectId: project.id,
            source: "github",
            externalId: String(payload.issue.number),
            title: payload.issue.title,
            body: payload.issue.body ?? "",
            priority: "P2",
          },
        });
      }
    }

    return { ok: true };
  });

  app.post("/api/webhooks/jira", async (request) => {
    const payload = request.body as {
      issue?: {
        key: string;
        fields?: { summary?: string; description?: string; priority?: { name?: string } };
      };
      projectKey?: string;
    };

    if (payload.issue) {
      const project = await prisma.project.findFirst({
        where: { name: payload.projectKey ?? "" },
      });
      if (project) {
        const priorityMap: Record<string, "P0" | "P1" | "P2" | "P3"> = {
          Highest: "P0",
          High: "P1",
          Medium: "P2",
          Low: "P3",
        };
        const pName = payload.issue.fields?.priority?.name ?? "Medium";
        await prisma.ticket.create({
          data: {
            projectId: project.id,
            source: "jira",
            externalId: payload.issue.key,
            title: payload.issue.fields?.summary ?? payload.issue.key,
            body: typeof payload.issue.fields?.description === "string"
              ? payload.issue.fields.description
              : "",
            priority: priorityMap[pName] ?? "P2",
          },
        });
      }
    }

    return { ok: true };
  });

  app.get("/api/auth/jira", async (request, reply) => {
    const clientId = process.env.JIRA_CLIENT_ID;
    if (!clientId) {
      return reply.status(503).send({ error: "Jira OAuth not configured" });
    }
    const state = crypto.randomUUID();
    reply.setCookie("jira_oauth_state", state, { path: "/", httpOnly: true, maxAge: 600 });
    const params = new URLSearchParams({
      audience: "api.atlassian.com",
      client_id: clientId,
      scope: "read:jira-work write:jira-work offline_access",
      redirect_uri: process.env.JIRA_CALLBACK_URL ?? "http://localhost:4000/api/auth/jira/callback",
      state,
      response_type: "code",
      prompt: "consent",
    });
    return reply.redirect(`https://auth.atlassian.com/authorize?${params}`);
  });

  app.get("/api/auth/jira/callback", async (request, reply) => {
    const user = await requireUser(request).catch(() => null);
    if (!user) {
      return reply.redirect(`${process.env.WEB_URL}/login?error=jira_auth`);
    }

    const query = request.query as { code?: string; state?: string };
    const savedState = request.cookies.jira_oauth_state;
    if (!query.code || query.state !== savedState) {
      return reply.redirect(`${process.env.WEB_URL}/admin/settings?error=jira`);
    }

    const tokenRes = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
        code: query.code,
        redirect_uri: process.env.JIRA_CALLBACK_URL,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; refresh_token?: string };
    if (tokenData.access_token) {
      await prisma.integration.upsert({
        where: { userId_type: { userId: user.id, type: "jira" } },
        update: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
        },
        create: {
          userId: user.id,
          type: "jira",
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
        },
      });
    }

    reply.clearCookie("jira_oauth_state", { path: "/" });
    return reply.redirect(`${process.env.WEB_URL}/admin/settings?jira=connected`);
  });

  app.get("/api/integrations", async (request) => {
    const user = await requireUser(request);
    const integrations = await prisma.integration.findMany({
      where: { userId: user.id },
      select: { type: true, createdAt: true, updatedAt: true },
    });
    return { integrations };
  });

  app.delete("/api/integrations/:type", async (request, reply) => {
    const user = await requireUser(request);
    const { type } = request.params as { type: string };

    if (type !== "github" && type !== "jira") {
      return reply.status(400).send({ error: "Invalid integration type" });
    }

    const result = await prisma.integration.deleteMany({
      where: { userId: user.id, type },
    });

    if (result.count === 0) {
      return reply.status(404).send({ error: "Integration not connected" });
    }

    return { ok: true };
  });

  app.get("/api/monitor/llm", async (request) => {
    const user = await requireUser(request);
    const runs = await prisma.workflowRun.findMany({
      where: { ticket: { project: { userId: user.id } } },
      include: { artifacts: true },
      orderBy: { startedAt: "desc" },
      take: 50,
    });

    const stats = runs.map((run) => ({
      runId: run.id,
      ticketId: run.ticketId,
      status: run.status,
      artifactCount: run.artifacts.length,
      startedAt: run.startedAt,
      estimatedTokens: run.artifacts.reduce((sum, a) => sum + Math.ceil(a.content.length / 4), 0),
    }));

    const totalTokens = stats.reduce((s, r) => s + r.estimatedTokens, 0);
    return { stats, totalTokens, estimatedCostUsd: (totalTokens / 1_000_000) * 0.15 };
  });
}

const importJiraSchema = z.object({
  projectId: z.string(),
  jiraProjectKey: z.string(),
  jiraSiteUrl: z.string().url(),
});

export async function jiraRoutes(app: FastifyInstance) {
  app.post("/api/jira/import", async (request, reply) => {
    const user = await requireUser(request);
    const body = importJiraSchema.parse(request.body);

    const integration = await prisma.integration.findUnique({
      where: { userId_type: { userId: user.id, type: "jira" } },
    });
    if (!integration) {
      return reply.status(400).send({ error: "Connect Jira first" });
    }

    const project = await prisma.project.findFirst({
      where: { id: body.projectId, userId: user.id },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const res = await fetch(
      `${body.jiraSiteUrl}/rest/api/3/search?jql=project=${body.jiraProjectKey}&maxResults=50`,
      {
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      return reply.status(res.status).send({ error: "Failed to fetch Jira issues" });
    }

    const data = (await res.json()) as {
      issues: Array<{
        key: string;
        fields: { summary: string; description?: unknown; priority?: { name?: string } };
      }>;
    };

    const created = [];
    for (const issue of data.issues) {
      const existing = await prisma.ticket.findFirst({
        where: { projectId: project.id, source: "jira", externalId: issue.key },
      });
      const ticket = existing
        ? await prisma.ticket.update({
            where: { id: existing.id },
            data: { title: issue.fields.summary },
          })
        : await prisma.ticket.create({
            data: {
              projectId: project.id,
              source: "jira",
              externalId: issue.key,
              title: issue.fields.summary,
              body:
                typeof issue.fields.description === "string" ? issue.fields.description : "",
              priority: "P2",
            },
          });
      created.push(ticket);
    }

    return { imported: created.length, tickets: created };
  });
}
