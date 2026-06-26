import OpenAI from "openai";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  AppliedChangeSummary,
  DetailedPlan,
  FileChangePlan,
  ImplementResult,
  PlanResult,
  ReviewResult,
} from "@ados/shared";
import { formatDetailedPlan } from "./plan-format";
import { formatAppliedChanges } from "./changes-format";
import {
  isMetaOnlyPlan,
  isUiFeatureTicket,
  mergePlanFiles,
} from "./repo-analysis";
import { normalizeDetailedPlan, normalizeFileChangePlan, parseUnifiedDiffByFile } from "@ados/shared";

const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function fallbackDetailedPlan(input: {
  title: string;
  body: string;
  filesToModify: string[];
  steps: string[];
}): DetailedPlan {
  const fileChanges: FileChangePlan[] = input.filesToModify.map((file) => ({
    file,
    plainSummary: `This file may need updates to address: ${input.title}`,
    whatWeWillAdd: ["New logic or content related to the ticket"],
    whatWeWillRemove: ["Outdated or incorrect code, if any"],
    diffPreview: [
      `--- a/${file}`,
      `+++ b/${file}`,
      `@@ planned @@`,
      `- (existing code that no longer fits)`,
      `+ (new code to fix the issue)`,
    ].join("\n"),
  }));

  const plan: DetailedPlan = {
    plainLanguageSummary: `We will fix "${input.title}" by updating ${input.filesToModify.length} file(s) in the project.`,
    approach: input.steps,
    estimatedFiles: input.filesToModify,
    fileChanges,
    formattedDiff: "",
  };
  plan.formattedDiff = formatDetailedPlan(plan);
  return plan;
}

export async function generateDetailedPlan(input: {
  title: string;
  body: string;
  fileTree: string;
  keyFiles: string;
  relevantFiles?: string[];
  revisionNotes?: string;
  previousPlan?: string;
  conversationHistory?: string;
  previousChangeSummary?: string;
  previousDiffSummary?: string;
}): Promise<DetailedPlan> {
  const basic = await generatePlan(input);

  const client = getClient();
  if (!client) {
    const files = mergePlanFiles(basic.filesToModify, input.relevantFiles ?? []);
    return fallbackDetailedPlan({
      title: input.title,
      body: input.body,
      filesToModify: files,
      steps: basic.steps,
    });
  }

  const systemPrompt = `You are a senior software planner explaining changes to non-technical stakeholders.

CRITICAL RULES:
1. Map the ticket to REAL source files from the file tree — especially pages, components, and modules.
2. For UI features (dashboard, chart, page, component, screen): you MUST include the actual page/component files that implement that UI. Do NOT plan only package.json or README.md unless the ticket is purely about dependencies or documentation.
3. estimatedFiles and fileChanges must list the same impacted source files (minimum 1 non-meta file for feature tickets).
4. When the file tree includes multiple repositories, prefix EVERY file path as owner/repo::relative/path (example: cp-mankesh/admin-app::src/pages/Dashboard.tsx).
5. Read "Relevant source files" snippets — plan concrete edits there (what to add/remove in plain English + diff preview).
6. EVERY file in estimatedFiles MUST appear in fileChanges with a non-empty diffPreview.

Return JSON with:
- plainLanguageSummary: string (2-4 sentences, no jargon)
- approach: string[] (steps in plain English)
- estimatedFiles: string[] (paths from the repo)
- fileChanges: array of { file, plainSummary, whatWeWillAdd, whatWeWillRemove, diffPreview }
  diffPreview: unified diff style (- removals, + additions)`;

  const revisionBlock = input.revisionNotes
    ? `\n\n--- PLAN REVISION REQUESTED ---\nReviewer feedback (apply this to the updated plan):\n${input.revisionNotes}\n\nPrevious plan to revise:\n${input.previousPlan ?? "(not available)"}`
    : "";

  const historyBlock = input.conversationHistory
    ? `\n\n--- PRIOR ACTIVITY LOG (do not discard; build on this context) ---\n${input.conversationHistory.slice(0, 12000)}`
    : "";

  const priorChangesBlock = [
    input.previousChangeSummary
      ? `\n\n--- PREVIOUS CHANGE SUMMARY ---\n${input.previousChangeSummary.slice(0, 6000)}`
      : "",
    input.previousDiffSummary
      ? `\n\n--- PREVIOUS CODE DIFF ---\n${input.previousDiffSummary.slice(0, 8000)}`
      : "",
  ].join("");

  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Ticket: ${input.title}\n\nDescription:\n${input.body}\n\nLikely relevant files (use these):\n${(input.relevantFiles ?? []).join("\n") || "(none scored)"}\n\nFile tree:\n${input.fileTree}\n\nKey files and snippets:\n${input.keyFiles}${revisionBlock}${historyBlock}${priorChangesBlock}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<DetailedPlan>;

  let estimatedFiles = parsed.estimatedFiles ?? basic.filesToModify;
  let fileChanges = (parsed.fileChanges ?? []).map((change) =>
    normalizeFileChangePlan({
      file: change?.file ?? "unknown",
      plainSummary: change?.plainSummary,
      whatWeWillAdd: change?.whatWeWillAdd,
      whatWeWillRemove: change?.whatWeWillRemove,
      diffPreview: change?.diffPreview,
    })
  );

  if (input.relevantFiles?.length) {
    estimatedFiles = mergePlanFiles(estimatedFiles, input.relevantFiles);
  }

  const needsSourceFiles =
    isUiFeatureTicket(input.title, input.body) && isMetaOnlyPlan(estimatedFiles);

  if (needsSourceFiles && input.relevantFiles?.length) {
    estimatedFiles = mergePlanFiles(estimatedFiles, input.relevantFiles);
  }

  if (fileChanges.length === 0 && estimatedFiles.length > 0) {
    fileChanges = estimatedFiles.map((file) => ({
      file,
      plainSummary: `Updates needed for this ticket`,
      whatWeWillAdd: ["Code to implement the requested fix"],
      whatWeWillRemove: [],
      diffPreview: "",
    }));
  }

  const plannedFiles = new Set(fileChanges.map((c) => c.file));
  for (const file of estimatedFiles) {
    if (!plannedFiles.has(file)) {
      fileChanges.push({
        file,
        plainSummary: `Changes required to complete: ${input.title}`,
        whatWeWillAdd: ["Implementation aligned with the ticket"],
        whatWeWillRemove: [],
        diffPreview: "",
      });
    }
  }

  const plan = normalizeDetailedPlan({
    plainLanguageSummary: parsed.plainLanguageSummary ?? basic.summary,
    approach: parsed.approach ?? basic.steps,
    estimatedFiles,
    fileChanges,
    formattedDiff: "",
  });

  plan.formattedDiff = formatDetailedPlan(plan);
  return plan;
}

