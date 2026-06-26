"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function QueuePage() {
  const [tickets, setTickets] = useState<Array<{ id: string; title: string; status: string }>>([]);

  useEffect(() => {
    api<{ tickets: Array<{ id: string; title: string; status: string }> }>("/api/tickets").then(
      (d) => setTickets(d.tickets.filter((t) => t.status === "pending"))
    );
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Document Queue</h1>
        <p className="text-sm text-gray-500">Tickets waiting to be picked up by agents</p>
      </header>
      <div className="space-y-2">
        {tickets.map((t) => (
          <Link
            key={t.id}
            href={`/admin/tickets/${t.id}`}
            className="block rounded-xl border border-gray-100 bg-white px-4 py-3 hover:border-primary/20"
          >
            <p className="font-medium text-gray-900">{t.title}</p>
            <p className="text-xs text-gray-400">{t.status}</p>
          </Link>
        ))}
        {tickets.length === 0 && (
          <p className="text-center text-gray-500">Queue is empty.</p>
        )}
      </div>
    </div>
  );
}
