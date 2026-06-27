export type RepoSourceType = "github" | "local";

export interface ProjectRepositoryInfo {
  repoFullName: string;
  defaultBranch: string;
  label?: string | null;
  sourceType?: RepoSourceType;
  localPath?: string | null;
  remoteUrl?: string | null;
  gitUsername?: string | null;
}

function normalizePath(absolutePath: string): string {
  return absolutePath.replace(/\\/g, "/").replace(/\/+$/, "");
}

function pathBasename(normalizedPath: string): string {
  const parts = normalizedPath.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "repo";
}

function simplePathHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0").slice(0, 8);
}

export function localRepoId(absolutePath: string): string {
  const normalized = normalizePath(absolutePath);
  const hash = simplePathHash(normalized);
  const base = pathBasename(normalized).replace(/[^a-zA-Z0-9._-]/g, "-") || "repo";
  return `local/${base}-${hash}`;
}

export function isGitHubRemoteUrl(remoteUrl: string | null | undefined): boolean {
  if (!remoteUrl) return false;
  return /github\.com/i.test(remoteUrl);
}

export function parseGitHubRepoFromRemote(remoteUrl: string): string | null {
  const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+)/i);
  return match?.[1]?.replace(/\.git$/, "") ?? null;
}

export function isLocalRepository(repo: ProjectRepositoryInfo): boolean {
  return repo.sourceType === "local" && !!repo.localPath;
}
