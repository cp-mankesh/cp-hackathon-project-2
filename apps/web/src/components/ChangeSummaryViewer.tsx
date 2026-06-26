"use client";

import type { AppliedChangeSummary } from "@ados/shared";
import { isMeaningfulDiffText } from "@ados/shared";

function DiffLine({ line }: { line: string }) {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("-") && !trimmed.startsWith("---")) {
    return <div className="bg-red-50 px-3 py-0.5 font-mono text-xs text-red-800">{line}</div>;
  }
  if (trimmed.startsWith("+") && !trimmed.startsWith("+++")) {
    return <div className="bg-green-50 px-3 py-0.5 font-mono text-xs text-green-800">{line}</div>;
  }
  if (line.startsWith("@@") || line.startsWith("diff --git")) {
    return <div className="bg-blue-50 px-3 py-0.5 font-mono text-xs font-medium text-blue-800">{line}</div>;
  }
  return <div className="px-3 py-0.5 font-mono text-xs text-gray-600">{line}</div>;
}

export function ChangeSummaryViewer({
  summary,
  rawContent,
}: {
  summary?: AppliedChangeSummary | null;
  rawContent?: string;
}) {
  if (summary) {
    return (
      <div className="space-y-6">
        <section className="rounded-xl border border-green-200 bg-green-50 p-5">
          <h3 className="mb-2 text-sm font-semibold text-green-800">What changed (plain English)</h3>
          <p className="text-sm leading-relaxed text-gray-800">{summary.plainLanguageSummary}</p>
        </section>

        {summary.files.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              File-by-file breakdown ({summary.files.length} file{summary.files.length === 1 ? "" : "s"})
            </h3>
            <div className="space-y-4">
              {summary.files.map((file) => (
                <div key={file.file} className="overflow-hidden rounded-lg border border-gray-200">
                  <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="font-medium text-gray-900">📄 {file.file}</p>
                    <p className="mt-1 text-sm text-gray-500">{file.whatItDoes}</p>
                  </div>
                  <div className="grid gap-0 md:grid-cols-2">
                    <div className="border-b border-gray-100 p-4 md:border-b-0 md:border-r">
                      <p className="mb-2 text-xs font-semibold uppercase text-red-700">Before</p>
                      <p className="text-sm text-gray-700">{file.beforeDescription}</p>
                    </div>
                    <div className="p-4">
                      <p className="mb-2 text-xs font-semibold uppercase text-green-700">After</p>
                      <p className="text-sm text-gray-700">{file.afterDescription}</p>
                    </div>
                  </div>
                  {file.diffPreview && (
                    <div className="border-t border-gray-100 bg-gray-900/5">
                      <p className="border-b border-gray-100 px-4 py-2 text-xs font-semibold text-gray-500">
                        Code diff for this file
                      </p>
                      <div className="overflow-x-auto">
                        {file.diffPreview.split("\n").map((line, i) => (
                          <DiffLine key={`${line}-${i}`} line={line} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {isMeaningfulDiffText(summary.formattedDiff) ? (
          <section>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Full code diff (all files)</h3>
            <div className="max-h-[min(32rem,calc(100vh-18rem))] overflow-x-auto overflow-y-auto rounded-lg border border-gray-200 bg-gray-50">
              {summary.formattedDiff!.split("\n").map((line, i) => (
                <DiffLine key={`${line}-${i}`} line={line} />
              ))}
            </div>
          </section>
        ) : summary.files.length === 0 ? (
          <section className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
            No file-level diff was captured for this run. Open the ticket conversation tab for
            implementation details, or re-run after the agent modifies tracked source files.
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-800">
      {rawContent ?? "Changes will appear here after the agent finishes implementing the approved plan."}
    </pre>
  );
}

export function parseChangeSummary(content: string | undefined): AppliedChangeSummary | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as AppliedChangeSummary;
  } catch {
    return null;
  }
}
