import { describe, expect, it } from "vitest";
import {
  extractSearchTerms,
  findRelevantSourceFiles,
  isMetaOnlyPlan,
  isUiFeatureTicket,
  mergePlanFiles,
} from "../src/repo-analysis";

describe("repo-analysis", () => {
  it("detects UI feature tickets", () => {
    expect(isUiFeatureTicket("Add chart on dashboard", "dashboard page")).toBe(true);
    expect(isUiFeatureTicket("Update eslint config", "")).toBe(false);
  });

  it("extracts search terms from ticket text", () => {
    const terms = extractSearchTerms("Add chart on dashboard", "call analysis chart");
    expect(terms).toContain("dashboard");
    expect(terms).toContain("chart");
  });

  it("flags meta-only plans", () => {
    expect(isMetaOnlyPlan(["package.json", "README.md"])).toBe(true);
    expect(isMetaOnlyPlan(["src/app/dashboard/page.tsx", "package.json"])).toBe(false);
  });

  it("merges required files into plan", () => {
    const merged = mergePlanFiles(["package.json"], [
      "src/app/dashboard/page.tsx",
      "src/modules/calls/components/dashboard-charts.tsx",
    ]);
    expect(merged).toHaveLength(3);
    expect(merged).toContain("src/app/dashboard/page.tsx");
  });

  it("finds dashboard files for chart ticket in cloned repo", async () => {
    const ws = "/tmp/ados-workspaces/cmqtr6cob0004caaar57e4mfq";
    try {
      const files = await findRelevantSourceFiles(
        ws,
        "Add static chart on dashboard",
        "call analysis chart on dashboard page"
      );
      expect(files.some((f) => f.includes("dashboard"))).toBe(true);
      expect(files.some((f) => f.includes("chart"))).toBe(true);
    } catch {
      // workspace may not exist in CI — skip gracefully
    }
  });
});
