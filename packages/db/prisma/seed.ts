import { prisma } from "../src";

async function main() {
  // Remove legacy demo data that points at a non-existent repo
  await prisma.ticket.deleteMany({ where: { id: "seed-ticket-1" } });
  await prisma.project.deleteMany({ where: { repoFullName: "demo/sample-app" } });

  console.log("Seed complete: removed demo/sample-app placeholder data");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
