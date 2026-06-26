import { describe, expect, it } from "vitest";
import { parseTestArtifacts } from "@/components/TestResultsViewer";
import { parseReviewArtifacts } from "@/components/ReviewNotesViewer";

describe("TestResultsViewer parsers", () => {
  it("parses structured JSON test artifacts", () => {
    const results = parseTestArtifacts([
      {
        type: "test-0",
        content: JSON.stringify({
          passed: false,
          command: "npm test",
          output: "=== owner/repo ===\nFAIL 1 test",
        }),
      },
    ]);
    expect(results[0].passed).toBe(false);
    expect(results[0].command).toBe("npm test");
    expect(results[0].label).toBe("Attempt 1");
  });

  it("parses legacy plain-text test output", () => {
    const results = parseTestArtifacts([
      {
        type: "test-1",
        content: "=== cp-mankesh/app ===\nAll tests passed",
      },
    ]);
    expect(results[0].output).toContain("All tests passed");
  });
});

describe("ReviewNotesViewer parsers", () => {
  it("parses review JSON artifacts", () => {
    const reviews = parseReviewArtifacts([
      {
        type: "review-0",
        content: JSON.stringify({
          approved: true,
          feedback: "Looks good",
          changesRequested: false,
        }),
      },
    ]);
    expect(reviews[0].approved).toBe(true);
    expect(reviews[0].feedback).toBe("Looks good");
    expect(reviews[0].label).toBe("Review round 1");
  });
});
