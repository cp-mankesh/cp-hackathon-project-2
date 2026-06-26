import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@ados/db";
import { createSession, getUserFromSession, getSessionToken, requireUser, SESSION_COOKIE } from "../lib/auth";

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API = "https://api.github.com";

export async function authRoutes(app: FastifyInstance) {
  app.get("/api/auth/me", async (request, reply) => {
    const user = await getUserFromSession(getSessionToken(request));
    if (!user) return reply.status(401).send({ error: "Not authenticated" });
    return { user };
  });

  app.get("/api/auth/github", async (request, reply) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return reply.status(503).send({ error: "GitHub OAuth not configured. Set GITHUB_CLIENT_ID." });
    }
    const state = crypto.randomUUID();
    reply.setCookie("oauth_state", state, { path: "/", httpOnly: true, maxAge: 600 });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: process.env.GITHUB_CALLBACK_URL ?? "http://localhost:4000/api/auth/github/callback",
      scope: "read:user user:email repo",
      state,
    });
    return reply.redirect(`${GITHUB_AUTH_URL}?${params}`);
  });

  app.get("/api/auth/github/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string };
    const savedState = request.cookies.oauth_state;
    if (!query.code || !query.state || query.state !== savedState) {
      return reply.redirect(`${process.env.WEB_URL}/login?error=oauth_state`);
    }

    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: query.code,
        redirect_uri: process.env.GITHUB_CALLBACK_URL,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      return reply.redirect(`${process.env.WEB_URL}/login?error=token`);
    }

    const userRes = await fetch(`${GITHUB_API}/user`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json" },
    });
    const ghUser = (await userRes.json()) as {
      id: number;
      login: string;
      name?: string;
      avatar_url?: string;
      email?: string;
    };

    const email = ghUser.email ?? `${ghUser.login}@users.noreply.github.com`;
    const user = await prisma.user.upsert({
      where: { githubId: String(ghUser.id) },
      update: {
        name: ghUser.name ?? ghUser.login,
        avatarUrl: ghUser.avatar_url,
        email,
      },
      create: {
        githubId: String(ghUser.id),
        email,
        name: ghUser.name ?? ghUser.login,
        avatarUrl: ghUser.avatar_url,
        role: "developer",
      },
    });

    await prisma.integration.upsert({
      where: { userId_type: { userId: user.id, type: "github" } },
      update: { accessToken: tokenData.access_token },
      create: { userId: user.id, type: "github", accessToken: tokenData.access_token },
    });

    const sessionToken = await createSession(user.id);
    reply
      .clearCookie("oauth_state", { path: "/" })
      .setCookie(SESSION_COOKIE, sessionToken, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60,
      });
    return reply.redirect(`${process.env.WEB_URL}/admin`);
  });

  app.post("/api/auth/dev-login", async (request, reply) => {
    if (process.env.NODE_ENV === "production") {
      return reply.status(403).send({ error: "Not available in production" });
    }
    const user = await prisma.user.upsert({
      where: { email: "admin@ados.local" },
      update: {},
      create: { email: "admin@ados.local", name: "Admin", role: "super_admin" },
    });
    const sessionToken = await createSession(user.id);
    reply.setCookie(SESSION_COOKIE, sessionToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
    });
    return { user };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const token = getSessionToken(request);
    if (token) {
      await prisma.session.deleteMany({ where: { token } });
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });
}

export async function projectRoutes(app: FastifyInstance) {
  app.get("/api/projects", async (request) => {
    const user = await requireUser(request);
    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      include: {
        repositories: { orderBy: { sortOrder: "asc" } },
        _count: { select: { tickets: true } },
        tickets: {
          where: { status: { notIn: ["completed", "failed", "rejected"] } },
          select: { id: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return {
      projects: projects.map((p) => ({
        ...p,
        openTickets: p.tickets.length,
        ticketCount: p._count.tickets,
      })),
    };
  });

  app.get("/api/projects/public", async () => {
    const projects = await prisma.project.findMany({
      where: { isConnected: true },
      include: {
        repositories: { orderBy: { sortOrder: "asc" } },
        _count: { select: { tickets: true } },
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
    });
    return { projects };
  });

  app.get("/api/github/repos", async (request, reply) => {
    const user = await requireUser(request);
    const integration = await prisma.integration.findUnique({
      where: { userId_type: { userId: user.id, type: "github" } },
    });
    if (!integration) {
      return reply.status(400).send({ error: "Connect GitHub first" });
    }

    const res = await fetch(`${GITHUB_API}/user/repos?per_page=100&sort=updated`, {
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) {
      return reply.status(res.status).send({ error: "Failed to fetch repos" });
    }
    const repos = (await res.json()) as Array<{
      id: number;
      full_name: string;
      name: string;
      default_branch: string;
      description: string | null;
      private: boolean;
    }>;
    return {
      repos: repos.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        name: r.name,
        defaultBranch: r.default_branch,
        description: r.description,
        private: r.private,
      })),
    };
  });

  const connectSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    repositories: z
      .array(
        z.object({
          repoFullName: z.string(),
          defaultBranch: z.string().default("main"),
          label: z.string().optional(),
        })
      )
      .min(1),
  });

  app.post("/api/projects", async (request, reply) => {
    const user = await requireUser(request);
    const body = connectSchema.parse(request.body);

    const existing = await prisma.project.findUnique({
      where: { userId_name: { userId: user.id, name: body.name } },
    });
    if (existing) {
      return reply.status(400).send({ error: "A project with this name already exists." });
    }

    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name: body.name,
        description: body.description,
        repoFullName: body.repositories[0]?.repoFullName,
        defaultBranch: body.repositories[0]?.defaultBranch ?? "main",
        repositories: {
          create: body.repositories.map((repo, index) => ({
            repoFullName: repo.repoFullName,
            defaultBranch: repo.defaultBranch,
            label: repo.label,
            sortOrder: index,
          })),
        },
      },
      include: { repositories: { orderBy: { sortOrder: "asc" } } },
    });
    return { project };
  });

  app.delete("/api/projects/:id", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    await prisma.project.deleteMany({ where: { id, userId: user.id } });
    return { ok: true };
  });
}
