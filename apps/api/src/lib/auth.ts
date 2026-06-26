import crypto from "node:crypto";
import type { FastifyRequest } from "fastify";
import { prisma } from "@ados/db";

const SESSION_COOKIE = "ados_session";
const SESSION_DAYS = 7;

export function getSessionToken(request: FastifyRequest): string | undefined {
  return request.cookies[SESSION_COOKIE];
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await prisma.session.create({
    data: { userId, token, expiresAt },
  });

  return token;
}

export async function getUserFromSession(token: string | undefined) {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }

  return session.user;
}

export async function requireUser(request: FastifyRequest) {
  const user = await getUserFromSession(getSessionToken(request));
  if (!user) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }
  return user;
}

export { SESSION_COOKIE };
