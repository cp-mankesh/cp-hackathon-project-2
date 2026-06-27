import type { ProjectRepositoryInfo } from "@ados/shared";
import { isGitHubRemoteUrl, isLocalRepository, resolveProjectRepositories } from "@ados/shared";
import { maybeDecryptSecret } from "./crypto";

export type WorkflowRepository = ProjectRepositoryInfo & { gitToken?: string };

export function stripRepositorySecrets<T extends { gitToken?: string | null }>(repo: T) {
  const { gitToken: _gitToken, ...rest } = repo;
  return rest;
}

export function loadWorkflowRepositories(project: {
  repositories?: Array<{
    repoFullName: string;
    defaultBranch: string;
    label?: string | null;
    sourceType?: string | null;
    localPath?: string | null;
    remoteUrl?: string | null;
    gitUsername?: string | null;
    gitToken?: string | null;
  }>;
  repoFullName?: string | null;
  defaultBranch?: string | null;
}): WorkflowRepository[] {
  const resolved = resolveProjectRepositories(project);
  return resolved.map((repo) => {
    const dbRepo = project.repositories?.find((entry) => entry.repoFullName === repo.repoFullName);
    const storedToken = dbRepo?.gitToken ? maybeDecryptSecret(dbRepo.gitToken) : undefined;
    return { ...repo, gitToken: storedToken };
  });
}

export function resolveRepoPushToken(
  repo: WorkflowRepository,
  githubAccessToken?: string | null
): string | undefined {
  if (isLocalRepository(repo)) {
    if (repo.remoteUrl && isGitHubRemoteUrl(repo.remoteUrl) && githubAccessToken) {
      return githubAccessToken;
    }
    return repo.gitToken;
  }
  return githubAccessToken ?? undefined;
}

export function projectRequiresGitHubOAuth(repositories: ProjectRepositoryInfo[]): boolean {
  return repositories.some((repo) => !isLocalRepository(repo));
}

export function projectHasMissingPushCredentials(
  repositories: WorkflowRepository[],
  githubAccessToken?: string | null
): string | null {
  for (const repo of repositories) {
    if (!isLocalRepository(repo)) continue;
    if (!repo.remoteUrl) continue;
    const token = resolveRepoPushToken(repo, githubAccessToken);
    if (!token) {
      if (isGitHubRemoteUrl(repo.remoteUrl)) {
        return "Connect GitHub in Settings to push changes for this local repository.";
      }
      return `Add a Git username and token for ${repo.label ?? repo.localPath} to push changes.`;
    }
    if (!isGitHubRemoteUrl(repo.remoteUrl) && !repo.gitUsername) {
      return `Add a Git username for ${repo.label ?? repo.localPath} to push to its remote.`;
    }
  }
  return null;
}
