import { describe, expect, it } from "vitest";
import { cn, priorityColor, statusColor } from "@/lib/utils";

describe("web utils", () => {
  it("cn merges class names", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("statusColor returns known status classes", () => {
    expect(statusColor("completed")).toContain("green");
    expect(statusColor("failed")).toContain("red");
    expect(statusColor("awaiting_human_review")).toContain("amber");
  });

  it("statusColor falls back for unknown status", () => {
    expect(statusColor("unknown")).toBe("bg-gray-100 text-gray-600");
  });

  it("priorityColor returns known priority classes", () => {
    expect(priorityColor("P0")).toContain("red");
    expect(priorityColor("P2")).toContain("blue");
  });
});
