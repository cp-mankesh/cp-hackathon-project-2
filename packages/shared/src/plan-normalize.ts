import type { DetailedPlan, FileChangePlan } from "./index";

export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.length > 0);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

export function normalizeFileChangePlan(
  change: Partial<FileChangePlan> & { file: string }
): FileChangePlan {
  return {
    file: change.file,
    plainSummary: change.plainSummary ?? "",
    whatWeWillAdd: asStringList(change.whatWeWillAdd),
    whatWeWillRemove: asStringList(change.whatWeWillRemove),
    diffPreview: typeof change.diffPreview === "string" ? change.diffPreview : "",
  };
}

export function normalizeDetailedPlan(plan: Partial<DetailedPlan>): DetailedPlan {
  const fileChanges = (plan.fileChanges ?? []).map((change) =>
    normalizeFileChangePlan({
      file: change?.file ?? "unknown",
      plainSummary: change?.plainSummary,
      whatWeWillAdd: change?.whatWeWillAdd,
      whatWeWillRemove: change?.whatWeWillRemove,
      diffPreview: change?.diffPreview,
    })
  );

  const estimatedFiles = asStringList(plan.estimatedFiles);
  const mergedFiles = [
    ...new Set([...fileChanges.map((c) => c.file), ...estimatedFiles]),
  ];

  const fileChangeByPath = new Map(fileChanges.map((c) => [c.file, c]));
  for (const file of mergedFiles) {
    if (!fileChangeByPath.has(file)) {
      fileChangeByPath.set(
        file,
        normalizeFileChangePlan({
          file,
          plainSummary: `Planned updates for ${file}`,
          whatWeWillAdd: ["Changes required to complete this ticket"],
          whatWeWillRemove: [],
          diffPreview: "",
        })
      );
    }
  }

  const syncedFileChanges = mergedFiles.map((file) => fileChangeByPath.get(file)!);

  return {
    plainLanguageSummary: plan.plainLanguageSummary ?? "",
    approach: asStringList(plan.approach),
    estimatedFiles: mergedFiles,
    fileChanges: syncedFileChanges,
    formattedDiff: plan.formattedDiff ?? "",
  };
}
