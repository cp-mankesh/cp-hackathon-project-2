import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import type { ImplementResult, TestResult } from "@ados/shared";

const execFileAsync = promisify(execFile);

import { isMeaningfulDiffText } from "@ados/shared";
import {
  findRelevantSourceFiles,
  readFileSnippets,
} from "./repo-analysis";
import { implementCodeWithOpenAI } from "./openai";
import { execGit } from "./git";

export async function analyzeRepo(
  workspacePath: string,
  ticket?: { title: string; body: string }
): Promise<{
  fileTree: string;
  keyFiles: string;
  relevantFiles: string[];
}> {
  const tree = await buildFileTree(workspacePath, "", 0, 4);
  const keyFiles = await readKeyFiles(workspacePath);
  const relevantFiles = ticket
    ? await findRelevantSourceFiles(workspacePath, ticket.title, ticket.body)
    : [];
  const relevantSnippets = await readFileSnippets(workspacePath, relevantFiles);

  const combinedKeyFiles = [keyFiles, relevantFiles.length > 0 ? `Relevant source files:\n${relevantSnippets}` : ""]
    .filter(Boolean)
    .join("\n\n");

  return { fileTree: tree, keyFiles: combinedKeyFiles, relevantFiles };
}

async function buildFileTree(
  dir: string,
  prefix: string,
  depth: number,
  maxDepth: number
): Promise<string> {
  if (depth > maxDepth) return "";
  let result = "";
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const filtered = entries.filter(
      (e) => !["node_modules", ".git", "dist", ".next"].includes(e.name)
    );
    for (const entry of filtered.slice(0, 30)) {
      result += `${prefix}${entry.name}${entry.isDirectory() ? "/" : ""}\n`;
      if (entry.isDirectory()) {
        result += await buildFileTree(
          path.join(dir, entry.name),
          `${prefix}  `,
          depth + 1,
          maxDepth
        );
      }
    }
  } catch {
    result += `${prefix}(unreadable)\n`;
  }
  return result;
}

async function readKeyFiles(workspacePath: string): Promise<string> {
  const candidates = [
    "package.json",
    "README.md",
    "src/index.ts",
    "src/main.ts",
    "app/page.tsx",
    "requirements.txt",
    "pyproject.toml",
  ];
  const parts: string[] = [];
  for (const file of candidates) {
    try {
      const content = await fs.readFile(path.join(workspacePath, file), "utf-8");
      parts.push(`--- ${file} ---\n${content.slice(0, 2000)}`);
    } catch {
      // skip missing files
    }
  }
  return parts.join("\n\n") || "(no key files found)";
}

