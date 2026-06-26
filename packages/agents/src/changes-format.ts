import type { AppliedChangeSummary } from "@ados/shared";

export function formatAppliedChanges(summary: AppliedChangeSummary): string {
  const sections: string[] = [];
  sections.push("═".repeat(60));
  sections.push("✅ WHAT CHANGED (plain language)");
  sections.push("═".repeat(60));
  sections.push(summary.plainLanguageSummary);
  sections.push("");
  sections.push("─".repeat(60));
  sections.push("📂 FILE-BY-FILE BREAKDOWN");
  sections.push("─".repeat(60));

  for (const file of summary.files) {
    sections.push("");
    sections.push(`📄 ${file.file}`);
    sections.push(`   Purpose: ${file.whatItDoes}`);
    sections.push("");
    sections.push("   BEFORE:");
    sections.push(`   ${file.beforeDescription}`);
    sections.push("");
    sections.push("   AFTER:");
    sections.push(`   ${file.afterDescription}`);
    if (file.diffPreview) {
      sections.push("");
      sections.push(file.diffPreview);
    }
  }

  if (summary.formattedDiff) {
    sections.push("");
    sections.push("═".repeat(60));
    sections.push("🔍 FULL CODE DIFF (technical view)");
    sections.push("═".repeat(60));
    sections.push(summary.formattedDiff);
  }

  return sections.join("\n");
}
