import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);

const NETWORK_ERROR = /Could not resolve host|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|network/i;

export function buildAuthenticatedRepoUrl(repoFullName: string, token: string): string {
  return `https://x-access-token:${token}@github.com/${repoFullName}.git`;
}

export function buildPublicRepoUrl(repoFullName: string): string {
  return `https://github.com/${repoFullName}.git`;
}

export function buildAuthenticatedRemoteUrl(
  remoteUrl: string,
  username: string,
  token: string
): string {
  const normalized = remoteUrl.replace(/^git@([^:]+):(.+\.git?)$/, "https://$1/$2");
  const url = new URL(normalized);
  url.username = encodeURIComponent(username);
  url.password = encodeURIComponent(token);
  return url.toString();
}

export async function getOriginRemoteUrl(workspacePath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], {
      cwd: workspacePath,
      timeout: 10_000,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function setOriginRemoteUrl(workspacePath: string, remoteUrl: string): Promise<void> {
  try {
    await execGit(["remote", "set-url", "origin", remoteUrl], { cwd: workspacePath });
  } catch {
    await execGit(["remote", "add", "origin", remoteUrl], { cwd: workspacePath });
  }
}

export async function isGitRepository(workspacePath: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["rev-parse", "--git-dir"], {
      cwd: workspacePath,
      timeout: 10_000,
    });
    return true;
  } catch {
    return false;
  }
}

export async function repoMatchesOrigin(workspacePath: string, repoFullName: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], {
      cwd: workspacePath,
      timeout: 10_000,
    });
    const url = stdout.trim();
    return (
      url === buildPublicRepoUrl(repoFullName) ||
      url.endsWith(`github.com/${repoFullName}.git`) ||
      url.endsWith(`github.com/${repoFullName}`)
    );
  } catch {
    return false;
  }
}

export async function cleanWorkspace(workspacePath: string): Promise<void> {
  await fs.rm(workspacePath, { recursive: true, force: true }).catch(() => undefined);
}

export async function execGit(
  args: string[],
  options: { cwd?: string; timeout?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  const maxRetries = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await execFileAsync("git", args, {
        cwd: options.cwd,
        timeout: options.timeout ?? 120_000,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      });
      return { stdout: result.stdout, stderr: result.stderr };
    } catch (err) {
      lastError = err;
      const message = String(err);
      if (NETWORK_ERROR.test(message) && attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw sanitizeGitError(err);
    }
  }

  throw sanitizeGitError(lastError);
}

export function sanitizeGitError(err: unknown): Error {
  const execErr = err as { message?: string; stderr?: string };
  const raw = `${execErr.message ?? ""}\n${execErr.stderr ?? ""}`;
  const cleaned = raw
    .replace(/gho_[A-Za-z0-9_]+/g, "[REDACTED_TOKEN]")
    .replace(/ghp_[A-Za-z0-9_]+/g, "[REDACTED_TOKEN]")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "[REDACTED_TOKEN]")
    .replace(/x-access-token:[^@\s]+/g, "x-access-token:[REDACTED]")
    .replace(/AUTHORIZATION: bearer [^\s"]+/gi, "AUTHORIZATION: bearer [REDACTED]");
  return new Error(cleaned.trim() || "Git command failed");
}

export function isGitAuthError(err: unknown): boolean {
  const message = String(err);
  return /Authentication failed|invalid credentials|could not read Username|terminal prompts disabled|401|403|Repository not found/i.test(
    message
  );
}

export async function localBranchExists(workspacePath: string, branchName: string): Promise<boolean> {
  try {
    await execGit(["show-ref", "--verify", `refs/heads/${branchName}`], { cwd: workspacePath });
    return true;
  } catch {
    return false;
  }
}

export async function remoteBranchExists(workspacePath: string, branchName: string): Promise<boolean> {
  try {
    await execGit(["show-ref", "--verify", `refs/remotes/origin/${branchName}`], { cwd: workspacePath });
    return true;
  } catch {
    return false;
  }
}

export async function fetchRemoteBranch(
  workspacePath: string,
  branchName: string,
  timeout = 180_000
): Promise<void> {
  await execGit(
    ["fetch", "origin", `refs/heads/${branchName}:refs/remotes/origin/${branchName}`],
    { cwd: workspacePath, timeout }
  );
}

export async function checkoutBaseBranch(workspacePath: string): Promise<void> {
  try {
    await execGit(["checkout", "main"], { cwd: workspacePath });
  } catch {
    await execGit(["checkout", "master"], { cwd: workspacePath });
  }
}

/** Commits on HEAD that are not on origin/{branchName}. Returns 0 when remote tracking is missing. */
export async function countCommitsAheadOfRemote(
  workspacePath: string,
  branchName: string
): Promise<number> {
  try {
    const { stdout } = await execGit(
      ["rev-list", "--count", `origin/${branchName}..HEAD`],
      { cwd: workspacePath }
    );
    return Number.parseInt(stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

/** Commits on origin/{branchName} that are not on HEAD. */
export async function countCommitsBehindRemote(
  workspacePath: string,
  branchName: string
): Promise<number> {
  try {
    const { stdout } = await execGit(
      ["rev-list", "--count", `HEAD..origin/${branchName}`],
      { cwd: workspacePath }
    );
    return Number.parseInt(stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

export async function rebaseOntoRemoteBranch(
  workspacePath: string,
  branchName: string
): Promise<void> {
  try {
    await fetchRemoteBranch(workspacePath, branchName);
  } catch {
    return;
  }

  if (!(await remoteBranchExists(workspacePath, branchName))) {
    return;
  }

  const behind = await countCommitsBehindRemote(workspacePath, branchName);
  if (behind === 0) {
    return;
  }

  try {
    await execGit(["rebase", `origin/${branchName}`], { cwd: workspacePath, timeout: 180_000 });
  } catch {
    await execGit(["rebase", "--abort"], { cwd: workspacePath }).catch(() => undefined);
    throw new Error(
      `Unable to rebase onto origin/${branchName}. Resolve conflicts on the agent branch and retry.`
    );
  }
}
