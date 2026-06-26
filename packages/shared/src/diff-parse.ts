export interface ParsedDiffFile {
  file: string;
  diff: string;
}

/** Split unified git diff text (optionally with === repo === headers) into per-file chunks. */
export function parseUnifiedDiffByFile(diffSummary: string): ParsedDiffFile[] {
  if (!diffSummary || diffSummary === "(no git diff available)") return [];

  const files: ParsedDiffFile[] = [];
  let currentRepo = "";
  let currentFile = "";
  let currentLines: string[] = [];

  function flush() {
    if (!currentFile || currentLines.length === 0) return;
    const file = currentRepo ? `${currentRepo}::${currentFile}` : currentFile;
    files.push({ file, diff: currentLines.join("\n") });
    currentLines = [];
  }

  for (const line of diffSummary.split("\n")) {
    const repoHeader = line.match(/^=== (.+?) ===$/);
    if (repoHeader) {
      flush();
      currentFile = "";
      currentRepo = repoHeader[1];
      continue;
    }

    if (line.startsWith("diff --git ")) {
      flush();
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      currentFile = match?.[2] ?? line.replace(/^diff --git /, "");
      currentLines = [line];
      continue;
    }

    if (currentFile) {
      currentLines.push(line);
    }
  }

  flush();
  return files;
}

export function listChangedFilesFromDiff(diffSummary: string): string[] {
  return parseUnifiedDiffByFile(diffSummary).map((entry) => entry.file);
}

/** True when diff text contains actual hunks, not just repo headers or whitespace. */
export function isMeaningfulDiffText(diffSummary: string | undefined): boolean {
  if (!diffSummary || diffSummary === "(no git diff available)") {
    return false;
  }
  return diffSummary.split("\n").some((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("===")) {
      return false;
    }
    return (
      trimmed.startsWith("diff --git") ||
      trimmed.startsWith("@@") ||
      /^\d+ files? changed/.test(trimmed) ||
      trimmed.startsWith("+++") ||
      trimmed.startsWith("---")
    );
  });
}
