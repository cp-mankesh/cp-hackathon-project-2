import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import {
  execGit,
  isGitAuthError,
  buildAuthenticatedRepoUrl,
  buildPublicRepoUrl,
  cleanWorkspace,
  isGitRepository,
  repoMatchesOrigin,
  localBranchExists,
  remoteBranchExists,
  fetchRemoteBranch,
  checkoutBaseBranch,
  countCommitsAheadOfRemote,
  countCommitsBehindRemote,
  rebaseOntoRemoteBranch,
} from "./git";

const execFileAsync = promisify(execFile);

const STUB_FILES = new Set(["AGENT_WORKLOG.md"]);

export async function validateChanges(workspacePath: string): Promise<{
  hasChanges: boolean;
  meaningful: boolean;
  files: string[];
}> {
  const { stdout } = await execFileAsync("git", ["status", "--porcelain"], {
    cwd: workspacePath,
    maxBuffer: 1024 * 1024,
  });
  const files = stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.replace(/^[ MADRCU?!]+/, "").trim());

  const meaningful = files.some((f) => !STUB_FILES.has(path.basename(f)));
  return { hasChanges: files.length > 0, meaningful, files };
}

export async function cloneRepository(input: {
  repoFullName: string;
  token?: string;
  workspacePath: string;
  branch?: string;
}): Promise<void> {
  await fs.mkdir(path.dirname(input.workspacePath), { recursive: true });

  if (
    (await isGitRepository(input.workspacePath)) &&
    (await repoMatchesOrigin(input.workspacePath, input.repoFullName))
  ) {
    return;
  }

  await cleanWorkspace(input.workspacePath);

  const publicUrl = buildPublicRepoUrl(input.repoFullName);
  const useFeatureBranch =
    input.branch && input.branch !== "main" && input.branch !== "master";
  const cloneArgs = (repoUrl: string) =>
    useFeatureBranch
      ? [
          "clone",
          "--depth",
          "1",
          "--branch",
          input.branch!,
          "--single-branch",
          repoUrl,
          input.workspacePath,
        ]
      : ["clone", "--depth", "1", repoUrl, input.workspacePath];

  let cloned = false;
  let lastError: unknown;

  if (input.token) {
    const authUrl = buildAuthenticatedRepoUrl(input.repoFullName, input.token);
    try {
      await execGit(cloneArgs(authUrl), { timeout: 120_000 });
      cloned = true;
    } catch (err) {
      lastError = err;
      await cleanWorkspace(input.workspacePath);
      if (!isGitAuthError(err)) {
        throw err;
      }
    }
  }

  if (!cloned) {
    try {
      await execGit(cloneArgs(publicUrl), { timeout: 120_000 });
    } catch (publicErr) {
      throw lastError ?? publicErr;
    }
  }

  if (
    input.branch &&
    input.branch !== "main" &&
    input.branch !== "master" &&
    !useFeatureBranch
  ) {
    await execGit(["checkout", input.branch], { cwd: input.workspacePath });
  }
}

export async function createBranch(
  workspacePath: string,
  branchName: string,
  options?: { repoFullName?: string; token?: string }
): Promise<void> {
  if (options?.token && options?.repoFullName) {
    const remoteUrl = buildAuthenticatedRepoUrl(options.repoFullName, options.token);
    try {
      await execGit(["remote", "set-url", "origin", remoteUrl], { cwd: workspacePath });
    } catch {
      await execGit(["remote", "add", "origin", remoteUrl], { cwd: workspacePath });
    }

    try {
      await fetchRemoteBranch(workspacePath, branchName);
      if (await remoteBranchExists(workspacePath, branchName)) {
        await checkoutAgentBranch({
          workspacePath,
          branchName,
          repoFullName: options.repoFullName,
          token: options.token,
        });
        return;
      }
    } catch {
      // Remote branch does not exist yet — create locally below.
    }
  }

  if (await localBranchExists(workspacePath, branchName)) {
    await execGit(["checkout", branchName], { cwd: workspacePath });
    return;
  }

  await checkoutBaseBranch(workspacePath);
  await execGit(["checkout", "-b", branchName], { cwd: workspacePath });
}

async function pushBranchHead(input: {
  workspacePath: string;
  branchName: string;
}): Promise<void> {
  await rebaseOntoRemoteBranch(input.workspacePath, input.branchName);
  await execGit(["push", "origin", `HEAD:${input.branchName}`], {
    cwd: input.workspacePath,
    timeout: 180_000,
  });
}

