"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { DetailedPlan, FileChangePlan } from "@ados/shared";
import { normalizeDetailedPlan } from "@ados/shared";
import { cn } from "@/lib/utils";

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

function FileChangeCard({
  change,
  defaultExpanded = false,
}: {
  change: FileChangePlan;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-start gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 text-left hover:bg-gray-100/80"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900">{change.file}</p>
          <p className={cn("mt-1 text-sm text-gray-600", !expanded && "line-clamp-1")}>
            {change.plainSummary}
          </p>
        </div>
      </button>

      {expanded && (
        <>
          {change.whatWeWillRemove.length > 0 && (
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">
                Will remove
              </p>
              <ul className="space-y-1 text-sm text-gray-700">
                {change.whatWeWillRemove.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-red-500">−</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {change.whatWeWillAdd.length > 0 && (
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-700">
                Will add
              </p>
              <ul className="space-y-1 text-sm text-gray-700">
                {change.whatWeWillAdd.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-green-600">+</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {change.diffPreview && (
            <div className="bg-gray-900/5">
              <p className="border-b border-gray-100 px-4 py-2 text-xs font-semibold text-gray-500">
                Code preview (like Git diff)
              </p>
              <div className="max-h-80 overflow-x-auto overflow-y-auto">
                {change.diffPreview.split("\n").map((line, i) => (
                  <DiffLine key={`${line}-${i}`} line={line} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CollapsibleDiffSection({
  title,
  diff,
  defaultExpanded = false,
}: {
  title: string;
  diff: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section>
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="mb-3 flex w-full items-center gap-2 text-left"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
        )}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </button>
      {expanded && (
        <div className="max-h-[min(32rem,calc(100vh-18rem))] overflow-x-auto overflow-y-auto rounded-lg border border-gray-200 bg-gray-50">
          {diff.split("\n").map((line, i) => (
            <DiffLine key={`${line}-${i}`} line={line} />
          ))}
        </div>
      )}
    </section>
  );
}

export function PlanViewer({ plan, rawContent }: { plan?: DetailedPlan | null; rawContent?: string }) {
  if (plan) {
    return (
      <div className="space-y-6">
        <section className="rounded-xl border border-primary/20 bg-primary-light/30 p-5">
          <h3 className="mb-2 text-sm font-semibold text-primary">What we will do (plain English)</h3>
          <p className="text-sm leading-relaxed text-gray-800">{plan.plainLanguageSummary}</p>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Step-by-step approach</h3>
          <ol className="space-y-2">
            {plan.approach.map((step, i) => (
              <li key={step} className="flex gap-3 rounded-lg border border-gray-100 bg-white p-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-gray-700">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Files that will be changed ({plan.estimatedFiles.length})
          </h3>
          <p className="mb-3 text-xs text-gray-500">Click a file to expand planned changes.</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {plan.estimatedFiles.map((f) => (
              <span key={f} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                {f}
              </span>
            ))}
          </div>

          <div className="space-y-2">
            {plan.fileChanges.map((change) => (
              <FileChangeCard key={change.file} change={change} />
            ))}
          </div>
        </section>

        {plan.formattedDiff && (
          <CollapsibleDiffSection title="Full planned diff" diff={plan.formattedDiff} />
        )}
      </div>
    );
  }

  return (
    <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-800">
      {rawContent ?? "No plan yet. Run the agent to generate a fix plan."}
    </pre>
  );
}

export function parseDetailedPlan(content: string | undefined): DetailedPlan | null {
  if (!content) return null;
  try {
    return normalizeDetailedPlan(JSON.parse(content) as Partial<DetailedPlan>);
  } catch {
    return null;
  }
}
