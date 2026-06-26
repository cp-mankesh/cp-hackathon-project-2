"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { cn, priorityColor, statusColor } from "@/lib/utils";
import { Plus, RefreshCw, Play } from "lucide-react";
import { STATUS_LABELS } from "@ados/shared";

interface ProjectRepository {
  repoFullName: string;
}

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  source: string;
  project: { name: string; repoFullName: string | null; repositories: ProjectRepository[] };
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

  useEffect(() => {
    load();
  }, []);

  async function runTicket(id: string) {
    try {
      await api(`/api/tickets/${id}/run`, { method: "POST", body: "{}" });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to start agent");
    }
  }

  const filtered =
    filter === "all" ? tickets : tickets.filter((t) => t.source === filter);

  const priorityCards = [
    { key: "P0", label: "P0 Critical", sub: "Core commerce" },
    { key: "P1", label: "P1 Important", sub: "Marketing & sales" },
    { key: "P2", label: "P2 Standard", sub: "SEO & catalog" },
    { key: "P3", label: "P3 Low", sub: "Ops & utilities" },
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
