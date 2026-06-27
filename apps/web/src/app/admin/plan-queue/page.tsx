"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Check, MessageSquare, X } from "lucide-react";
import { PlanViewer, parseDetailedPlan } from "@/components/PlanViewer";
import { QueueCollapsibleCard } from "@/components/QueueCollapsibleCard";
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
        <div className="space-y-3">
          {runs.map((run) => {
            const plan = getPlan(run);
            const isExpanded = expanded === run.id;
            const fileCount = plan?.fileChanges.length ?? 0;

            return (
              <QueueCollapsibleCard
                key={run.id}
                isExpanded={isExpanded}
                onToggle={() => setExpanded(isExpanded ? null : run.id)}
                borderClassName="border-purple-100"
                hoverClassName="hover:bg-purple-50/40"
                repoLabel={run.ticket.project.repoFullName}
                title={run.ticket.title}
                ticketHref={`/admin/tickets/${run.ticket.id}`}
                badge={
                  <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                    Awaiting plan approval
                  </span>
                }
                collapsedDescription={run.ticket.body}
                collapsedPreview={
                  plan ? (
                    <>
                      <p className="line-clamp-2 text-sm text-gray-700">{plan.plainLanguageSummary}</p>
                      {fileCount > 0 && (
                        <p className="text-xs text-gray-500">
                          {fileCount} file{fileCount === 1 ? "" : "s"} in plan · click to expand
                        </p>
                      )}
                    </>
                  ) : null
                }
                expandedContent={
                  <>
                    <p className="pt-4 text-sm text-gray-600">{run.ticket.body}</p>
                    {plan && (
                      <div className="mt-4 rounded-lg border border-gray-100 p-4">
                        <PlanViewer plan={plan} />
                      </div>
                    )}
                    <textarea
                      placeholder="What should change in this plan? e.g. Also update dashboard-charts.tsx, use a bar chart not pie chart…"
                      value={revisionPrompt[run.id] ?? ""}
                      onChange={(e) =>
                        setRevisionPrompt({ ...revisionPrompt, [run.id]: e.target.value })
                      }
                      className="mt-4 w-full rounded-lg border border-purple-200 bg-purple-50/50 px-3 py-2 text-sm"
                      rows={3}
                    />
                  </>
                }
                footer={
                  <div className="flex flex-wrap gap-2">
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
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
