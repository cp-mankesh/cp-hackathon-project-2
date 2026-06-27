"use client";

import { useEffect, useState } from "react";
import { API_URL, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FolderGit2, Github, HardDrive, Plus, Trash2 } from "lucide-react";

interface ProjectRepository {
  id: string;
  repoFullName: string;
  defaultBranch: string;
  label: string | null;
  sourceType?: string;
  localPath?: string | null;
  remoteUrl?: string | null;
  gitUsername?: string | null;
}

interface Project {
  id: string;
  name: string;
  repoFullName: string | null;
  defaultBranch: string | null;
  description: string | null;
  openTickets: number;
  repositories: ProjectRepository[];
}

interface GhRepo {
  fullName: string;
  name: string;
  defaultBranch: string;
  description: string | null;
}

interface LocalRepoInfo {
  localPath: string;
  repoFullName: string;
  defaultBranch: string;
  remoteUrl: string | null;
  isGitHub: boolean;
  requiresCredentials: boolean;
  label: string;
}

interface PendingLocalRepo extends LocalRepoInfo {
  gitUsername: string;
  gitToken: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [repos, setRepos] = useState<GhRepo[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [sourceMode, setSourceMode] = useState<"github" | "local">("github");
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [localPathInput, setLocalPathInput] = useState("");
  const [localGitUsername, setLocalGitUsername] = useState("");
  const [localGitToken, setLocalGitToken] = useState("");
  const [validatingLocal, setValidatingLocal] = useState(false);
  const [pendingLocalRepos, setPendingLocalRepos] = useState<PendingLocalRepo[]>([]);
  const [creating, setCreating] = useState(false);

  async function loadProjects() {
    const { projects: p } = await api<{ projects: Project[] }>("/api/projects");
    setProjects(p);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  function resetPicker() {
    setProjectName("");
    setProjectDescription("");
    setSelectedRepos(new Set());
    setLocalPathInput("");
    setLocalGitUsername("");
    setLocalGitToken("");
    setPendingLocalRepos([]);
  }

  async function openGithubPicker() {
    setSourceMode("github");
    resetPicker();
    setLoadingRepos(true);
    try {
      const { repos: r } = await api<{ repos: GhRepo[] }>("/api/github/repos");
      setRepos(r);
      setShowPicker(true);
    } catch {
      window.location.href = `${API_URL}/api/auth/github`;
    } finally {
      setLoadingRepos(false);
    }
  }

  function openLocalPicker() {
    setSourceMode("local");
    resetPicker();
    setShowPicker(true);
  }

  function toggleRepo(fullName: string) {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  }

  async function validateLocalRepo() {
    if (!localPathInput.trim()) {
      alert("Enter the absolute path to your local Git repository.");
      return;
    }
    setValidatingLocal(true);
    try {
      const info = await api<LocalRepoInfo>("/api/local/validate", {
        method: "POST",
        body: JSON.stringify({ localPath: localPathInput.trim() }),
      });
      if (pendingLocalRepos.some((repo) => repo.localPath === info.localPath)) {
        alert("This local repository is already added.");
        return;
      }
      if (info.requiresCredentials && (!localGitUsername.trim() || !localGitToken.trim())) {
        alert("This remote is not GitHub. Enter a Git username and token before adding the repository.");
        return;
      }
      setPendingLocalRepos((prev) => [
        ...prev,
        {
          ...info,
          gitUsername: localGitUsername.trim(),
          gitToken: localGitToken.trim(),
        },
      ]);
      setLocalPathInput("");
      setLocalGitUsername("");
      setLocalGitToken("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to validate local repository");
    } finally {
      setValidatingLocal(false);
    }
  }

  function removePendingLocalRepo(localPath: string) {
    setPendingLocalRepos((prev) => prev.filter((repo) => repo.localPath !== localPath));
  }

  async function createProject() {
    if (!projectName.trim()) {
      alert("Enter a project name.");
      return;
    }

    setCreating(true);
    try {
      let repositories: Array<Record<string, unknown>> = [];

      if (sourceMode === "github") {
        if (selectedRepos.size === 0) {
          alert("Select at least one GitHub repository.");
          return;
        }
        repositories = repos
          .filter((r) => selectedRepos.has(r.fullName))
          .map((r) => ({
            sourceType: "github",
            repoFullName: r.fullName,
            defaultBranch: r.defaultBranch,
            label: r.name,
          }));
      } else {
        if (pendingLocalRepos.length === 0) {
          alert("Add at least one local repository.");
          return;
        }
        repositories = pendingLocalRepos.map((repo) => ({
          sourceType: "local",
          localPath: repo.localPath,
          defaultBranch: repo.defaultBranch,
          label: repo.label,
          remoteUrl: repo.remoteUrl ?? undefined,
          gitUsername: repo.gitUsername || undefined,
          gitToken: repo.gitToken || undefined,
        }));
      }

      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDescription.trim() || undefined,
          repositories,
        }),
      });
      setShowPicker(false);
      await loadProjects();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  async function disconnect(id: string) {
    if (!confirm("Delete this project and all its tickets?")) return;
    await api(`/api/projects/${id}`, { method: "DELETE" });
    await loadProjects();
  }

