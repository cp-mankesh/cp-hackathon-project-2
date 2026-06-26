"use client";

import { useEffect, useState } from "react";
import { API_URL, api } from "@/lib/api";
import { Github, Plus, Trash2 } from "lucide-react";

interface ProjectRepository {
  id: string;
  repoFullName: string;
  defaultBranch: string;
  label: string | null;
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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [repos, setRepos] = useState<GhRepo[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  async function loadProjects() {
    const { projects: p } = await api<{ projects: Project[] }>("/api/projects");
    setProjects(p);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadRepos() {
    setLoadingRepos(true);
    try {
      const { repos: r } = await api<{ repos: GhRepo[] }>("/api/github/repos");
      setRepos(r);
      setSelectedRepos(new Set());
      setProjectName("");
      setProjectDescription("");
      setShowPicker(true);
    } catch {
      window.location.href = `${API_URL}/api/auth/github`;
    } finally {
      setLoadingRepos(false);
    }
  }

  function toggleRepo(fullName: string) {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  }

  async function createProject() {
    if (!projectName.trim()) {
      alert("Enter a project name.");
      return;
    }
    if (selectedRepos.size === 0) {
      alert("Select at least one repository.");
      return;
    }

    setCreating(true);
    try {
      const repositories = repos
        .filter((r) => selectedRepos.has(r.fullName))
        .map((r) => ({
          repoFullName: r.fullName,
          defaultBranch: r.defaultBranch,
          label: r.name,
        }));

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
      return project.repositories.map((r) => r.repoFullName);
    }
    if (project.repoFullName) return [project.repoFullName];
    return [];
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500">Group one or more GitHub repositories into a project</p>
        </div>
        <button
          onClick={loadRepos}
          disabled={loadingRepos}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          <Github className="h-4 w-4" />
          {loadingRepos ? "Loading…" : "Create Project"}
        </button>
      </header>

      {showPicker && (
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary-light/30 p-4">
          <p className="mb-3 text-sm font-medium text-gray-700">Create a project with one or more repositories</p>
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
          <p className="mb-2 text-xs text-gray-500">Select repositories (e.g. Admin and Frontend)</p>
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
          <div className="mt-3 flex gap-2">
            <button
              onClick={createProject}
              disabled={creating}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {creating ? "Creating…" : `Create (${selectedRepos.size} repo${selectedRepos.size === 1 ? "" : "s"})`}
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
          return (
            <div key={p.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{p.name}</p>
                  <ul className="mt-1 space-y-0.5">
                    {reposInProject.map((repo) => (
                      <li key={repo} className="text-sm text-gray-500">
                        {repo}
                      </li>
                    ))}
                  </ul>
                  {p.description && <p className="mt-2 text-sm text-gray-600">{p.description}</p>}
                  <p className="mt-2 text-xs text-gray-400">
                    {reposInProject.length} repo{reposInProject.length === 1 ? "" : "s"} · {p.openTickets} open tickets
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
