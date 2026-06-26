#!/usr/bin/env node
/** Pre-migration: backfill PullRequest.repoFullName and legacy Project rows before schema push. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Add nullable repoFullName if missing (idempotent for re-runs)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "PullRequest" ADD COLUMN IF NOT EXISTS "repoFullName" TEXT;
  `);

  const prs = await prisma.$queryRawUnsafe(
    `SELECT id, "ticketId", "repoFullName" FROM "PullRequest"`
  );

  for (const pr of prs) {
    if (pr.repoFullName) continue;
    const ticket = await prisma.ticket.findUnique({
      where: { id: pr.ticketId },
      include: { project: true },
    });
    const repoFullName = ticket?.project.repoFullName;
    if (!repoFullName) continue;
    await prisma.$executeRawUnsafe(
      `UPDATE "PullRequest" SET "repoFullName" = $1 WHERE id = $2`,
      repoFullName,
      pr.id
    );
    console.log(`Backfilled PR ${pr.id} → ${repoFullName}`);
  }

  // Drop old unique on ticketId alone if it exists (multi-PR per ticket)
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "PullRequest" DROP CONSTRAINT IF EXISTS "PullRequest_ticketId_key";
    EXCEPTION WHEN undefined_object THEN NULL;
    END $$;
  `);

}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
