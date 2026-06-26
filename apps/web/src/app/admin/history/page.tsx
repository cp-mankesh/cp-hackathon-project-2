"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { statusColor, cn } from "@/lib/utils";

interface Ticket {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  project: { repoFullName: string };
}

export default function HistoryPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);

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
      <div className="space-y-2">
        {tickets.map((t) => (
          <Link
            key={t.id}
            href={`/admin/tickets/${t.id}`}
            className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 hover:border-primary/20"
          >
            <div>
              <p className="font-medium text-gray-900">{t.title}</p>
              <p className="text-xs text-gray-400">{t.project.repoFullName}</p>
            </div>
            <div className="text-right">
              <span className={cn("rounded-full px-2 py-0.5 text-xs", statusColor(t.status))}>
                {t.status}
              </span>
              <p className="mt-1 text-xs text-gray-400">
                {new Date(t.updatedAt).toLocaleString()}
              </p>
            </div>
          </Link>
        ))}
        {tickets.length === 0 && (
          <p className="text-center text-gray-500">No history yet.</p>
        )}
      </div>
    </div>
  );
}