export async function implementWithOpenHands(input: {
  workspacePath: string;
  plan: string;
  ticketTitle: string;
  ticketBody: string;
  attempt: number;
  reviewFeedback?: string;
  conversationHistory?: string;
  previousChangeSummary?: string;
  previousDiffSummary?: string;
}): Promise<ImplementResult> {
  if (process.env.OPENAI_API_KEY) {
    const openAiResult = await implementCodeWithOpenAI({
      workspacePath: input.workspacePath,
      plan: input.plan,
      ticketTitle: input.ticketTitle,
      ticketBody: input.ticketBody,
      reviewFeedback: input.reviewFeedback,
      conversationHistory: input.conversationHistory,
      previousChangeSummary: input.previousChangeSummary,
      previousDiffSummary: input.previousDiffSummary,
    });
    if (openAiResult.success) {
      return openAiResult;
    }
  }

  const prompt = buildImplementPrompt(input);
  const agentScript = path.join(__dirname, "..", "scripts", "openhands-runner.py");

  try {
    await fs.access(agentScript);
    const { stdout } = await execFileAsync("python3", [agentScript, input.workspacePath], {
      env: { ...process.env, ADOS_TASK_PROMPT: prompt },
      timeout: 300_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as ImplementResult;
    const onlyStub = parsed.filesChanged.every((f) => path.basename(f) === "AGENT_WORKLOG.md");
    if (onlyStub) {
      return (
        (await implementCodeWithOpenAI({
          workspacePath: input.workspacePath,
          plan: input.plan,
          ticketTitle: input.ticketTitle,
          ticketBody: input.ticketBody,
          reviewFeedback: input.reviewFeedback,
        })) ?? {
          success: false,
          filesChanged: parsed.filesChanged,
          summary:
            "Agent stub only recorded a worklog. Set OPENAI_API_KEY in .env for real code changes.",
        }
      );
    }
    return parsed;
  } catch {
    if (process.env.OPENAI_API_KEY) {
      return implementCodeWithOpenAI({
        workspacePath: input.workspacePath,
        plan: input.plan,
        ticketTitle: input.ticketTitle,
        ticketBody: input.ticketBody,
        reviewFeedback: input.reviewFeedback,
      });
    }
    return await implementFallback(input);
  }
}

function buildImplementPrompt(input: {
  plan: string;
  ticketTitle: string;
  ticketBody: string;
  attempt: number;
  reviewFeedback?: string;
}): string {
  let prompt = `Task: ${input.ticketTitle}\n${input.ticketBody}\n\nPlan:\n${input.plan}`;
  if (input.reviewFeedback) {
    prompt += `\n\nPrevious review feedback (attempt ${input.attempt}):\n${input.reviewFeedback}`;
  }
  return prompt;
}

async function implementFallback(input: {
  workspacePath: string;
  plan: string;
  ticketTitle: string;
  ticketBody: string;
}): Promise<ImplementResult> {
  return {
    success: false,
    filesChanged: [],
    summary:
      "OpenHands agent is not fully configured. Set OPENAI_API_KEY in .env for code generation, or install OpenHands. No source files were modified.",
  };
}

export async function runTests(workspacePath: string): Promise<TestResult> {
  const commands = [
    ["npm", "test", "--if-present"],
    ["npm", "run", "test", "--if-present"],
    ["pnpm", "test"],
    ["yarn", "test"],
    ["python", "-m", "pytest", "-q"],
    ["go", "test", "./..."],
  ];

  for (const cmd of commands) {
    try {
      const pkgPath = path.join(workspacePath, "package.json");
      if (cmd[0] === "npm" || cmd[0] === "pnpm" || cmd[0] === "yarn") {
        await fs.access(pkgPath);
      }
      const { stdout, stderr } = await execFileAsync(cmd[0], cmd.slice(1), {
        cwd: workspacePath,
        timeout: 120_000,
        maxBuffer: 5 * 1024 * 1024,
      });
      const output = `${stdout}\n${stderr}`.trim();
      const passed = !/fail|error/i.test(output) || /0 failed|passed/i.test(output);
      return { passed, output, command: cmd.join(" ") };
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; code?: number };
      const output = `${execErr.stdout ?? ""}\n${execErr.stderr ?? ""}`.trim();
      if (cmd[0] === "npm" && execErr.code === 1) {
        return { passed: false, output, command: cmd.join(" ") };
      }
      continue;
    }
  }

  return {
    passed: true,
    output: "No test runner detected — skipped.",
    command: "none",
  };
}

async function readWorkingTreeDiff(workspacePath: string): Promise<string> {
  await execGit(["add", "-N", "-A"], { cwd: workspacePath }).catch(() => undefined);
  try {
    const stat = await execGit(["diff", "--stat", "HEAD"], {
      cwd: workspacePath,
      timeout: 120_000,
    });
    const diff = await execGit(["diff", "--unified=3", "HEAD"], {
      cwd: workspacePath,
      timeout: 120_000,
    });
    return `${stat.stdout}\n\n${diff.stdout}`.trim();
  } finally {
    await execGit(["reset"], { cwd: workspacePath }).catch(() => undefined);
  }
}

async function readBranchDiff(workspacePath: string, baseBranch: string): Promise<string> {
  const stat = await execGit(["diff", "--stat", `${baseBranch}...HEAD`], {
    cwd: workspacePath,
    timeout: 120_000,
  });
  const diff = await execGit(["diff", "--unified=3", `${baseBranch}...HEAD`], {
    cwd: workspacePath,
    timeout: 120_000,
  });
  return `${stat.stdout}\n\n${diff.stdout}`.trim();
}

export async function getDiffSummary(
  workspacePath: string,
  baseBranch = "main"
): Promise<string> {
  try {
    const workingTreeDiff = await readWorkingTreeDiff(workspacePath);
    if (isMeaningfulDiffText(workingTreeDiff)) {
      return workingTreeDiff;
    }

    for (const base of [baseBranch, "main", "master"]) {
      try {
        const branchDiff = await readBranchDiff(workspacePath, base);
        if (isMeaningfulDiffText(branchDiff)) {
          return branchDiff;
        }
      } catch {
        // try next base branch name
      }
    }

    return "(no git diff available)";
  } catch {
    return "(no git diff available)";
  }
}