export async function summarizeAppliedChanges(input: {
  title: string;
  body: string;
  diffSummary: string;
}): Promise<AppliedChangeSummary> {
  const parsedDiffFiles = parseUnifiedDiffByFile(input.diffSummary);
  const client = getClient();

  function buildFilesFromDiff(
    aiFiles: AppliedChangeSummary["files"] = []
  ): AppliedChangeSummary["files"] {
    const aiByFile = new Map(aiFiles.map((f) => [f.file, f]));
    return parsedDiffFiles.map((parsed) => {
      const ai = aiByFile.get(parsed.file);
      return {
        file: parsed.file,
        whatItDoes: ai?.whatItDoes ?? `Code changes in ${parsed.file}`,
        beforeDescription: ai?.beforeDescription ?? "Previous version before this fix",
        afterDescription: ai?.afterDescription ?? "Updated to address the ticket",
        diffPreview: parsed.diff,
      };
    });
  }

  if (!input.diffSummary || input.diffSummary === "(no git diff available)") {
    return {
      plainLanguageSummary:
        "The agent applied changes to the codebase. See the technical diff below for details.",
      files: [],
      formattedDiff: input.diffSummary,
    };
  }

  if (!client) {
    return {
      plainLanguageSummary: `The agent updated ${parsedDiffFiles.length} file(s) for this ticket.`,
      files: buildFilesFromDiff(),
      formattedDiff: input.diffSummary,
    };
  }

  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Explain code changes to a non-technical person.
Return JSON with:
- plainLanguageSummary: string (what was fixed overall, plain English)
- files: array of { file, whatItDoes, beforeDescription, afterDescription }
  Include ONE entry per changed file listed below. file path must match exactly.
  beforeDescription/afterDescription: plain English, no code jargon`,
      },
      {
        role: "user",
        content: `Ticket: ${input.title}\n${input.body}\n\nChanged files:\n${parsedDiffFiles.map((f) => f.file).join("\n")}\n\nGit diff (excerpt):\n${input.diffSummary.slice(0, 24000)}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<AppliedChangeSummary>;

  const files = buildFilesFromDiff(parsed.files ?? []);

  return {
    plainLanguageSummary:
      parsed.plainLanguageSummary ??
      `The agent updated ${files.length} file(s) for this ticket.`,
    files,
    formattedDiff: input.diffSummary,
  };
}

export function formatChangeSummaryForDisplay(summary: AppliedChangeSummary): string {
  return formatAppliedChanges(summary);
}

