import type { ProjectRepositoryInfo } from "./local-repo";
export type { ProjectRepositoryInfo, RepoSourceType } from "./local-repo";
export { localRepoId, isGitHubRemoteUrl, parseGitHubRepoFromRemote, isLocalRepository } from "./local-repo";

export function encodeRepoFilePath(repoFullName: string, filePath: string): string {
  return `${repoFullName}::${filePath}`;
}

export function decodeRepoFilePath(encoded: string): { repoFullName: string; filePath: string } {
  const idx = encoded.indexOf("::");
  if (idx === -1) {
    return { repoFullName: "", filePath: encoded };
  }
  return {
    repoFullName: encoded.slice(0, idx),
    filePath: encoded.slice(idx + 2),
  };
}

export function repoWorkspaceDirName(repoFullName: string): string {
  return repoFullName.replace(/\//g, "__");
}

export function ticketRepoWorkspace(
  ticketId: string,
  repoFullName: string,
  workspacesDir = "/tmp/ados-workspaces"
): string {
  return `${workspacesDir}/${ticketId}/${repoWorkspaceDirName(repoFullName)}`;
}

export function resolveRepoWorkspace(
  ticketId: string,
  repo: ProjectRepositoryInfo,
  workspacesDir = "/tmp/ados-workspaces"
): string {
  if (repo.sourceType === "local" && repo.localPath) {
    return repo.localPath;
  }
  return ticketRepoWorkspace(ticketId, repo.repoFullName, workspacesDir);
}

export function groupFilesByRepo(
  files: string[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const file of files) {
    const { repoFullName, filePath } = decodeRepoFilePath(file);
    if (!repoFullName) continue;
    const list = map.get(repoFullName) ?? [];
    list.push(filePath);
    map.set(repoFullName, list);
  }
  return map;
}

export function resolveProjectRepositories(project: {
  repositories?: Array<
    ProjectRepositoryInfo & {
      sourceType?: string | null;
      localPath?: string | null;
      remoteUrl?: string | null;
      gitUsername?: string | null;
    }
  >;
  repoFullName?: string | null;
  defaultBranch?: string | null;
}): ProjectRepositoryInfo[] {
  if (project.repositories && project.repositories.length > 0) {
    return project.repositories.map((r) => ({
      repoFullName: r.repoFullName,
      defaultBranch: r.defaultBranch ?? "main",
      label: r.label,
      sourceType: (r.sourceType as ProjectRepositoryInfo["sourceType"]) ?? "github",
      localPath: r.localPath,
      remoteUrl: r.remoteUrl,
      gitUsername: r.gitUsername,
    }));
  }
  if (project.repoFullName) {
    return [
      {
        repoFullName: project.repoFullName,
        defaultBranch: project.defaultBranch ?? "main",
      },
    ];
  }
  return [];
}
