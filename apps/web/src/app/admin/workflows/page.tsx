"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { STATUS_LABELS } from "@ados/shared";
import { statusColor, cn } from "@/lib/utils";
import { QueueCollapsibleCard } from "@/components/QueueCollapsibleCard";
import { ExternalLink } from "lucide-react";

interface ActiveTicket {
  id: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  source: string;
  project: { name: string; repoFullName: string | null };
}

export default function WorkflowMonitorPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Workflow Monitor</h1>
        <p className="text-sm text-gray-500">Temporal orchestration visibility</p>
      </header>
      <div className="rounded-xl border border-gray-100 bg-white p-6">
        <p className="text-gray-600">
          Open Temporal UI for full workflow traces, retries, and activity logs:
        </p>
        <a
          href="http://localhost:8080"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Open Temporal UI
          <ExternalLink className="h-4 w-4" />
        </a>
        <div className="mt-6 rounded-lg bg-gray-50 p-4 font-mono text-xs text-gray-700">
          <p>Task Queue: ados-ticket-queue</p>
          <p>Namespace: default</p>
          <p>Address: localhost:7233</p>
        </div>
      </div>
      <ActiveTickets />
    </div>
  );
}

function ActiveTickets() {
  const [tickets, setTickets] = useState<ActiveTicket[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api<{ tickets: ActiveTicket[] }>("/api/tickets").then((d) =>
      setTickets(
        d.tickets.filter((t) => !["completed", "failed", "rejected", "pending"].includes(t.status))
      )
    );
  }, []);

  return (
    <div className="mt-6">
      <h2 className="mb-3 font-medium text-gray-900">Active runs</h2>
      {tickets.length === 0 ? (
        <p className="text-sm text-gray-500">No active workflows.</p>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const isExpanded = expanded === ticket.id;
            const statusLabel =
              STATUS_LABELS[ticket.status as keyof typeof STATUS_LABELS] ?? ticket.status;

            return (
              <QueueCollapsibleCard
                key={ticket.id}
                isExpanded={isExpanded}
                onToggle={() => setExpanded(isExpanded ? null : ticket.id)}
                borderClassName="border-gray-100"
                repoLabel={ticket.project.repoFullName ?? ticket.project.name}
                title={ticket.title}
                ticketHref={`/admin/tickets/${ticket.id}`}
                badge={
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", statusColor(ticket.status))}>
                    {statusLabel}
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
                  </div>
                }
                footer={
                  <Link
                    href={`/admin/tickets/${ticket.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View live ticket
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
