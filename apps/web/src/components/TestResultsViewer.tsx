"use client";

import type { TestResult } from "@ados/shared";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, Terminal } from "lucide-react";

export interface TestArtifactItem {
  type: string;
  content: string;
  createdAt?: string;
}

function parseRepoSections(output: string): Array<{ repo: string; text: string }> {
  if (!output.includes("=== ") || !output.includes(" ===")) {
    return [{ repo: "", text: output }];
  }

  const sections: Array<{ repo: string; text: string }> = [];
  let currentRepo = "";
  let currentLines: string[] = [];

  function flush() {
    const text = currentLines.join("\n").trim();
    if (currentRepo || text) {
      sections.push({ repo: currentRepo, text: text || "(no output)" });
    }
    currentLines = [];
  }

  for (const line of output.split("\n")) {
    const header = line.match(/^=== (.+?) ===$/);
    if (header) {
      flush();
      currentRepo = header[1];
      continue;
    }
    currentLines.push(line);
  }
  flush();
  return sections;
}

function parseTestContent(type: string, content: string): TestResult & { label: string } {
  const attempt = type.match(/^test-(\d+)$/)?.[1];
  const label = attempt ? `Attempt ${Number(attempt) + 1}` : type;

  try {
    const parsed = JSON.parse(content) as TestResult;
    if (typeof parsed.output === "string") {
      return { ...parsed, label };
    }
  } catch {
    // plain text legacy artifact
  }

  const passed = !/fail|error/i.test(content) || /0 failed|passed|skipped/i.test(content);
  return {
    passed,
    output: content,
    command: "unknown",
    label,
  };
}

export function parseTestArtifacts(artifacts: TestArtifactItem[]) {
  return [...artifacts]
    .sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })
    .map((a) => ({
      ...parseTestContent(a.type, a.content),
      createdAt: a.createdAt,
    }));
}

export function TestResultsViewer({ artifacts }: { artifacts: TestArtifactItem[] }) {
  const results = parseTestArtifacts(artifacts);

  if (results.length === 0) {
    return <p className="text-sm text-gray-500">No test results yet.</p>;
  }

  return (
    <div className="space-y-4 not-prose">
      {results.map((result, index) => {
        const sections = parseRepoSections(result.output);
        return (
          <div key={`${result.label}-${index}`} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-900">{result.label}</span>
                {result.command && result.command !== "unknown" && result.command !== "none" && (
                  <span className="rounded bg-gray-200 px-2 py-0.5 font-mono text-xs text-gray-600">
                    {result.command}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  result.passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                )}
              >
                {result.passed ? (
                  <CheckCircle className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                {result.passed ? "Passed" : "Failed"}
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {sections.map((section) => (
                <div key={section.repo || "default"} className="p-4">
                  {section.repo && (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      {section.repo}
                    </p>
                  )}
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-900/5 p-3 font-mono text-xs leading-relaxed text-gray-800">
                    {section.text}
                  </pre>
                </div>
              ))}
            </div>

            {result.createdAt && (
              <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
                {new Date(result.createdAt).toLocaleString()}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
