"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { cn, statusColor } from "@/lib/utils";
import { Play, ExternalLink, Check, X, MessageSquare } from "lucide-react";
import { STATUS_LABELS } from "@ados/shared";
import { PlanViewer, parseDetailedPlan } from "@/components/PlanViewer";
import { ChangeSummaryViewer, parseChangeSummary } from "@/components/ChangeSummaryViewer";
import { TicketConversationViewer } from "@/components/TicketConversationViewer";
import { TestResultsViewer } from "@/components/TestResultsViewer";
import { ReviewNotesViewer } from "@/components/ReviewNotesViewer";
import { buildTicketConversation } from "@/lib/ticket-conversation";

interface ProjectRepository {
  repoFullName: string;
  label?: string | null;
}

interface TicketDetail {
  id: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  source: string;
  branchName: string | null;
  project: { name: string; repoFullName: string | null; repositories: ProjectRepository[] };
  pullRequests: Array<{ url: string | null; branch: string; repoFullName: string }>;
  workflowRuns: Array<{
    id: string;
    status: string;
    startedAt: string;
    currentStep: string | null;
    events: Array<{ step: string; message: string; createdAt: string }>;
    artifacts: Array<{ type: string; content: string; createdAt: string }>;
  }>;
}

export default function TicketDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [tab, setTab] = useState<"conversation" | "plan" | "changes" | "tests" | "review">("conversation");
  const [running, setRunning] = useState(false);
  const [revisionPrompt, setRevisionPrompt] = useState("");
  const [postPrRevisionPrompt, setPostPrRevisionPrompt] = useState("");
  const [acting, setActing] = useState(false);

  async function load() {
    const { ticket: t } = await api<{ ticket: TicketDetail }>(`/api/tickets/${id}`);
    setTicket(t);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [id]);

  async function runWorkflow() {
    setRunning(true);
    try {
      await api(`/api/tickets/${id}/run`, { method: "POST", body: "{}" });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to start agent");
    } finally {
      setRunning(false);
    }
  }

  async function approvePlan(runId: string) {
    setActing(true);
    try {
      await api(`/api/plan-queue/${runId}/approve`, {
        method: "POST",
        body: "{}",
      });
      await load();
    } finally {
      setActing(false);
    }
  }

  async function revisePlan(runId: string) {
    const prompt = revisionPrompt.trim();
    if (!prompt) {
      alert("Describe what you want changed in the plan.");
      return;
    }
    setActing(true);
    try {
      await api(`/api/plan-queue/${runId}/revise`, {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });
      setRevisionPrompt("");
      await load();
    } finally {
      setActing(false);
    }
  }

  async function requestPostPrRevision() {
    const prompt = postPrRevisionPrompt.trim();
    if (!prompt) {
      alert("Describe what you want changed in the plan or code.");
      return;
    }
    setActing(true);
    try {
      await api(`/api/tickets/${id}/revise`, {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });
      setPostPrRevisionPrompt("");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to start revision");
    } finally {
      setActing(false);
    }
  }

  async function rejectPlan(runId: string) {
    setActing(true);
    try {
      await api(`/api/plan-queue/${runId}/reject`, {
        method: "POST",
        body: "{}",
      });
      await load();
    } finally {
      setActing(false);
    }
  }

  if (!ticket) {
    return <div className="p-6 text-gray-500">Loading…</div>;
  }

  const run = ticket.workflowRuns[0];
  const allArtifacts = ticket.workflowRuns.flatMap((r) => r.artifacts);
  const detailedPlanArtifact = [...allArtifacts].reverse().find((a) => a.type === "detailed-plan");
  const planArtifact = [...allArtifacts].reverse().find((a) => a.type === "plan");
  const changeSummaryArtifact = [...allArtifacts].reverse().find((a) => a.type === "change-summary");
  const testArtifacts = ticket.workflowRuns.flatMap((r) =>
    r.artifacts
      .filter((a) => a.type.startsWith("test"))
      .map((a) => ({ type: a.type, content: a.content, createdAt: a.createdAt }))
  );
  const reviewArtifacts = ticket.workflowRuns.flatMap((r) =>
    r.artifacts
      .filter((a) => a.type.startsWith("review"))
      .map((a) => ({ type: a.type, content: a.content, createdAt: a.createdAt }))
  );

  const detailedPlan = parseDetailedPlan(detailedPlanArtifact?.content);
  const changeSummary = parseChangeSummary(changeSummaryArtifact?.content);

  const conversationItems = buildTicketConversation({
    title: ticket.title,
    body: ticket.body,
    workflowRuns: ticket.workflowRuns,
  });

  const projectRepos =
    ticket.project.repositories.length > 0
      ? ticket.project.repositories
      : ticket.project.repoFullName
        ? [{ repoFullName: ticket.project.repoFullName }]
        : [];
  const hasPr = ticket.pullRequests.some((pr) => pr.url);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <nav className="mb-2 text-sm text-gray-500">
          <Link href="/admin/tickets" className="hover:text-primary">
            Ticket Hub
          </Link>
          <span className="mx-2">›</span>
          <span>{ticket.project.name}</span>
        </nav>

        <header className="mb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">{ticket.title}</h1>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusColor(ticket.status))}>
                {STATUS_LABELS[ticket.status as keyof typeof STATUS_LABELS]}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-primary">{ticket.project.name}</p>
            <ul className="mt-1 space-y-0.5">
              {projectRepos.map((r) => (
                <li key={r.repoFullName} className="text-xs text-gray-500">
                  {r.repoFullName}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400">
              Agent clones {projectRepos.length} repo{projectRepos.length === 1 ? "" : "s"} for this project
            </p>
          </div>
          {["pending", "failed", "rejected"].includes(ticket.status) && (
            <button
              onClick={runWorkflow}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {running ? "Starting…" : "Create Plan"}
            </button>
          )}
          {["completed", "pr_created"].includes(ticket.status) && hasPr && (
            <button
              onClick={() => {
                setTab("conversation");
                document.getElementById("post-pr-revision")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
            >
              <MessageSquare className="h-4 w-4" />
              Request Revision
            </button>
          )}
          {["claimed", "cloning", "planning", "awaiting_plan_approval", "implementing", "testing", "reviewing"].includes(
            ticket.status
          ) && (
            <button
              onClick={async () => {
                if (!confirm("Cancel the running agent for this ticket?")) return;
                try {
                  await api(`/api/tickets/${id}/cancel`, { method: "POST", body: "{}" });
                  await load();
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Failed to cancel");
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
              Cancel Plan
            </button>
          )}
        </header>

        {(ticket.status === "awaiting_plan_approval" || run?.currentStep === "plan_revise") && run && (
          <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
            <p className="text-sm font-medium text-purple-900">
              {run.currentStep === "plan_revise"
                ? "Updating the plan based on your feedback…"
                : "A fix plan is ready for your review. No code has been changed yet."}
            </p>
            <p className="mt-1 text-sm text-purple-800">
              Read the Plan tab, then request changes, approve to start the fix, or reject to cancel.
            </p>
            {ticket.status === "awaiting_plan_approval" && (
              <>
                <textarea
                  placeholder="What should change in this plan? e.g. Include dashboard page components, add a bar chart…"
                  value={revisionPrompt}
                  onChange={(e) => setRevisionPrompt(e.target.value)}
                  className="mt-3 w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm"
                  rows={3}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => revisePlan(run.id)}
                    disabled={acting}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-white px-4 py-2 text-sm font-medium text-purple-800 hover:bg-purple-100 disabled:opacity-50"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Request Plan Changes
                  </button>
                  <button
                    onClick={() => approvePlan(run.id)}
                    disabled={acting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Approve Plan & Start Fix
                  </button>
                  <button
                    onClick={() => rejectPlan(run.id)}
                    disabled={acting}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Reject Plan
                  </button>
                  <Link
                    href="/admin/plan-queue"
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-purple-700 hover:underline"
                  >
                    Open Plan Queue
                  </Link>
                </div>
              </>
            )}
          </div>
        )}

        {ticket.status === "awaiting_human_review" && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Implementation is done. Approve in the{" "}
            <Link href="/admin/review" className="font-medium underline">
              Review Queue
            </Link>{" "}
            before a pull request is created.
          </div>
        )}

        {["completed", "pr_created"].includes(ticket.status) && hasPr && (
          <div
            id="post-pr-revision"
            className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4"
          >
            <p className="text-sm font-medium text-blue-900">Revise plan &amp; update PR</p>
            <p className="mt-1 text-sm text-blue-800">
              Request changes after delivery. The agent keeps full activity history and prior code
              context, then updates the existing pull request — nothing is cleared from the log.
            </p>
            <textarea
              placeholder="What should change? e.g. Make the Total Users card larger, use the same icon style as other cards…"
              value={postPrRevisionPrompt}
              onChange={(e) => setPostPrRevisionPrompt(e.target.value)}
              className="mt-3 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
              rows={3}
            />
            <button
              onClick={requestPostPrRevision}
              disabled={acting}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              <MessageSquare className="h-4 w-4" />
              Start Revision (plan → approve → update PR)
            </button>
          </div>
        )}

        {ticket.pullRequests.length > 0 && (
          <div className="mb-4 space-y-2">
            {ticket.pullRequests.map((pr) =>
              pr.url ? (
                <div
                  key={pr.repoFullName}
                  className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
                >
                  PR ({pr.repoFullName}):{" "}
                  <a href={pr.url} target="_blank" rel="noreferrer" className="font-medium underline">
                    {pr.url}
                    <ExternalLink className="ml-1 inline h-3 w-3" />
                  </a>
                </div>
              ) : null
            )}
          </div>
        )}

        <div className="mb-4 flex gap-2 border-b border-gray-100">
          {(["conversation", "plan", "changes", "tests", "review"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm capitalize",
                tab === t ? "border-primary text-primary" : "border-transparent text-gray-500"
              )}
            >
              {t === "conversation"
                ? "Conversation"
                : t === "plan"
                  ? "Latest Plan"
                  : t === "changes"
                    ? "Latest Changes"
                    : t === "tests"
                      ? "Test Results"
                      : "Review Notes"}
            </button>
          ))}
        </div>

        <div className="prose prose-sm max-w-none max-h-[min(32rem,calc(100vh-18rem))] overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/30 p-4">
          {tab === "conversation" && <TicketConversationViewer items={conversationItems} />}
          {tab === "plan" && (
            <PlanViewer plan={detailedPlan} rawContent={planArtifact?.content ?? ticket.body} />
          )}
          {tab === "changes" && (
            <ChangeSummaryViewer summary={changeSummary} />
          )}
          {tab === "tests" && <TestResultsViewer artifacts={testArtifacts} />}
          {tab === "review" && <ReviewNotesViewer artifacts={reviewArtifacts} />}
        </div>
      </div>

      <aside className="w-64 border-l border-gray-100 bg-gray-50/50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">How it works</p>
        <ol className="space-y-2 text-xs text-gray-600">
          <li>1. Agent analyzes project repos</li>
          <li>2. You approve the fix plan</li>
          <li>3. Agent implements changes</li>
          <li>4. You review before PR</li>
          <li>5. After PR, request revisions anytime</li>
        </ol>
        {run && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Run</p>
            <p className="mt-1 text-sm text-gray-600">{run.status}</p>
            <p className="text-xs text-gray-400">{run.currentStep}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
