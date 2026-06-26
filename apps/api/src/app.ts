import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { authRoutes, projectRoutes } from "./routes/projects";
import { ticketRoutes } from "./routes/tickets";
import { webhookRoutes, jiraRoutes } from "./routes/webhooks";

export async function buildApp(options?: { logger?: boolean }): Promise<FastifyInstance> {
  const app = Fastify({ logger: options?.logger ?? false });

  await app.register(cors, {
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true,
  });
  await app.register(cookie, {
    secret: process.env.SESSION_SECRET ?? "dev-secret",
  });

  await authRoutes(app);
  await projectRoutes(app);
  await ticketRoutes(app);
  await webhookRoutes(app);
  await jiraRoutes(app);

  app.get("/api/health", async () => ({ status: "ok", service: "ados-api" }));

  return app;
}
