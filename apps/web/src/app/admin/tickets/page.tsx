"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { cn, priorityColor, statusColor } from "@/lib/utils";
import { Plus, RefreshCw, Play, Github, ExternalLink } from "lucide-react";
import { STATUS_LABELS } from "@ados/shared";

interface ProjectRepository {
  repoFullName: string;
}

interface Project {
  id: string;
  name: string;
  repoFullName: string | null;
  repositories: ProjectRepository[];
}

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  source: string;
  project: { name: string; repoFullName: string | null; repositories: ProjectRepository[] };
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  htmlUrl: string;
  state: string;
  repoFullName: string;
  projectId: string;
  imported: boolean;
  ticketId?: string;
}

function projectSubtitle(p: Ticket["project"]) {
  if (p.repositories.length > 0) {
    return p.repositories.map((r) => r.repoFullName).join(", ");
  }
  return p.repoFullName ?? p.name;
}

export default function TicketHubPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState({ pending: 0, total: 0, withDocs: 0 });
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [hasGithub, setHasGithub] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [githubProjectId, setGithubProjectId] = useState("");
  const [githubIssues, setGithubIssues] = useState<GitHubIssue[]>([]);
  const [githubRepoCount, setGithubRepoCount] = useState(0);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubSyncing, setGithubSyncing] = useState(false);
  const [importingIssueKey, setImportingIssueKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        api<{ tickets: Ticket[] }>("/api/tickets"),
        api<typeof stats>("/api/tickets/stats"),
      ]);
      setTickets(tRes.tickets);
      setStats(sRes);
    } finally {
      setLoading(false);
    }
  }

  const loadGithubIssues = useCallback(async () => {
    if (!hasGithub) return;
    setGithubLoading(true);
    try {
      const query = githubProjectId ? `?projectId=${encodeURIComponent(githubProjectId)}` : "";
      const data = await api<{ issues: GitHubIssue[]; repoCount: number }>(
        `/api/github/issues${query}`
      );
      setGithubIssues(data.issues);
      setGithubRepoCount(data.repoCount);
    } catch (e) {
      setGithubIssues([]);
      setGithubRepoCount(0);
      alert(e instanceof Error ? e.message : "Failed to load GitHub issues");
    } finally {
      setGithubLoading(false);
    }
  }, [githubProjectId, hasGithub]);

  useEffect(() => {
    load();
    api<{ integrations: Array<{ type: string }> }>("/api/integrations")
      .then((d) => setHasGithub(d.integrations.some((i) => i.type === "github")))
      .catch(() => setHasGithub(false));
    api<{ projects: Project[] }>("/api/projects")
      .then((d) => setProjects(d.projects))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (filter === "github" && hasGithub) {
      loadGithubIssues();
    }
  }, [filter, hasGithub, loadGithubIssues]);

  async function runTicket(id: string) {
    try {
      await api(`/api/tickets/${id}/run`, { method: "POST", body: "{}" });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to start agent");
    }
  }

  async function syncGithubIssues() {
    setGithubSyncing(true);
    try {
      const body = githubProjectId ? { projectId: githubProjectId } : {};
      await api("/api/github/sync", { method: "POST", body: JSON.stringify(body) });
      await Promise.all([load(), loadGithubIssues()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to sync GitHub issues");
    } finally {
      setGithubSyncing(false);
    }
  }

  function githubIssueKey(issue: GitHubIssue) {
    return `${issue.repoFullName}-${issue.number}`;
  }

  async function importGithubIssue(issue: GitHubIssue) {
    const key = githubIssueKey(issue);
    setImportingIssueKey(key);
    try {
      await api("/api/github/import", {
        method: "POST",
        body: JSON.stringify({
          projectId: issue.projectId,
          repoFullName: issue.repoFullName,
          number: issue.number,
        }),
      });
      await Promise.all([load(), loadGithubIssues()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to import issue");
    } finally {
      setImportingIssueKey(null);
    }
  }

  const filtered =
    filter === "all" ? tickets : tickets.filter((t) => t.source === filter);

  const unimportedGithubIssues = githubIssues.filter((issue) => !issue.imported);

  const priorityCards = [
    { key: "P0", label: "Critical", sub: "Core commerce" },
    { key: "P1", label: "Important", sub: "Marketing & sales" },
    { key: "P2", label: "Standard", sub: "SEO & catalog" },
    { key: "P3", label: "Low", sub: "Ops & utilities" },
  ];

  const byPriority = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const t of tickets) {
    byPriority[t.priority as keyof typeof byPriority] += 1;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ticket Hub</h1>
          <p className="text-sm text-gray-500">Agent — ticket-driven delivery</p>
        </div>
        <Link
          href="/admin/tickets/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          Add Ticket
        </Link>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {priorityCards.map((c) => (
          <div key={c.key} className={`rounded-xl border p-4 ${priorityColor(c.key)}`}>
            <p className="text-sm font-medium">{c.label}</p>
            <p className="text-xl font-bold">{byPriority[c.key as keyof typeof byPriority]}</p>
            <p className="text-xs text-gray-500">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {["all", "manual", "github", "jira"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm capitalize",
              filter === f ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {f}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        {stats.pending} tickets pending · {stats.withDocs} / {stats.total} completed
      </p>

      {filter === "github" && (
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Github className="h-5 w-5 text-gray-700" />
              <div>
                <p className="font-medium text-gray-900">GitHub Issues</p>
                <p className="text-sm text-gray-500">
                  Open issues from repositories linked to your projects
                </p>
              </div>
            </div>
            {hasGithub && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={githubProjectId}
                  onChange={(e) => setGithubProjectId(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                >
                  <option value="">All projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={loadGithubIssues}
                  disabled={githubLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", githubLoading && "animate-spin")} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={syncGithubIssues}
                  disabled={githubSyncing || githubRepoCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", githubSyncing && "animate-spin")} />
                  {githubSyncing ? "Syncing…" : "Sync Issues"}
                </button>
              </div>
            )}
          </div>

          {!hasGithub ? (
            <p className="mt-4 text-sm text-gray-600">
              Connect GitHub in{" "}
              <Link href="/admin/settings" className="text-primary hover:underline">
                Settings
              </Link>{" "}
              to list and import issues.
            </p>
          ) : githubRepoCount === 0 ? (
            <p className="mt-4 text-sm text-gray-600">
              <Link href="/admin/projects" className="text-primary hover:underline">
                Create a project
              </Link>{" "}
              and link GitHub repositories to fetch issues.
            </p>
          ) : githubLoading ? (
            <p className="mt-4 text-sm text-gray-500">Loading GitHub issues…</p>
          ) : githubIssues.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No open issues found in linked repositories.</p>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-500">
                {githubIssues.length} open issue{githubIssues.length === 1 ? "" : "s"}
                {unimportedGithubIssues.length > 0
                  ? ` · ${unimportedGithubIssues.length} not yet imported`
                  : " · all imported"}
              </p>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {githubIssues.map((issue) => (
                  <div
                    key={`${issue.repoFullName}-${issue.number}`}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">
                        {issue.repoFullName} #{issue.number}
                      </p>
                      <p className="truncate text-sm font-medium text-gray-900">{issue.title}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href={issue.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-gray-600"
                        title="Open on GitHub"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      {issue.imported && issue.ticketId ? (
                        <Link
                          href={`/admin/tickets/${issue.ticketId}`}
                          className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 hover:bg-green-200"
                        >
                          Imported
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => importGithubIssue(issue)}
                          disabled={importingIssueKey === githubIssueKey(issue)}
                          className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                        >
                          {importingIssueKey === githubIssueKey(issue) ? "Importing…" : "Import"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {unimportedGithubIssues.length > 0 && (
                <p className="text-xs text-gray-500">
                  Use <span className="font-medium">Import</span> on a single issue, or{" "}
                  <span className="font-medium">Sync Issues</span> to import all open issues at once.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((ticket) => (
          <div
            key={ticket.id}
            className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-gray-400">{projectSubtitle(ticket.project)}</p>
                <Link
                  href={`/admin/tickets/${ticket.id}`}
                  className="font-medium text-gray-900 hover:text-primary"
                >
                  {ticket.title}
                </Link>
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusColor(ticket.status))}>
                {STATUS_LABELS[ticket.status as keyof typeof STATUS_LABELS] ?? ticket.status}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-400">{ticket.source}</span>
              <span className="text-xs font-medium text-gray-500">{ticket.priority}</span>
              {ticket.status === "pending" && (
                <button
                  onClick={() => runTicket(ticket.id)}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
                >
                  <Play className="h-3 w-3" />
                  Queue
                </button>
              )}
            </div>
          </div>
        ))}

        <Link
          href="/admin/tickets/new"
          className="flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 text-gray-400 hover:border-primary/40 hover:text-primary"
        >
          <Plus className="h-8 w-8" />
          <span className="mt-2 text-sm">Create a ticket</span>
        </Link>
      </div>
    </div>
  );
}
