"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface ProjectRepository {
  repoFullName: string;
  label?: string | null;
}

interface Project {
  id: string;
  name: string;
  repoFullName: string | null;
  repositories: ProjectRepository[];
}

function projectLabel(p: Project) {
  if (p.repositories.length > 0) {
    return `${p.name} (${p.repositories.map((r) => r.repoFullName).join(", ")})`;
  }
  return p.repoFullName ?? p.name;
}

function hasRealRepos(p: Project) {
  const repos = p.repositories.length > 0 ? p.repositories : p.repoFullName ? [{ repoFullName: p.repoFullName }] : [];
  return repos.some((r) => r.repoFullName !== "demo/sample-app");
}

export default function NewTicketPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState({
    projectId: "",
    title: "",
    body: "",
    priority: "P2",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ projects: Project[] }>("/api/projects").then((d) => {
      const real = d.projects.filter(hasRealRepos);
      setProjects(real);
      if (real[0]) setForm((f) => ({ ...f, projectId: real[0].id }));
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { ticket } = await api<{ ticket: { id: string } }>("/api/tickets", {
        method: "POST",
        body: JSON.stringify({ ...form, source: "manual" }),
      });
      router.push(`/admin/tickets/${ticket.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <header className="mb-6">
        <Link href="/admin/tickets" className="text-sm text-primary hover:underline">
          ← Ticket Hub
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Add Ticket</h1>
      </header>

      <form onSubmit={submit} className="max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Project</label>
          <select
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            required
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {projectLabel(p)}
              </option>
            ))}
          </select>
          {form.projectId && (
            <p className="mt-1 text-xs text-gray-500">
              Agent will clone all repositories in this project when needed.
            </p>
          )}
          {projects.length === 0 && (
            <p className="mt-1 text-sm text-amber-600">
              <Link href="/admin/projects" className="underline">
                Create a project first
              </Link>
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={6}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Priority</label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {["P0", "P1", "P2", "P3"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving || !form.projectId}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create Ticket"}
        </button>
      </form>
    </div>
  );
}
