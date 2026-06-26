"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { statusColor, cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

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
  const [tickets, setTickets] = useState<Array<{ id: string; title: string; status: string }>>([]);

  useEffect(() => {
    api<{ tickets: Array<{ id: string; title: string; status: string }> }>("/api/tickets").then(
      (d) =>
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
        <div className="space-y-2">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/admin/tickets/${t.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50"
            >
              <span className="text-sm font-medium">{t.title}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs", statusColor(t.status))}>
                {t.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
