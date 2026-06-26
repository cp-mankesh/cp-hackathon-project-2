import { describe, expect, it } from "vitest";
import { normalizeDetailedPlan, asStringList } from "../src/plan-normalize";

describe("plan-normalize", () => {
  it("coerces string fields to string arrays", () => {
    expect(asStringList("single item")).toEqual(["single item"]);
    expect(asStringList(["a", "b"])).toEqual(["a", "b"]);
    expect(asStringList(undefined)).toEqual([]);
  });

  it("normalizes malformed file change plans from AI", () => {
    const plan = normalizeDetailedPlan({
      plainLanguageSummary: "Test",
      approach: "step one",
      estimatedFiles: ["a.ts"],
      fileChanges: [
        {
          file: "src/app/page.tsx",
          plainSummary: "Dashboard page",
          whatWeWillAdd: "Add a chart component",
          whatWeWillRemove: "",
          diffPreview: "",
        },
      ],
    });

    expect(plan.fileChanges[0].whatWeWillAdd).toEqual(["Add a chart component"]);
    expect(plan.fileChanges[0].whatWeWillRemove).toEqual([]);
    expect(plan.approach).toEqual(["step one"]);
  });
});
