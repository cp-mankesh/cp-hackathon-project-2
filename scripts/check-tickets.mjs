import { prisma } from "@ados/db";

const tickets = await prisma.ticket.findMany({
  orderBy: { updatedAt: "desc" },
  take: 5,
  include: {
    project: { select: { repoFullName: true, defaultBranch: true } },
    workflowRuns: {
      orderBy: { startedAt: "desc" },
      take: 1,
      include: {
        events: { orderBy: { createdAt: "desc" }, take: 8 },
      },
    },
  },
});

console.log(JSON.stringify(tickets, null, 2));
await prisma.$disconnect();
