import fs from "node:fs/promises";
import path from "node:path";
import {
  decodeRepoFilePath,
  encodeRepoFilePath,
  groupFilesByRepo,
  isMeaningfulDiffText,
  ticketRepoWorkspace,
  type ProjectRepositoryInfo,
} from "@ados/shared";
import { analyzeRepo, getDiffSummary, runTests } from "./openhands";
import { implementCodeWithOpenAI } from "./openai";
import type { ImplementResult } from "@ados/shared";

const workspacesDir = process.env.WORKSPACES_DIR ?? "/tmp/ados-workspaces";

export function getRepoWorkspace(ticketId: string, repoFullName: string): string {
  return ticketRepoWorkspace(ticketId, repoFullName, workspacesDir);
}

export async function analyzeMultiRepo(
  ticketId: string,
  repositories: ProjectRepositoryInfo[],
  ticket?: { title: string; body: string }
): Promise<{
  fileTree: string;
  keyFiles: string;
  relevantFiles: string[];
}> {
  const trees: string[] = [];
  const keyParts: string[] = [];
  const relevant = new Set<string>();

  for (const repo of repositories) {
    const ws = getRepoWorkspace(ticketId, repo.repoFullName);
    try {
      await fs.access(ws);
    } catch {
      trees.push(`=== ${repo.label ?? repo.repoFullName} (${repo.repoFullName}) ===\n(not cloned yet)\n`);
      continue;
    }

    const label = repo.label ?? repo.repoFullName;
    const result = await analyzeRepo(ws, ticket);
    trees.push(`=== ${label} [${repo.repoFullName}] ===\n${result.fileTree}`);
    keyParts.push(`=== ${label} [${repo.repoFullName}] ===\n${result.keyFiles}`);
    for (const f of result.relevantFiles) {
      relevant.add(encodeRepoFilePath(repo.repoFullName, f));
    }
  }

  return {
    fileTree: trees.join("\n\n"),
    keyFiles: keyParts.join("\n\n"),
    relevantFiles: [...relevant],
  };
}

export async function getMultiRepoDiffSummary(
  ticketId: string,
  repositories: ProjectRepositoryInfo[]
): Promise<string> {
  const parts: string[] = [];
  for (const repo of repositories) {
    const ws = getRepoWorkspace(ticketId, repo.repoFullName);
    try {
      const diff = await getDiffSummary(ws, repo.defaultBranch);
      if (isMeaningfulDiffText(diff)) {
        parts.push(`=== ${repo.repoFullName} ===\n${diff}`);
      }
    } catch {
      // skip
    }
  }
  return parts.join("\n\n") || "(no git diff available)";
}

export async function runMultiRepoTests(
  ticketId: string,
  repositories: ProjectRepositoryInfo[]
): Promise<{ passed: boolean; output: string; command: string }> {
  const outputs: string[] = [];
  let allPassed = true;
  let lastCommand = "none";

  for (const repo of repositories) {
    const ws = getRepoWorkspace(ticketId, repo.repoFullName);
    try {
      await fs.access(path.join(ws, "package.json"));
    } catch {
      continue;
    }
    const result = await runTests(ws);
    outputs.push(`=== ${repo.repoFullName} ===\n${result.output}`);
    lastCommand = result.command;
    if (!result.passed) allPassed = false;
  }

  if (outputs.length === 0) {
    return { passed: true, output: "No test runner detected in any repository — skipped.", command: "none" };
  }

  return {
    passed: allPassed,
    output: outputs.join("\n\n"),
    command: lastCommand,
  };
}

export async function implementMultiRepoWithOpenAI(input: {
  ticketId: string;
  repositories: ProjectRepositoryInfo[];
  plan: string;
  ticketTitle: string;
  ticketBody: string;
  reviewFeedback?: string;
  conversationHistory?: string;
  previousChangeSummary?: string;
  previousDiffSummary?: string;
}): Promise<ImplementResult> {
  let estimatedFiles: string[] = [];
  try {
    const parsed = JSON.parse(input.plan) as { estimatedFiles?: string[]; fileChanges?: Array<{ file: string }> };
    estimatedFiles = parsed.estimatedFiles ?? [];
    if (parsed.fileChanges?.length) {
      estimatedFiles = [
        ...new Set([...estimatedFiles, ...parsed.fileChanges.map((c) => c.file)]),
      ];
    }
  } catch {
    // plain text plan
  }

  const byRepo = groupFilesByRepo(estimatedFiles);
  const targetRepo = input.repositories[0]?.repoFullName;

  if (byRepo.size === 0 && targetRepo) {
    return implementCodeWithOpenAI({
      workspacePath: getRepoWorkspace(input.ticketId, targetRepo),
      plan: input.plan,
      ticketTitle: input.ticketTitle,
      ticketBody: input.ticketBody,
      reviewFeedback: input.reviewFeedback,
      conversationHistory: input.conversationHistory,
      previousChangeSummary: input.previousChangeSummary,
      previousDiffSummary: input.previousDiffSummary,
    });
  }

  const allChanged: string[] = [];
  const summaries: string[] = [];
  let anySuccess = false;
  let parsedPlan: { fileChanges?: Array<{ file: string }> } = {};
  try {
    parsedPlan = JSON.parse(input.plan);
  } catch {
    parsedPlan = {};
  }

  for (const [repoFullName, files] of byRepo) {
    const ws = getRepoWorkspace(input.ticketId, repoFullName);
    const repoPlan = JSON.stringify({
      ...parsedPlan,
      estimatedFiles: files.map((f) => encodeRepoFilePath(repoFullName, f)),
      fileChanges: (parsedPlan.fileChanges ?? [])
        .filter((c) => decodeRepoFilePath(c.file).repoFullName === repoFullName)
        .map((c) => ({
          ...c,
          file: decodeRepoFilePath(c.file).filePath || c.file,
        })),
    });

    const result = await implementCodeWithOpenAI({
      workspacePath: ws,
      plan: repoPlan,
      ticketTitle: input.ticketTitle,
      ticketBody: input.ticketBody,
      reviewFeedback: input.reviewFeedback,
      conversationHistory: input.conversationHistory,
      previousChangeSummary: input.previousChangeSummary,
      previousDiffSummary: input.previousDiffSummary,
    });

    if (result.success) anySuccess = true;
    summaries.push(`[${repoFullName}] ${result.summary}`);
    allChanged.push(...result.filesChanged.map((f) => encodeRepoFilePath(repoFullName, f)));
  }

  return {
    success: anySuccess,
    filesChanged: allChanged,
    summary: summaries.join(" "),
  };
}
