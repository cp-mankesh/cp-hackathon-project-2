"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { STATUS_LABELS } from "@ados/shared";
import { QueueCollapsibleCard } from "@/components/QueueCollapsibleCard";
import { Play } from "lucide-react";

interface ProjectRepository {
  repoFullName: string;
}

interface QueueTicket {
  id: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  source: string;
  project: {
    name: string;
    repoFullName: string | null;
    repositories: ProjectRepository[];
  };
}

function projectLabel(ticket: QueueTicket) {
  if (ticket.project.repositories.length > 0) {
    return ticket.project.repositories.map((r) => r.repoFullName).join(", ");
  }
  return ticket.project.repoFullName ?? ticket.project.name;
}

export default function QueuePage() {
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api<{ tickets: QueueTicket[] }>("/api/tickets").then((d) =>
      setTickets(d.tickets.filter((t) => t.status === "pending"))
    );
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Document Queue</h1>
        <p className="text-sm text-gray-500">Tickets waiting to be picked up by agents</p>
      </header>

      {tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-500">
          Queue is empty.
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const isExpanded = expanded === ticket.id;

            return (
              <QueueCollapsibleCard
                key={ticket.id}
                isExpanded={isExpanded}
                onToggle={() => setExpanded(isExpanded ? null : ticket.id)}
                borderClassName="border-gray-100"
                repoLabel={projectLabel(ticket)}
                title={ticket.title}
                ticketHref={`/admin/tickets/${ticket.id}`}
                badge={
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {STATUS_LABELS[ticket.status as keyof typeof STATUS_LABELS] ?? ticket.status}
                  </span>
                }
                collapsedPreview={
                  <p className="text-xs text-gray-500">
                    {ticket.priority} · {ticket.source} · click to expand
                  </p>
                }
                expandedContent={
                  <div className="space-y-3 pt-4">
                    {ticket.body ? (
                      <p className="whitespace-pre-wrap text-sm text-gray-700">{ticket.body}</p>
                    ) : (
                      <p className="text-sm text-gray-500">No description provided.</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5">{ticket.priority}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5">{ticket.source}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5">{ticket.project.name}</span>
                    </div>
                  </div>
                }
                footer={
                  <Link
                    href={`/admin/tickets/${ticket.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
                  >
                    <Play className="h-4 w-4" />
                    Open Ticket & Create Plan
                  </Link>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
