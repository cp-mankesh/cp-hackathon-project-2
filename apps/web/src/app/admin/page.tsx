"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { priorityColor } from "@/lib/utils";
import { ArrowRight, Plus } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    byPriority: { P0: 0, P1: 0, P2: 0, P3: 0 },
    pending: 0,
    total: 0,
    withDocs: 0,
  });
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    api<typeof stats>("/api/tickets/stats").then(setStats);
    api<{ runs: unknown[] }>("/api/review-queue").then((d) => setReviewCount(d.runs.length));
  }, []);

  const cards = [
    { key: "P0", label: "P0 Critical", sub: "Core commerce" },
    { key: "P1", label: "P1 Important", sub: "Marketing & sales" },
    { key: "P2", label: "P2 Standard", sub: "SEO & catalog" },
    { key: "P3", label: "P3 Low", sub: "Ops & utilities" },
  ] as const;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Autonomous Delivery App overview</p>
      </header>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.key} className={`rounded-xl border p-4 ${priorityColor(c.key)}`}>
            <p className="text-sm font-medium text-gray-700">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {stats.byPriority[c.key]}
            </p>
            <p className="text-xs text-gray-500">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/admin/tickets"
          className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm hover:border-primary/30"
        >
          <p className="font-medium text-gray-900">Ticket Hub</p>
          <p className="mt-1 text-2xl font-bold text-primary">{stats.total}</p>
          <p className="text-sm text-gray-500">{stats.pending} pending</p>
        </Link>
        <Link
          href="/admin/review"
          className="rounded-xl border border-amber-100 bg-amber-50/50 p-5 shadow-sm hover:border-amber-200"
        >
          <p className="font-medium text-gray-900">Review Queue</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{reviewCount}</p>
          <p className="text-sm text-gray-500">Awaiting approval</p>
        </Link>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="font-medium text-gray-900">Completed</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{stats.withDocs}</p>
          <p className="text-sm text-gray-500">With PR / docs</p>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href="/admin/tickets/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          Add Ticket
        </Link>
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Connect Repository
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
