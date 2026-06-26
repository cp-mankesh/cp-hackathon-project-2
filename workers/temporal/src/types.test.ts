import { describe, expect, it } from "vitest";
import { approvePlanSignal, approveReviewSignal, rejectPlanSignal, rejectReviewSignal, revisePlanSignal } from "../src/types";

describe("temporal workflow types", () => {
  it("defines review signal names", () => {
    expect(approveReviewSignal).toBe("approveReview");
    expect(rejectReviewSignal).toBe("rejectReview");
    expect(approvePlanSignal).toBe("approvePlan");
    expect(rejectPlanSignal).toBe("rejectPlan");
    expect(revisePlanSignal).toBe("revisePlan");
  });
});