export async function implementCodeWithOpenAI(input: {
  workspacePath: string;
  plan: string;
  ticketTitle: string;
  ticketBody: string;
  reviewFeedback?: string;
  conversationHistory?: string;
  previousChangeSummary?: string;
  previousDiffSummary?: string;
}): Promise<ImplementResult> {
  const client = getClient();
  if (!client) {
    return {
      success: false,
      filesChanged: [],
      summary: "OPENAI_API_KEY is not configured.",
    };
  }

  let estimatedFiles: string[] = [];
  try {
    const parsed = JSON.parse(input.plan) as DetailedPlan;
    estimatedFiles = parsed.estimatedFiles ?? [];
    if (parsed.fileChanges?.length) {
      estimatedFiles = [
        ...new Set([...estimatedFiles, ...parsed.fileChanges.map((c) => c.file)]),
      ];
    }
  } catch {
    // plan may be plain text
  }

  const targetFiles = estimatedFiles.filter(
    (f) => f && f !== "unknown" && !/^README/i.test(f)
  );
  if (targetFiles.length === 0) {
    return {
      success: false,
      filesChanged: [],
      summary: "No target source files found in the approved plan.",
    };
  }

  const fileContents: Record<string, string> = {};
  for (const file of targetFiles.slice(0, 6)) {
    try {
      fileContents[file] = await fs.readFile(path.join(input.workspacePath, file), "utf-8");
    } catch {
      fileContents[file] = "";
    }
  }

  const contextBlock = [
    input.conversationHistory
      ? `\n\nPrior activity log (preserve context from earlier rounds):\n${input.conversationHistory.slice(0, 10000)}`
      : "",
    input.previousChangeSummary
      ? `\n\nPrevious change summary:\n${input.previousChangeSummary.slice(0, 6000)}`
      : "",
    input.previousDiffSummary
      ? `\n\nPrevious code diff (build on these files; do not revert unless asked):\n${input.previousDiffSummary.slice(0, 8000)}`
      : "",
  ].join("");

  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a senior software engineer implementing an approved plan.
Return JSON: { "summary": string, "files": [{ "path": string, "content": string }] }
- path must be one of the provided file paths exactly
- content is the COMPLETE updated file (valid syntax, keep imports and style)
- Implement the ticket fully; do not leave TODO stubs`,
      },
      {
        role: "user",
        content: `Ticket: ${input.ticketTitle}\n${input.ticketBody}\n\nApproved plan:\n${input.plan.slice(0, 10_000)}${
          input.reviewFeedback ? `\n\nReview feedback to address:\n${input.reviewFeedback}` : ""
        }${contextBlock}\n\nCurrent files:\n${Object.entries(fileContents)
          .map(([file, content]) => `--- ${file} ---\n${content.slice(0, 8000)}`)
          .join("\n\n")}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as {
    summary?: string;
    files?: Array<{ path: string; content: string }>;
  };

  const filesChanged: string[] = [];
  for (const file of parsed.files ?? []) {
    if (!file.path || file.content == null) continue;
    const fullPath = path.join(input.workspacePath, file.path);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.content, "utf-8");
    filesChanged.push(file.path);
  }

  const meaningful = filesChanged.some((f) => path.basename(f) !== "AGENT_WORKLOG.md");
  return {
    success: meaningful && filesChanged.length > 0,
    filesChanged,
    summary: parsed.summary ?? `Updated ${filesChanged.join(", ")}`,
  };
}

export async function generatePlan(input: {
  title: string;
  body: string;
  fileTree: string;
  keyFiles: string;
}): Promise<PlanResult> {
  const client = getClient();
  if (!client) {
    return {
      summary: `Implement: ${input.title}`,
      steps: [
        "Analyze existing code structure",
        "Implement the requested change",
        "Add or update tests",
        "Verify build passes",
      ],
      filesToModify: ["src/index.ts", "README.md"],
    };
  }

  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a senior software planner. Return JSON with keys: summary (string), steps (string[]), filesToModify (string[]). filesToModify MUST include actual source files (pages, components, modules) from the file tree that implement the ticket — not only package.json or README unless the ticket is docs/deps only.",
      },
      {
        role: "user",
        content: `Ticket: ${input.title}\n\nDescription:\n${input.body}\n\nFile tree:\n${input.fileTree}\n\nKey files:\n${input.keyFiles}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as PlanResult;
  return {
    summary: parsed.summary ?? input.title,
    steps: parsed.steps ?? [],
    filesToModify: parsed.filesToModify ?? [],
  };
}

export async function reviewCode(input: {
  title: string;
  body: string;
  plan: string;
  diffSummary: string;
  testOutput: string;
}): Promise<ReviewResult> {
  const client = getClient();
  if (!client) {
    const onlyStub =
      !input.diffSummary ||
      input.diffSummary === "(no git diff available)" ||
      (/AGENT_WORKLOG\.md/.test(input.diffSummary) &&
        !/diff --git a\/(?!AGENT_WORKLOG)/.test(input.diffSummary));

    if (onlyStub) {
      return {
        approved: false,
        feedback:
          "No meaningful source code changes detected. Configure OPENAI_API_KEY for real implementation.",
        changesRequested: true,
      };
    }

    const passed = !input.testOutput.toLowerCase().includes("fail");
    return {
      approved: passed,
      feedback: passed
        ? "Automated review passed (no OpenAI key — heuristic mode)."
        : "Tests appear to have failed.",
      changesRequested: !passed,
    };
  }

  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a code reviewer. Return JSON: approved (boolean), feedback (string), changesRequested (boolean).",
      },
      {
        role: "user",
        content: `Ticket: ${input.title}\n${input.body}\n\nPlan:\n${input.plan}\n\nChanges:\n${input.diffSummary}\n\nTest output:\n${input.testOutput}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as ReviewResult;
  return {
    approved: Boolean(parsed.approved),
    feedback: parsed.feedback ?? "",
    changesRequested: Boolean(parsed.changesRequested),
  };
}
