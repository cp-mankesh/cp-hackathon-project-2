import type { DetailedPlan, FileChangePlan } from "@ados/shared";
import { asStringList } from "@ados/shared";

export function formatFileChangeDiff(change: FileChangePlan): string {
  const adds = asStringList(change.whatWeWillAdd);
  const removes = asStringList(change.whatWeWillRemove);
  const lines: string[] = [];
  lines.push(`diff --git a/${change.file} b/${change.file}`);
  lines.push(`--- a/${change.file}`);
  lines.push(`+++ b/${change.file}`);
  lines.push(`@@ Planned changes @@`);
  lines.push(`  📄 ${change.plainSummary}`);
  if (removes.length > 0) {
    lines.push("");
    lines.push("  ❌ Will remove:");
    for (const line of removes) {
      lines.push(`  - ${line}`);
    }
  }
  if (adds.length > 0) {
    lines.push("");
    lines.push("  ✅ Will add:");
    for (const line of adds) {
      lines.push(`  + ${line}`);
    }
  }
  if (change.diffPreview) {
    lines.push("");
    lines.push(change.diffPreview);
  }
  return lines.join("\n");
}

export function formatDetailedPlan(plan: DetailedPlan): string {
  const sections: string[] = [];
  sections.push("═".repeat(60));
  sections.push("📋 PLAN SUMMARY (plain language)");
  sections.push("═".repeat(60));
  sections.push(plan.plainLanguageSummary);
  sections.push("");
  sections.push("─".repeat(60));
  sections.push("🛠️ HOW WE WILL FIX IT");
  sections.push("─".repeat(60));
  plan.approach.forEach((step, i) => sections.push(`${i + 1}. ${step}`));
  sections.push("");
  sections.push("─".repeat(60));
  sections.push(`📁 FILES THAT WILL BE TOUCHED (${plan.estimatedFiles.length})`);
  sections.push("─".repeat(60));
  plan.estimatedFiles.forEach((f) => sections.push(`  • ${f}`));
  sections.push("");
  sections.push("═".repeat(60));
  sections.push("📝 PLANNED CHANGES (preview — like Git diff)");
  sections.push("═".repeat(60));
  for (const change of plan.fileChanges) {
    sections.push("");
    sections.push(formatFileChangeDiff(change));
  }
  return sections.join("\n");
}
