"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { STATUS_LABELS } from "@ados/shared";
import { statusColor, cn } from "@/lib/utils";
import { QueueCollapsibleCard } from "@/components/QueueCollapsibleCard";
import { ExternalLink } from "lucide-react";

interface Ticket {
  id: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  source: string;
  updatedAt: string;
  project: { repoFullName: string; name: string };
}

export default function HistoryPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api<{ tickets: Ticket[] }>("/api/tickets").then((d) =>
      setTickets(
        d.tickets.filter((t) => ["completed", "failed", "rejected", "pr_created"].includes(t.status))
      )
    );
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Run History</h1>
        <p className="text-sm text-gray-500">Completed and failed agent runs</p>
      </header>

      {tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-500">
          No history yet.
        </div>
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
                repoLabel={ticket.project.repoFullName}
                title={ticket.title}
                ticketHref={`/admin/tickets/${ticket.id}`}
                badge={
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", statusColor(ticket.status))}>
                    {statusLabel}
                  </span>
                }
                collapsedPreview={
                  <p className="text-xs text-gray-500">
                    {new Date(ticket.updatedAt).toLocaleString()} · click to expand
                  </p>
                }
                expandedContent={
                  <div className="space-y-3 pt-4">
                    {ticket.body ? (
                      <p className="whitespace-pre-wrap text-sm text-gray-700">{ticket.body}</p>
                    ) : (
                      <p className="text-sm text-gray-500">No description recorded.</p>
                    )}
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-gray-500">Project</dt>
                        <dd className="text-gray-800">{ticket.project.name}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">Updated</dt>
                        <dd className="text-gray-800">{new Date(ticket.updatedAt).toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">Priority</dt>
                        <dd className="text-gray-800">{ticket.priority}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">Source</dt>
                        <dd className="text-gray-800">{ticket.source}</dd>
                      </div>
                    </dl>
                  </div>
                }
                footer={
                  <Link
                    href={`/admin/tickets/${ticket.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View ticket details
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
