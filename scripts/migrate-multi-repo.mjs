#!/usr/bin/env node
/** Migrate legacy single-repo projects to ProjectRepository rows. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    include: { repositories: true },
  });

  for (const project of projects) {
    if (project.repositories.length > 0) continue;
    if (!project.repoFullName) continue;

    await prisma.projectRepository.create({
      data: {
        projectId: project.id,
        repoFullName: project.repoFullName,
        defaultBranch: project.defaultBranch ?? "main",
        label: project.name,
        sortOrder: 0,
      },
    });
    console.log(`Migrated ${project.name} → ${project.repoFullName}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
