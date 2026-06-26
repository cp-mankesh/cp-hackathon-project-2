import type { AppliedChangeSummary, DetailedPlan } from "@ados/shared";
import { parseChangeSummary } from "@/components/ChangeSummaryViewer";
import { parseDetailedPlan } from "@/components/PlanViewer";

export interface WorkflowRunData {
  id: string;
  status: string;
  startedAt: string;
  events: Array<{ step: string; message: string; createdAt: string }>;
  artifacts: Array<{ type: string; content: string; createdAt: string }>;
}

export type ConversationItem =
  | { kind: "ticket"; title: string; body: string }
  | { kind: "run_start"; runIndex: number; label: string; startedAt: string; status: string }
  | { kind: "user_prompt"; message: string; label: string; createdAt: string; runIndex: number }
  | {
      kind: "plan";
      summary: string;
      plan: DetailedPlan | null;
      rawPlan?: string;
      createdAt: string;
      runIndex: number;
    }
  | {
      kind: "changes";
      summary: string;
      changeSummary: AppliedChangeSummary | null;
      createdAt: string;
      runIndex: number;
    }
  | { kind: "event"; step: string; message: string; createdAt: string; runIndex: number; highlight?: boolean };

const USER_PROMPT_STEPS = new Set(["revision_requested", "plan_revision"]);
const SKIP_STEPS = new Set(["claimed", "plan_approval"]);

function extractUserPrompt(step: string, message: string): string {
  if (step === "revision_requested") return message;
  const prefix = message.match(/^Revising plan \(round \d+\): /);
  if (prefix) return message.slice(prefix[0].length);
  return message;
}

function userPromptLabel(step: string): string {
  if (step === "revision_requested") return "Post-PR revision request";
  if (step === "plan_revision") return "Plan change request";
  return "Your feedback";
}

function runLabel(index: number, total: number): string {
  if (index === 0) return "Initial delivery";
  if (total === 2) return "Revision";
  return `Revision ${index}`;
}

export function buildTicketConversation(input: {
  title: string;
  body: string;
  workflowRuns: WorkflowRunData[];
}): ConversationItem[] {
  const items: ConversationItem[] = [
    { kind: "ticket", title: input.title, body: input.body },
  ];

  const runs = [...input.workflowRuns].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  runs.forEach((run, runIndex) => {
    items.push({
      kind: "run_start",
      runIndex,
      label: runLabel(runIndex, runs.length),
      startedAt: run.startedAt,
      status: run.status,
    });

    const planArtifacts = run.artifacts
      .filter((a) => a.type === "detailed-plan" || a.type.startsWith("detailed-plan-"))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    let planArtifactIndex = 0;

    const changeArtifact = [...run.artifacts]
      .reverse()
      .find((a) => a.type === "change-summary");

    const formattedPlanArtifact = run.artifacts.find((a) => a.type === "plan");

    for (const event of run.events) {
      if (SKIP_STEPS.has(event.step)) continue;

      if (USER_PROMPT_STEPS.has(event.step)) {
        items.push({
          kind: "user_prompt",
          message: extractUserPrompt(event.step, event.message),
          label: userPromptLabel(event.step),
          createdAt: event.createdAt,
          runIndex,
        });
        continue;
      }

      if (event.step === "plan") {
        const artifact = planArtifacts[planArtifactIndex];
        planArtifactIndex += 1;
        items.push({
          kind: "plan",
          summary: event.message,
          plan: parseDetailedPlan(artifact?.content),
          rawPlan: artifact?.content ?? formattedPlanArtifact?.content,
          createdAt: event.createdAt,
          runIndex,
        });
        continue;
      }

      if (event.step === "changes") {
        items.push({
          kind: "changes",
          summary: event.message,
          changeSummary: parseChangeSummary(changeArtifact?.content),
          createdAt: event.createdAt,
          runIndex,
        });
        continue;
      }

      const highlight = ["done", "pr_updated", "approved", "failed", "plan_approved"].includes(
        event.step
      );

      items.push({
        kind: "event",
        step: event.step,
        message: event.message,
        createdAt: event.createdAt,
        runIndex,
        highlight,
      });
    }
  });

  return items;
}
