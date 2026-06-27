"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Check, X } from "lucide-react";
import { ChangeSummaryViewer, parseChangeSummary } from "@/components/ChangeSummaryViewer";
import { PlanViewer, parseDetailedPlan } from "@/components/PlanViewer";
import { QueueCollapsibleCard } from "@/components/QueueCollapsibleCard";

interface ReviewRun {
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

export default function ReviewQueuePage() {
  const [runs, setRuns] = useState<ReviewRun[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    const { runs: r } = await api<{ runs: ReviewRun[] }>("/api/review-queue");
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
      await api(`/api/review-queue/${runId}/approve`, {
        method: "POST",
        body: "{}",
      });
      await load();
    } finally {
      setActing(null);
    }
  }

  async function reject(runId: string) {
    setActing(runId);
    try {
      await api(`/api/review-queue/${runId}/reject`, {
        method: "POST",
        body: "{}",
      });
      await load();
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Review Queue</h1>
        <p className="text-sm text-gray-500">
          Review what the agent changed before it creates a pull request
        </p>
      </header>

      {runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-500">
          No items awaiting review.
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const changeSummary = parseChangeSummary(
              run.artifacts.find((a) => a.type === "change-summary")?.content
            );
            const plan = parseDetailedPlan(
              run.artifacts.find((a) => a.type === "detailed-plan")?.content
            );
            const isExpanded = expanded === run.id;
            const fileCount = changeSummary?.files.length ?? plan?.fileChanges.length ?? 0;
            const summaryPreview =
              changeSummary?.plainLanguageSummary ?? plan?.plainLanguageSummary ?? null;

            return (
              <QueueCollapsibleCard
                key={run.id}
                isExpanded={isExpanded}
                onToggle={() => setExpanded(isExpanded ? null : run.id)}
                borderClassName="border-amber-100"
                hoverClassName="hover:bg-amber-50/40"
                repoLabel={run.ticket.project.repoFullName}
                title={run.ticket.title}
                ticketHref={`/admin/tickets/${run.ticket.id}`}
                badge={
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Awaiting approval
                  </span>
                }
                collapsedDescription={run.ticket.body}
                collapsedPreview={
                  <>
                    {summaryPreview && (
                      <p className="line-clamp-2 text-sm text-gray-700">{summaryPreview}</p>
                    )}
                    {fileCount > 0 && (
                      <p className="text-xs text-gray-500">
                        {fileCount} file{fileCount === 1 ? "" : "s"} changed · click to expand review
                      </p>
                    )}
                  </>
                }
                expandedContent={
                  <>
                    <p className="pt-4 text-sm text-gray-600">{run.ticket.body}</p>
                    {changeSummary ? (
                      <div className="mt-4 rounded-lg border border-gray-100 p-3">
                        <ChangeSummaryViewer summary={changeSummary} />
                      </div>
                    ) : plan ? (
                      <div className="mt-4 rounded-lg border border-gray-100 p-3">
                        <PlanViewer plan={plan} />
                      </div>
                    ) : null}
                  </>
                }
                footer={
                  <div className="flex gap-2">
                    <button
                      onClick={() => approve(run.id)}
                      disabled={acting === run.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      Approve & Create PR
                    </button>
                    <button
                      onClick={() => reject(run.id)}
                      disabled={acting === run.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      Reject
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
