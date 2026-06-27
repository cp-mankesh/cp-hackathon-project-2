import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import {
  isGitHubRemoteUrl,
  localRepoId,
  parseGitHubRepoFromRemote,
} from "@ados/shared";

const execFileAsync = promisify(execFile);

function allowedLocalRoots(): string[] {
  const raw = process.env.ALLOWED_LOCAL_REPO_ROOTS;
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((entry) => path.resolve(entry.trim()))
    .filter(Boolean);
}

export function assertLocalPathAllowed(localPath: string): string {
  const resolved = path.resolve(localPath);
  const roots = allowedLocalRoots();
  if (roots.length === 0) {
    return resolved;
  }
  const allowed = roots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
  if (!allowed) {
    throw Object.assign(
      new Error(
        `Local path is outside allowed roots. Set ALLOWED_LOCAL_REPO_ROOTS in .env (e.g. ${roots[0] ?? "/home/you/projects"}).`
      ),
      { statusCode: 400 }
    );
  }
  return resolved;
}

async function execGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    timeout: 30_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return stdout.trim();
}

async function isGitRepository(workspacePath: string): Promise<boolean> {
  try {
    await execGit(["rev-parse", "--git-dir"], workspacePath);
    return true;
  } catch {
    return false;
  }
}

async function readDefaultBranch(workspacePath: string): Promise<string> {
  try {
    const branch = await execGit(["symbolic-ref", "--short", "HEAD"], workspacePath);
    if (branch && branch !== "HEAD") return branch;
  } catch {
    // fall through
  }
  try {
    const remoteInfo = await execGit(["remote", "show", "origin"], workspacePath);
    const match = remoteInfo.match(/HEAD branch:\s*(\S+)/);
    if (match?.[1]) return match[1];
  } catch {
    // fall through
  }
  return "main";
}

async function readOriginUrl(workspacePath: string): Promise<string | null> {
  try {
    const url = await execGit(["remote", "get-url", "origin"], workspacePath);
    return url || null;
  } catch {
    return null;
  }
}

export async function inspectLocalRepository(localPath: string) {
  const resolved = assertLocalPathAllowed(localPath);

  try {
    await fs.access(resolved);
  } catch {
    throw Object.assign(new Error("Path does not exist."), { statusCode: 400 });
  }

  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) {
    throw Object.assign(new Error("Path must be a directory."), { statusCode: 400 });
  }

  if (!(await isGitRepository(resolved))) {
    throw Object.assign(new Error("Path is not a Git repository."), { statusCode: 400 });
  }

  const remoteUrl = await readOriginUrl(resolved);
  const defaultBranch = await readDefaultBranch(resolved);
  const isGitHub = isGitHubRemoteUrl(remoteUrl);
  const githubRepoFullName = remoteUrl ? parseGitHubRepoFromRemote(remoteUrl) : null;

  return {
    localPath: resolved,
    repoFullName: githubRepoFullName ?? localRepoId(resolved),
    defaultBranch,
    remoteUrl,
    isGitHub,
    requiresCredentials: !!remoteUrl && !isGitHub,
    label: path.basename(resolved),
  };
}
