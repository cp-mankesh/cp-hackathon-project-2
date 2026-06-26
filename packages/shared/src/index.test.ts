import { describe, expect, it } from "vitest";
import {
  AGENT_MAX_RETRIES,
  AGENT_MAX_REVIEW_ROUNDS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TEMPORAL_TASK_QUEUE,
} from "@ados/shared";

describe("@ados/shared", () => {
  it("exposes agent retry defaults", () => {
    expect(AGENT_MAX_RETRIES).toBeGreaterThan(0);
    expect(AGENT_MAX_REVIEW_ROUNDS).toBeGreaterThan(0);
  });

  it("defines temporal task queue", () => {
    expect(TEMPORAL_TASK_QUEUE).toBeTruthy();
  });

  it("maps all priority labels", () => {
    expect(PRIORITY_LABELS.P0).toBe("Critical");
    expect(PRIORITY_LABELS.P1).toBe("Important");
    expect(PRIORITY_LABELS.P2).toBe("Standard");
    expect(PRIORITY_LABELS.P3).toBe("Low");
  });

  it("maps all ticket status labels", () => {
    expect(STATUS_LABELS.pending).toBe("Pending");
    expect(STATUS_LABELS.awaiting_human_review).toBe("Awaiting Review");
    expect(STATUS_LABELS.completed).toBe("Completed");
    expect(STATUS_LABELS.rejected).toBe("Rejected");
  });
});
