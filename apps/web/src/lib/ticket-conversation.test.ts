import { describe, expect, it } from "vitest";
import { buildTicketConversation } from "./ticket-conversation";

describe("buildTicketConversation", () => {
  it("builds a timeline with ticket, prompts, plans, and changes", () => {
    const items = buildTicketConversation({
      title: "Add user card",
      body: "Show total users on dashboard",
      workflowRuns: [
        {
          id: "run1",
          status: "completed",
          startedAt: "2026-01-01T10:00:00Z",
          events: [
            { step: "plan", message: "Will add a card", createdAt: "2026-01-01T10:01:00Z" },
            { step: "changes", message: "Added card", createdAt: "2026-01-01T10:05:00Z" },
            { step: "done", message: "PR created", createdAt: "2026-01-01T10:10:00Z" },
          ],
          artifacts: [
            {
              type: "detailed-plan",
              content: JSON.stringify({
                plainLanguageSummary: "Plan",
                approach: [],
                estimatedFiles: ["src/page.tsx"],
                fileChanges: [],
                formattedDiff: "",
              }),
              createdAt: "2026-01-01T10:01:00Z",
            },
            {
              type: "change-summary",
              content: JSON.stringify({
                plainLanguageSummary: "Changes",
                files: [],
                formattedDiff: "",
              }),
              createdAt: "2026-01-01T10:05:00Z",
            },
          ],
        },
        {
          id: "run2",
          status: "failed",
          startedAt: "2026-01-02T10:00:00Z",
          events: [
            {
              step: "revision_requested",
              message: "Add purple border",
              createdAt: "2026-01-02T10:00:01Z",
            },
            { step: "plan", message: "Will update styling", createdAt: "2026-01-02T10:02:00Z" },
            { step: "failed", message: "git error", createdAt: "2026-01-02T10:03:00Z" },
          ],
          artifacts: [
            {
              type: "detailed-plan-revision-1",
              content: JSON.stringify({
                plainLanguageSummary: "Revision plan",
                approach: [],
                estimatedFiles: ["src/page.tsx"],
                fileChanges: [],
                formattedDiff: "",
              }),
              createdAt: "2026-01-02T10:02:00Z",
            },
          ],
        },
      ],
    });

    expect(items[0].kind).toBe("ticket");
    expect(items.some((i) => i.kind === "user_prompt" && i.message === "Add purple border")).toBe(true);
    expect(items.filter((i) => i.kind === "plan")).toHaveLength(2);
    expect(items.some((i) => i.kind === "changes")).toBe(true);
    expect(items.some((i) => i.kind === "run_start" && i.label === "Revision")).toBe(true);
  });
});