export async function checkoutAgentBranch(input: {
  workspacePath: string;
  branchName: string;
  repoFullName: string;
  token?: string;
}): Promise<void> {
  const { workspacePath, branchName, repoFullName, token } = input;
  const remoteRef = `refs/remotes/origin/${branchName}`;

  if (!(await isGitRepository(workspacePath))) {
    if (!token) {
      throw new Error("GitHub token required to clone agent branch.");
    }
    await cloneRepository({
      repoFullName,
      token,
      workspacePath,
      branch: branchName,
    });
    return;
  }

  const remoteUrl = token
    ? buildAuthenticatedRepoUrl(repoFullName, token)
    : buildPublicRepoUrl(repoFullName);

  try {
    await execGit(["remote", "set-url", "origin", remoteUrl], { cwd: workspacePath });
  } catch {
    await execGit(["remote", "add", "origin", remoteUrl], { cwd: workspacePath });
  }

  try {
    await fetchRemoteBranch(workspacePath, branchName);
  } catch {
    if (!(await remoteBranchExists(workspacePath, branchName))) {
      if (!token) {
        throw new Error("GitHub token required to fetch agent branch.");
      }
      await cleanWorkspace(workspacePath);
      await cloneRepository({
        repoFullName,
        token,
        workspacePath,
        branch: branchName,
      });
      return;
    }
  }

  if (!(await remoteBranchExists(workspacePath, branchName))) {
    if (await localBranchExists(workspacePath, branchName)) {
      await execGit(["checkout", branchName], { cwd: workspacePath });
      return;
    }
    throw new Error(`Remote branch ${branchName} was not found after fetch.`);
  }

  if (await localBranchExists(workspacePath, branchName)) {
    await execGit(["checkout", branchName], { cwd: workspacePath });
    await execGit(["reset", "--hard", remoteRef], { cwd: workspacePath }).catch(() => undefined);
  } else {
    await execGit(["checkout", "-B", branchName, remoteRef], { cwd: workspacePath });
  }
}

export async function commitAndPush(input: {
  workspacePath: string;
  branchName: string;
  message: string;
  token?: string;
  repoFullName: string;
}): Promise<{ pushed: boolean; commitSha?: string; alreadyUpToDate?: boolean }> {
  if (!input.token) {
    throw new Error("GitHub token required to push changes.");
  }

  const repoUrl = buildAuthenticatedRepoUrl(input.repoFullName, input.token);

  try {
    await execGit(["remote", "set-url", "origin", repoUrl], { cwd: input.workspacePath });
  } catch {
    await execGit(["remote", "add", "origin", repoUrl], { cwd: input.workspacePath });
  }

  await execGit(["add", "-A"], { cwd: input.workspacePath });
  const status = await execFileAsync("git", ["status", "--porcelain"], { cwd: input.workspacePath });

  if (status.stdout.trim()) {
    await execGit(["config", "user.email", "agent@ados.local"], { cwd: input.workspacePath });
    await execGit(["config", "user.name", "ADOS Agent"], { cwd: input.workspacePath });
    await execGit(["commit", "-m", input.message], { cwd: input.workspacePath });

    const rev = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: input.workspacePath });
    const commitSha = rev.stdout.trim();

    await pushBranchHead({
      workspacePath: input.workspacePath,
      branchName: input.branchName,
    });

    return { pushed: true, commitSha };
  }

  try {
    await fetchRemoteBranch(input.workspacePath, input.branchName);
  } catch {
    // Remote branch may not exist yet; push below will create it if we have local commits.
  }

  const ahead = await countCommitsAheadOfRemote(input.workspacePath, input.branchName);
  const rev = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: input.workspacePath });
  const commitSha = rev.stdout.trim();

  if (ahead > 0) {
    await pushBranchHead({
      workspacePath: input.workspacePath,
      branchName: input.branchName,
    });
    return { pushed: true, commitSha };
  }

  return { pushed: false, alreadyUpToDate: true, commitSha };
}

export async function findOpenPullRequest(input: {
  token: string;
  repoFullName: string;
  branchName: string;
}): Promise<{ number: number; url: string } | null> {
  const [owner, repo] = input.repoFullName.split("/");
  const head = `${owner}:${input.branchName}`;
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&head=${encodeURIComponent(head)}`,
    {
      headers: {
        Authorization: `Bearer ${input.token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as Array<{ number: number; html_url: string }>;
  const pr = data[0];
  if (!pr) {
    return null;
  }
  return { number: pr.number, url: pr.html_url };
}

export async function createPullRequest(input: {
  token: string;
  repoFullName: string;
  branchName: string;
  baseBranch: string;
  title: string;
  body: string;
}): Promise<{ number: number; url: string }> {
  const [owner, repo] = input.repoFullName.split("/");
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: input.title,
      body: input.body,
      head: input.branchName,
      base: input.baseBranch,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub PR creation failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { number: number; html_url: string };
  return { number: data.number, url: data.html_url };
}

export { analyzeRepo, implementWithOpenHands, runTests, getDiffSummary } from "./openhands";
export {
  generatePlan,
  generateDetailedPlan,
  reviewCode,
  summarizeAppliedChanges,
  formatChangeSummaryForDisplay,
} from "./openai";
export { formatDetailedPlan } from "./plan-format";
export { formatAppliedChanges } from "./changes-format";
export { isPlausibleGitHubToken, validateGitHubToken } from "./github";
export {
  analyzeMultiRepo,
  getMultiRepoDiffSummary,
  getRepoWorkspace,
  implementMultiRepoWithOpenAI,
  runMultiRepoTests,
} from "./multi-repo";
