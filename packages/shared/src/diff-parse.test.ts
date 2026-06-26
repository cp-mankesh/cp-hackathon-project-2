import { describe, expect, it } from "vitest";
import { parseUnifiedDiffByFile } from "./diff-parse";
import { isMeaningfulDiffText } from "./diff-parse";

describe("parseUnifiedDiffByFile", () => {
  it("splits a single-repo unified diff", () => {
    const diff = `diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1 @@
-old
+new
diff --git a/src/b.ts b/src/b.ts
index 333..444 100644
--- a/src/b.ts
+++ b/src/b.ts
@@ -1 +1 @@
-foo
+bar`;

    const files = parseUnifiedDiffByFile(diff);
    expect(files).toHaveLength(2);
    expect(files[0].file).toBe("src/a.ts");
    expect(files[1].file).toBe("src/b.ts");
    expect(files[0].diff).toContain("+new");
    expect(files[1].diff).toContain("+bar");
  });

  it("prefixes files with repo headers in multi-repo diffs", () => {
    const diff = `=== owner/frontend ===
diff --git a/src/page.tsx b/src/page.tsx
--- a/src/page.tsx
+++ b/src/page.tsx
@@ -1 +1 @@
-a
+b`;

    const files = parseUnifiedDiffByFile(diff);
    expect(files).toHaveLength(1);
    expect(files[0].file).toBe("owner/frontend::src/page.tsx");
  });
});

describe("isMeaningfulDiffText", () => {
  it("rejects repo-only headers", () => {
    expect(isMeaningfulDiffText("=== owner/repo ===\n\n")).toBe(false);
  });

  it("accepts unified diff content", () => {
    expect(
      isMeaningfulDiffText(`diff --git a/a.ts b/a.ts\n@@ -1 +1 @@\n-old\n+new`)
    ).toBe(true);
  });
});
