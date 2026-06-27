import path from "node:path";
import { prisma } from "@ados/db";
import {
  analyzeMultiRepo,
  analyzeRepo,
  checkoutAgentBranch,
  cloneRepository,
  commitAndPush,
  createBranch,
  createPullRequest,
  findOpenPullRequest,
  generateDetailedPlan,
  getDiffSummary,
  getMultiRepoDiffSummary,
  getRepoWorkspace,
  implementMultiRepoWithOpenAI,
  implementWithOpenHands,
  prepareLocalRepository,
  reviewCode,
  runMultiRepoTests,
  runTests,
  summarizeAppliedChanges,
  validateChanges as validateRepoChanges,
} from "@ados/agents";
import {
  isGitHubRemoteUrl,
  parseGitHubRepoFromRemote,
  resolveProjectRepositories,
  resolveRepoWorkspace,
} from "@ados/shared";
import type { TicketActivities } from "../types";

const workspacesDir = process.env.WORKSPACES_DIR ?? "/tmp/ados-workspaces";

async function commitPushAndUpdatePrActivity(input: {
  workspacePath: string;
  branchName: string;
  repoFullName: string;
  defaultBranch: string;
  title: string;
  body: string;
  ticketId: string;
  runId: string;
  githubToken?: string;
  gitToken?: string;
  remoteUrl?: string | null;
  gitUsername?: string | null;
}) {
  const pushToken = input.gitToken ?? input.githubToken;
  const githubRepoFullName =
    (input.remoteUrl ? parseGitHubRepoFromRemote(input.remoteUrl) : null) ??
    (input.repoFullName.includes("/") && !input.repoFullName.startsWith("local/")
      ? input.repoFullName
      : null);
  const canCreatePr = !!githubRepoFullName && !!pushToken && isGitHubRemoteUrl(input.remoteUrl ?? `https://github.com/${githubRepoFullName}.git`);

  if (input.remoteUrl && !pushToken) {
    throw new Error("Git credentials required to push changes.");
  }

  const existingPr = await prisma.pullRequest.findUnique({
    where: {
      ticketId_repoFullName: {
        ticketId: input.ticketId,
        repoFullName: input.repoFullName,
      },
    },
  });

  const pushResult = await commitAndPush({
    workspacePath: input.workspacePath,
    branchName: input.branchName,
    message: existingPr ? `[Agent] Update: ${input.title}` : `[Agent] ${input.title}`,
    token: pushToken,
    repoFullName: githubRepoFullName ?? input.repoFullName,
    remoteUrl: input.remoteUrl,
    gitUsername: input.gitUsername,
  });

  if (existingPr) {
    await prisma.workflowEvent.create({
      data: {
        runId: input.runId,
        step: "pr_updated",
        message: pushResult.pushed
          ? `Pushed updates to existing PR: ${existingPr.url}`
          : `PR already up to date: ${existingPr.url}`,
      },
    });
    return {
      number: existingPr.githubNumber ?? 0,
      url: existingPr.url ?? "",
    };
  }

  if (!canCreatePr) {
    const message = pushResult.pushed
      ? `Pushed branch "${input.branchName}" to remote.`
      : pushResult.alreadyUpToDate
        ? `Branch "${input.branchName}" is already up to date locally.`
        : `Committed changes locally on branch "${input.branchName}".`;
    await prisma.workflowEvent.create({
      data: {
        runId: input.runId,
        step: "push",
        message,
      },
    });
    return { number: 0, url: input.remoteUrl ?? "" };
  }

  if (pushResult.alreadyUpToDate && pushToken && githubRepoFullName) {
    const linked = await findOpenPullRequest({
      token: pushToken,
      repoFullName: githubRepoFullName,
      branchName: input.branchName,
    });
    if (linked) {
      await prisma.pullRequest.create({
        data: {
          ticketId: input.ticketId,
          runId: input.runId,
          repoFullName: input.repoFullName,
          githubNumber: linked.number,
          url: linked.url,
          branch: input.branchName,
        },
      });
      await prisma.workflowEvent.create({
        data: {
          runId: input.runId,
          step: "done",
          message: `Linked existing open PR: ${linked.url}`,
        },
      });
      return linked;
    }
  }

  const [owner, repo] = githubRepoFullName!.split("/");
  const branchRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(input.branchName)}`,
    {
      headers: {
        Authorization: `Bearer ${pushToken}`,
        Accept: "application/vnd.github+json",
      },
    }
  );
  if (!branchRes.ok) {
    throw new Error(`Push verification failed: branch "${input.branchName}" not found on GitHub.`);
  }

  const pr = await createPullRequest({
    token: pushToken!,
    repoFullName: githubRepoFullName!,
    branchName: input.branchName,
    baseBranch: input.defaultBranch,
    title: input.title,
    body: input.body,
  });

  await prisma.pullRequest.create({
    data: {
      ticketId: input.ticketId,
      runId: input.runId,
      repoFullName: input.repoFullName,
      githubNumber: pr.number,
      url: pr.url,
      branch: input.branchName,
    },
  });

  return pr;
}

export const activities: TicketActivities = {
  async claimTicket(ticketId, runId) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: "claimed" },
    });
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { currentStep: "claimed", status: "running" },
    });
  },

  async updateTicketStatus(ticketId, status, step) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: status as never },
    });
    if (step) {
      const run = await prisma.workflowRun.findFirst({
        where: { ticketId },
        orderBy: { startedAt: "desc" },
      });
      if (run) {
        await prisma.workflowRun.update({
          where: { id: run.id },
          data: { currentStep: step },
        });
      }
    }
  },

  async logEvent(runId, step, message, payload) {
    await prisma.workflowEvent.create({
      data: { runId, step, message, payload: payload as object | undefined },
    });
  },

  async saveArtifact(runId, type, content) {
    await prisma.agentArtifact.create({
      data: { runId, type, content },
    });
  },

  async loadTicketContext(ticketId, excludeRunId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        pullRequests: true,
        project: { include: { repositories: { orderBy: { sortOrder: "asc" } } } },
        workflowRuns: {
          where: excludeRunId ? { id: { not: excludeRunId } } : undefined,
          orderBy: { startedAt: "asc" },
          include: {
            events: { orderBy: { createdAt: "asc" } },
            artifacts: { orderBy: { createdAt: "asc" } },
          },
        },
      },
    });

    if (!ticket) {
      return { activityTranscript: "" };
    }

    const repositories = resolveProjectRepositories({
      repositories: ticket.project.repositories,
      repoFullName: ticket.project.repoFullName,
      defaultBranch: ticket.project.defaultBranch,
    });

    const transcript = ticket.workflowRuns
      .flatMap((run) =>
        run.events.map(
          (e) => `[${e.createdAt.toISOString()}] (${run.id.slice(-6)}) ${e.step}: ${e.message}`
        )
      )
      .join("\n");

    const artifacts = ticket.workflowRuns.flatMap((run) => run.artifacts);
    const previousPlan = artifacts.filter((a) => a.type === "detailed-plan").at(-1)?.content;
    const previousChangeSummary = artifacts.filter((a) => a.type === "change-summary").at(-1)?.content;

    let previousDiffSummary: string | undefined;
    try {
      previousDiffSummary = await getMultiRepoDiffSummary(ticketId, repositories);
      if (previousDiffSummary === "(no git diff available)") {
        previousDiffSummary = undefined;
      }
    } catch {
      previousDiffSummary = undefined;
    }

    const prUrls = ticket.pullRequests.map((p) => p.url).filter(Boolean);

    return {
      activityTranscript: transcript,
      previousPlan,
      previousChangeSummary,
      previousDiffSummary,
      branchName: ticket.branchName ?? ticket.pullRequests[0]?.branch ?? undefined,
      prUrl: prUrls.join(", ") || undefined,
    };
  },

  async syncAgentBranch(input) {
    for (const repo of input.repositories) {
      const ws = resolveRepoWorkspace(input.ticketId, repo, workspacesDir);
      await checkoutAgentBranch({
        workspacePath: ws,
        branchName: input.branchName,
        repoFullName: repo.repoFullName,
        token: repo.gitToken ?? input.githubToken,
        remoteUrl: repo.remoteUrl ?? undefined,
        gitUsername: repo.gitUsername ?? undefined,
      });
    }
  },

  async cloneRepo(input) {
    let token = input.githubToken;
    if (!token && input.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
        select: { userId: true },
      });
      if (project) {
        const integration = await prisma.integration.findUnique({
          where: { userId_type: { userId: project.userId, type: "github" } },
        });
        token = integration?.accessToken;
      }
    }

    const repoNames = input.repositories
      .map((r) => (r.sourceType === "local" && r.localPath ? r.localPath : r.repoFullName))
      .join(", ");
    await prisma.workflowEvent.create({
      data: {
        runId: input.runId,
        step: "clone",
        message: `Preparing ${repoNames}…`,
      },
    });

    for (const repo of input.repositories) {
      const workspacePath = resolveRepoWorkspace(input.ticketId, repo, workspacesDir);
      try {
        if (repo.sourceType === "local" && repo.localPath) {
          await prepareLocalRepository(repo.localPath);
          await prisma.workflowEvent.create({
            data: {
              runId: input.runId,
              step: "clone",
              message: `Using local repository ${repo.localPath}`,
            },
          });
          continue;
        }

        await cloneRepository({
          repoFullName: repo.repoFullName,
          token: repo.gitToken ?? token,
          workspacePath,
          branch: repo.defaultBranch,
          remoteUrl: repo.remoteUrl ?? undefined,
          gitUsername: repo.gitUsername ?? undefined,
        });
        await prisma.workflowEvent.create({
          data: {
            runId: input.runId,
            step: "clone",
            message: `Cloned ${repo.repoFullName}`,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await prisma.workflowEvent.create({
          data: {
            runId: input.runId,
            step: "clone",
            message: `Clone failed (${repo.repoFullName}): ${message.slice(0, 500)}`,
          },
        });
        throw err;
      }
    }
  },

  async createBranches(ticketId, branchName, repositories, githubToken) {
    for (const repo of repositories) {
      const ws = resolveRepoWorkspace(ticketId, repo, workspacesDir);
      await createBranch(ws, branchName, {
        repoFullName: repo.repoFullName,
        token: repo.gitToken ?? githubToken,
        remoteUrl: repo.remoteUrl,
        gitUsername: repo.gitUsername,
      });
    }
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { branchName },
    });
    return branchName;
  },

  async analyzeRepos(ticketId, repositories, ticket) {
    return analyzeMultiRepo(ticketId, repositories, ticket);
  },

  async generateDetailedPlan(input) {
    return generateDetailedPlan(input);
  },

  async setAwaitingPlanApproval(runId, ticketId) {
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { status: "awaiting_plan_approval", currentStep: "plan_approval" },
    });
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: "awaiting_plan_approval" },
    });
  },

  async resumeAfterPlanApproval(runId, ticketId) {
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { status: "running", currentStep: "implement" },
    });
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: "implementing" },
    });
  },

  async summarizeAppliedChanges(input) {
    return summarizeAppliedChanges(input);
  },

  async implementCode(input) {
    if (input.repositories.length > 1) {
      return implementMultiRepoWithOpenAI({
        ticketId: input.ticketId,
        repositories: input.repositories,
        plan: input.plan,
        ticketTitle: input.title,
        ticketBody: input.body,
        reviewFeedback: input.reviewFeedback,
        conversationHistory: input.conversationHistory,
        previousChangeSummary: input.previousChangeSummary,
        previousDiffSummary: input.previousDiffSummary,
      });
    }

    const repo = input.repositories[0];
    return implementWithOpenHands({
      workspacePath: getRepoWorkspace(input.ticketId, repo),
      plan: input.plan,
      ticketTitle: input.title,
      ticketBody: input.body,
      attempt: input.attempt,
      reviewFeedback: input.reviewFeedback,
      conversationHistory: input.conversationHistory,
      previousChangeSummary: input.previousChangeSummary,
      previousDiffSummary: input.previousDiffSummary,
    });
  },

  async runTests(ticketId, repositories) {
    return runMultiRepoTests(ticketId, repositories);
  },

  async reviewCode(input) {
    return reviewCode(input);
  },

  async getDiffSummary(ticketId, repositories) {
    return getMultiRepoDiffSummary(ticketId, repositories);
  },

  async validateChanges(ticketId, repositories) {
    let hasChanges = false;
    let meaningful = false;
    const files: string[] = [];

    for (const repo of repositories) {
      const ws = getRepoWorkspace(ticketId, repo);
      const result = await validateRepoChanges(ws);
      hasChanges = hasChanges || result.hasChanges;
      meaningful = meaningful || result.meaningful;
      files.push(...result.files.map((f) => `${repo.repoFullName}::${f}`));
    }

    return { hasChanges, meaningful, files };
  },

  async setAwaitingHumanReview(runId, ticketId) {
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { status: "awaiting_approval", currentStep: "human_review" },
    });
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: "awaiting_human_review" },
    });
  },

  async commitPushAllRepos(input) {
    const results: Array<{ number: number; url: string; repoFullName: string }> = [];

    for (const repo of input.repositories) {
      const ws = resolveRepoWorkspace(input.ticketId, repo, workspacesDir);
      const pr = await commitPushAndUpdatePrActivity({
        workspacePath: ws,
        branchName: input.branchName,
        repoFullName: repo.repoFullName,
        defaultBranch: repo.defaultBranch,
        title: input.title,
        body: `Automated PR for ticket ${input.ticketId}\n\n${input.body}`,
        ticketId: input.ticketId,
        runId: input.runId,
        githubToken: input.githubToken,
        gitToken: repo.gitToken ?? undefined,
        remoteUrl: repo.remoteUrl,
        gitUsername: repo.gitUsername,
      });
      results.push({ ...pr, repoFullName: repo.repoFullName });
    }

    return results;
  },

  async commitPushAndCreatePr(input) {
    return commitPushAndUpdatePrActivity(input);
  },

  async commitPushAndUpdatePr(input) {
    return commitPushAndUpdatePrActivity(input);
  },

  async markCompleted(ticketId, runId, prUrl) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: prUrl ? "completed" : "pr_created" },
    });
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { status: "completed", currentStep: "done", completedAt: new Date() },
    });
  },

  async markFailed(ticketId, runId, error) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: "failed" },
    });
    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: "failed",
        errorMessage: error,
        currentStep: "failed",
        completedAt: new Date(),
      },
    });
  },

  async markRejected(ticketId, runId, notes) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: "rejected" },
    });
    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: "rejected",
        currentStep: "rejected",
        completedAt: new Date(),
        errorMessage: notes,
      },
    });
    await prisma.reviewDecision.create({
      data: { runId, approved: false, notes },
    });
  },
};
