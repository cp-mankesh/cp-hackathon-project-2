"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Check, MessageSquare, X } from "lucide-react";
import { PlanViewer, parseDetailedPlan } from "@/components/PlanViewer";
import type { DetailedPlan } from "@ados/shared";

interface PlanRun {
  id: string;
  startedAt: string;
  ticket: {
    id: string;
    title: string;
    body: string;
    status: string;
    project: { repoFullName: string };
  };
  artifacts: Array<{ type: string; content: string }>;
}

export default function PlanQueuePage() {
  const [runs, setRuns] = useState<PlanRun[]>([]);
  const [revisionPrompt, setRevisionPrompt] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    const { runs: r } = await api<{ runs: PlanRun[] }>("/api/plan-queue");
    setRuns(r);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  async function approve(runId: string) {
    setActing(runId);
    try {
      await api(`/api/plan-queue/${runId}/approve`, {
        method: "POST",
        body: "{}",
      });
      await load();
    } finally {
      setActing(null);
    }
  }

  async function revise(runId: string) {
    const prompt = revisionPrompt[runId]?.trim();
    if (!prompt) {
      alert("Describe what you want changed in the plan.");
      return;
    }
    setActing(runId);
    try {
      await api(`/api/plan-queue/${runId}/revise`, {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });
      setRevisionPrompt({ ...revisionPrompt, [runId]: "" });
      await load();
    } finally {
      setActing(null);
    }
  }

  async function reject(runId: string) {
    setActing(runId);
    try {
      await api(`/api/plan-queue/${runId}/reject`, {
        method: "POST",
        body: "{}",
      });
      await load();
    } finally {
      setActing(null);
    }
  }

  function getPlan(run: PlanRun): DetailedPlan | null {
    const detailed = run.artifacts.find((a) => a.type === "detailed-plan");
    return parseDetailedPlan(detailed?.content);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Plan Queue</h1>
        <p className="text-sm text-gray-500">
          Review the fix plan before any code changes. Request changes to refine the plan, or
          approve to start implementation.
        </p>
      </header>

      {runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-500">
          No plans awaiting approval.
        </div>
      ) : (
        <div className="space-y-6">
          {runs.map((run) => {
            const plan = getPlan(run);
            const isExpanded = expanded === run.id;

            return (
              <div key={run.id} className="rounded-xl border border-purple-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-400">{run.ticket.project.repoFullName}</p>
                    <Link
                      href={`/admin/tickets/${run.ticket.id}`}
                      className="font-medium text-gray-900 hover:text-primary"
                    >
                      {run.ticket.title}
                    </Link>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600">{run.ticket.body}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                    Awaiting plan approval
                  </span>
                </div>

                {plan && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium text-gray-700">
                      {plan.plainLanguageSummary}
                    </p>
                    <p className="mb-2 text-xs text-gray-500">
                      {plan.fileChanges.length} file{plan.fileChanges.length === 1 ? "" : "s"} in this plan
                    </p>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : run.id)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {isExpanded ? "Hide full plan" : "Show full plan with file changes"}
                    </button>
                    {isExpanded && (
                      <div className="mt-4 rounded-lg border border-gray-100 p-4">
                        <PlanViewer plan={plan} />
                      </div>
                    )}
                  </div>
                )}

                <textarea
                  placeholder="What should change in this plan? e.g. Also update dashboard-charts.tsx, use a bar chart not pie chart…"
                  value={revisionPrompt[run.id] ?? ""}
                  onChange={(e) => setRevisionPrompt({ ...revisionPrompt, [run.id]: e.target.value })}
                  className="mt-4 w-full rounded-lg border border-purple-200 bg-purple-50/50 px-3 py-2 text-sm"
                  rows={3}
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => revise(run.id)}
                    disabled={acting === run.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-purple-800 hover:bg-purple-50 disabled:opacity-50"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Request Plan Changes
                  </button>
                  <button
                    onClick={() => approve(run.id)}
                    disabled={acting === run.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Approve Plan & Start Fix
                  </button>
                  <button
                    onClick={() => reject(run.id)}
                    disabled={acting === run.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Reject Plan
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
