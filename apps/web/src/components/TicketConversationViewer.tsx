"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Bot, ChevronDown, ChevronRight, User } from "lucide-react";
import type { ConversationItem } from "@/lib/ticket-conversation";
import { PlanViewer } from "@/components/PlanViewer";
import { ChangeSummaryViewer } from "@/components/ChangeSummaryViewer";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString();
}

function stepTitle(step: string): string {
  const labels: Record<string, string> = {
    clone: "Cloned repositories",
    analyze: "Analyzed codebase",
    sync: "Synced agent branch",
    plan_approved: "Plan approved",
    branch: "Checked out branch",
    implement: "Implemented changes",
    test: "Ran tests",
    review: "Automated review",
    human_review: "Awaiting human review",
    approved: "Human review approved",
    done: "Pull request created",
    pr_updated: "Pull request updated",
    failed: "Failed",
  };
  return labels[step] ?? step.replace(/_/g, " ");
}

function ExpandableBlock({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-gray-800 hover:bg-gray-50"
      >
        <span>{title}</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <div className="border-t border-gray-100 p-3">{children}</div>}
    </div>
  );
}

export function TicketConversationViewer({ items }: { items: ConversationItem[] }) {
  if (items.length <= 1) {
    return (
      <p className="text-sm text-gray-500">
        Conversation will appear here once the agent starts working on this ticket.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        if (item.kind === "ticket") {
          return (
            <div key="ticket" className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Original ticket</p>
                  <p className="text-xs text-gray-500">{item.title}</p>
                </div>
              </div>
              {item.body ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{item.body}</p>
              ) : (
                <p className="text-sm text-gray-400">No description provided.</p>
              )}
            </div>
          );
        }

        if (item.kind === "run_start") {
          return (
            <div key={`run-${item.runIndex}`} className="flex items-center gap-3 pt-2">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {item.label}
                <span className="ml-2 font-normal text-gray-500">{formatTime(item.startedAt)}</span>
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
          );
        }

        if (item.kind === "user_prompt") {
          return (
            <div key={`prompt-${index}`} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <User className="h-4 w-4 text-blue-700" />
              </div>
              <div className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
                  {item.label}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                  {item.message}
                </p>
                <p className="mt-2 text-xs text-blue-600/70">{formatTime(item.createdAt)}</p>
              </div>
            </div>
          );
        }

        if (item.kind === "plan") {
          const fileCount = item.plan?.fileChanges.length ?? 0;
          return (
            <div key={`plan-${index}`} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100">
                <Bot className="h-4 w-4 text-purple-700" />
              </div>
              <div className="min-w-0 flex-1 rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-purple-800">
                  Agent plan
                </p>
                <p className="mt-2 text-sm leading-relaxed text-gray-800">{item.summary}</p>
                <p className="mt-1 text-xs text-purple-700/70">{formatTime(item.createdAt)}</p>
                <ExpandableBlock
                  title={`View full plan${fileCount > 0 ? ` (${fileCount} files)` : ""}`}
                  defaultOpen={fileCount > 0 && fileCount <= 3}
                >
                  <PlanViewer plan={item.plan} rawContent={item.rawPlan} />
                </ExpandableBlock>
              </div>
            </div>
          );
        }

        if (item.kind === "changes") {
          const fileCount = item.changeSummary?.files.length ?? 0;
          return (
            <div key={`changes-${index}`} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100">
                <Bot className="h-4 w-4 text-green-700" />
              </div>
              <div className="min-w-0 flex-1 rounded-xl border border-green-200 bg-green-50/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-800">
                  Changes applied
                </p>
                <p className="mt-2 text-sm leading-relaxed text-gray-800">{item.summary}</p>
                <p className="mt-1 text-xs text-green-700/70">{formatTime(item.createdAt)}</p>
                <ExpandableBlock
                  title={`View all file changes${fileCount > 0 ? ` (${fileCount} files)` : ""}`}
                  defaultOpen={fileCount > 0 && fileCount <= 3}
                >
                  <ChangeSummaryViewer summary={item.changeSummary} />
                </ExpandableBlock>
              </div>
            </div>
          );
        }

        if (item.kind === "event") {
          return (
            <div key={`event-${index}`} className="flex gap-3 pl-11">
              <div
                className={cn(
                  "min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm",
                  item.highlight
                    ? item.step === "failed"
                      ? "border-red-200 bg-red-50 text-red-900"
                      : "border-green-200 bg-green-50 text-green-900"
                    : "border-gray-100 bg-gray-50 text-gray-700"
                )}
              >
                <span className="font-medium">{stepTitle(item.step)}</span>
                <span className="mx-2 text-gray-300">·</span>
                <span>{item.message}</span>
                <p className="mt-1 text-xs opacity-70">{formatTime(item.createdAt)}</p>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
