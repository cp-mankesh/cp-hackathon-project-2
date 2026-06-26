"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL, api } from "@/lib/api";
import { Github, Zap, ArrowRight, FolderGit2 } from "lucide-react";

interface PublicProject {
  id: string;
  name: string;
  repoFullName: string;
  description: string | null;
  _count: { tickets: number };
}

export default function LandingPage() {
  const [projects, setProjects] = useState<PublicProject[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/projects/public`)
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-purple-50/30">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">AI Engineer Hub</p>
              <p className="text-xs text-gray-500">Autonomous Delivery App</p>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
              Sign in
            </Link>
            <a
              href={`${API_URL}/api/auth/github`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              <Github className="h-4 w-4" />
              Connect GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
            Ship software with{" "}
            <span className="text-primary">autonomous agents</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Ingest tickets from GitHub, Jira, or your portal. Temporal orchestrates
            OpenHands agents to plan, implement, test, and open PRs — with human
            approval before merge.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-hover"
            >
              Open Admin Panel
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={`${API_URL}/api/auth/github`}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
            >
              <Github className="h-4 w-4" />
              Connect GitHub
            </a>
          </div>
        </section>

        <section className="mt-20">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Connected Projects</h2>
            <span className="text-sm text-gray-500">{projects.length} repositories</span>
          </div>
          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
              <FolderGit2 className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 text-gray-500">No connected projects yet.</p>
              <a
                href={`${API_URL}/api/auth/github`}
                className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
              >
                Connect your first repository →
              </a>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md"
                >
                  <p className="font-medium text-gray-900">{p.name}</p>
                  <p className="text-sm text-gray-500">{p.repoFullName}</p>
                  {p.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600">{p.description}</p>
                  )}
                  <p className="mt-3 text-xs text-gray-400">{p._count.tickets} tickets</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            { title: "Ticket Sources", desc: "GitHub Issues, Jira, or manual tickets in one hub." },
            { title: "Temporal Workflows", desc: "Durable orchestration with dev/QA and review loops." },
            { title: "Human Review Gate", desc: "Approve in Review Queue before push and PR creation." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-gray-100 bg-white p-6">
              <h3 className="font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