  function repoList(project: Project) {
    if (project.repositories.length > 0) {
      return project.repositories.map((r) =>
        r.sourceType === "local" && r.localPath ? r.localPath : r.repoFullName
      );
    }
    if (project.repoFullName) return [project.repoFullName];
    return [];
  }

  const selectedCount = sourceMode === "github" ? selectedRepos.size : pendingLocalRepos.length;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500">
            Group GitHub or local Git repositories into a project
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openLocalPicker}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <HardDrive className="h-4 w-4" />
            Local Repo
          </button>
          <button
            onClick={openGithubPicker}
            disabled={loadingRepos}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            <Github className="h-4 w-4" />
            {loadingRepos ? "Loading…" : "GitHub Repo"}
          </button>
        </div>
      </header>

      {showPicker && (
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary-light/30 p-4">
          <div className="mb-4 flex gap-2">
            {(["github", "local"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSourceMode(mode)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm capitalize",
                  sourceMode === mode ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600">Project name</label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Hackathon App"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Description (optional)</label>
              <input
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Admin + Frontend repos"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          {sourceMode === "github" ? (
            <>
              <p className="mb-2 text-xs text-gray-500">Select GitHub repositories</p>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {repos.map((r) => {
                  const selected = selectedRepos.has(r.fullName);
                  return (
                    <button
                      key={r.fullName}
                      type="button"
                      onClick={() => toggleRepo(r.fullName)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                        selected ? "bg-primary/10 ring-1 ring-primary/30" : "bg-white hover:bg-gray-50"
                      }`}
                    >
                      <span className="font-medium">{r.fullName}</span>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded border ${
                          selected ? "border-primary bg-primary text-white" : "border-gray-300"
                        }`}
                      >
                        {selected && <Plus className="h-3 w-3 rotate-45" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="mb-2 text-xs text-gray-500">
                Add an absolute path to a local Git repository on this machine
              </p>
              <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600">Local path</label>
                  <input
                    value={localPathInput}
                    onChange={(e) => setLocalPathInput(e.target.value)}
                    placeholder="/home/you/projects/my-app"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  If the remote is not GitHub, provide credentials used for git push.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Git username</label>
                    <input
                      value={localGitUsername}
                      onChange={(e) => setLocalGitUsername(e.target.value)}
                      placeholder="your-username"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Git token / password</label>
                    <input
                      type="password"
                      value={localGitToken}
                      onChange={(e) => setLocalGitToken(e.target.value)}
                      placeholder="PAT or app password"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={validateLocalRepo}
                  disabled={validatingLocal}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <FolderGit2 className="h-4 w-4" />
                  {validatingLocal ? "Validating…" : "Add Local Repository"}
                </button>
              </div>

              {pendingLocalRepos.length > 0 && (
                <div className="mt-3 space-y-2">
                  {pendingLocalRepos.map((repo) => (
                    <div
                      key={repo.localPath}
                      className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{repo.localPath}</p>
                        <p className="text-xs text-gray-500">
                          branch {repo.defaultBranch}
                          {repo.remoteUrl ? ` · remote ${repo.remoteUrl}` : " · no remote configured"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePendingLocalRepo(repo.localPath)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={createProject}
              disabled={creating}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {creating ? "Creating…" : `Create (${selectedCount} repo${selectedCount === 1 ? "" : "s"})`}
            </button>
            <button onClick={() => setShowPicker(false)} className="px-4 py-2 text-sm text-gray-500 hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {projects.map((p) => {
          const reposInProject = repoList(p);
          const hasLocal = p.repositories.some((r) => r.sourceType === "local");
          return (
            <div key={p.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    {hasLocal && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Local</span>
                    )}
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {reposInProject.map((repo) => (
                      <li key={repo} className="text-sm text-gray-500 break-all">
                        {repo}
                      </li>
                    ))}
                  </ul>
                  {p.description && <p className="mt-2 text-sm text-gray-600">{p.description}</p>}
                  <p className="mt-2 text-xs text-gray-400">
                    {reposInProject.length} repo{reposInProject.length === 1 ? "" : "s"} · {p.openTickets} open
                    tickets
                  </p>
                </div>
                <button
                  onClick={() => disconnect(p.id)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
