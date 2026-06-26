import fs from "node:fs/promises";
import path from "node:path";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  "coverage",
  "build",
  ".turbo",
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".vue",
  ".py",
  ".go",
  ".java",
  ".rb",
]);

const META_ONLY_FILES = new Set(["package.json", "README.md", "package-lock.json", "pnpm-lock.yaml"]);

const UI_KEYWORDS = [
  "dashboard",
  "chart",
  "page",
  "component",
  "ui",
  "screen",
  "view",
  "layout",
  "modal",
  "form",
  "button",
  "table",
  "sidebar",
  "nav",
  "header",
  "footer",
  "widget",
  "graph",
  "plot",
];

export function extractSearchTerms(title: string, body: string): string[] {
  const text = `${title} ${body}`.toLowerCase();
  const terms = new Set<string>();

  for (const word of text.split(/[^a-z0-9]+/)) {
    if (word.length >= 3) terms.add(word);
  }

  for (const kw of UI_KEYWORDS) {
    if (text.includes(kw)) terms.add(kw);
  }

  return [...terms];
}

export function isUiFeatureTicket(title: string, body: string): boolean {
  const text = `${title} ${body}`.toLowerCase();
  return UI_KEYWORDS.some((kw) => text.includes(kw));
}

function scoreFilePath(relativePath: string, terms: string[]): number {
  const normalized = relativePath.toLowerCase().replace(/\\/g, "/");
  let score = 0;

  for (const term of terms) {
    if (normalized.includes(term)) score += 10;
  }

  if (/\/(page|layout)\.(tsx|jsx|ts|js)$/.test(normalized)) score += 8;
  if (/\/components?\//.test(normalized)) score += 6;
  if (/\.(tsx|jsx)$/.test(normalized)) score += 4;
  if (normalized.includes("/app/")) score += 3;
  if (normalized.includes("/src/")) score += 2;
  if (META_ONLY_FILES.has(path.basename(normalized))) score -= 5;

  return score;
}

export async function collectSourceFiles(workspacePath: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string, relative = ""): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(rel.replace(/\\/g, "/"));
      }
    }
  }

  await walk(workspacePath);
  return files;
}

export async function findRelevantSourceFiles(
  workspacePath: string,
  title: string,
  body: string,
  limit = 12
): Promise<string[]> {
  const terms = extractSearchTerms(title, body);
  const allFiles = await collectSourceFiles(workspacePath);

  const ranked = allFiles
    .map((file) => ({ file, score: scoreFilePath(file, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const selected = ranked.slice(0, limit).map((item) => item.file);

  if (isUiFeatureTicket(title, body)) {
    const dashboardFiles = allFiles.filter((f) => /dashboard|chart/i.test(f));
    for (const file of dashboardFiles) {
      if (!selected.includes(file) && selected.length < limit) {
        selected.push(file);
      }
    }
  }

  return selected;
}

export async function readFileSnippets(
  workspacePath: string,
  files: string[],
  maxCharsPerFile = 2500
): Promise<string> {
  const parts: string[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(workspacePath, file), "utf-8");
      parts.push(`--- ${file} ---\n${content.slice(0, maxCharsPerFile)}`);
    } catch {
      // skip unreadable
    }
  }

  return parts.join("\n\n") || "(no relevant file snippets)";
}

export function isMetaOnlyPlan(files: string[]): boolean {
  if (files.length === 0) return true;
  return files.every((f) => META_ONLY_FILES.has(path.basename(f)));
}

export function mergePlanFiles(planned: string[], required: string[]): string[] {
  const merged = [...planned];
  for (const file of required) {
    if (!merged.includes(file)) merged.push(file);
  }
  return merged;
}
