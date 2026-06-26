"use client";

import type { ReviewResult } from "@ados/shared";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, MessageSquare, XCircle } from "lucide-react";

export interface ReviewArtifactItem {
  type: string;
  content: string;
  createdAt?: string;
}

export function parseReviewArtifact(type: string, content: string): ReviewResult & { label: string } {
  const round = type.match(/^review-(\d+)$/)?.[1];
  const label = round ? `Review round ${Number(round) + 1}` : "Automated review";

  try {
    const parsed = JSON.parse(content) as ReviewResult;
    return {
      approved: Boolean(parsed.approved),
      feedback: parsed.feedback ?? "",
      changesRequested: Boolean(parsed.changesRequested),
      label,
    };
  } catch {
    return {
      approved: false,
      feedback: content,
      changesRequested: true,
      label,
    };
  }
}

export function parseReviewArtifacts(artifacts: ReviewArtifactItem[]) {
  return [...artifacts]
    .sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })
    .map((a) => ({
      ...parseReviewArtifact(a.type, a.content),
      createdAt: a.createdAt,
    }));
}

export function ReviewNotesViewer({ artifacts }: { artifacts: ReviewArtifactItem[] }) {
  const reviews = parseReviewArtifacts(artifacts);

  if (reviews.length === 0) {
    return <p className="text-sm text-gray-500">No review notes yet.</p>;
  }

  return (
    <div className="space-y-4 not-prose">
      {reviews.map((review, index) => (
        <div
          key={`${review.label}-${index}`}
          className={cn(
            "overflow-hidden rounded-xl border bg-white",
            review.approved && !review.changesRequested
              ? "border-green-200"
              : review.changesRequested
                ? "border-amber-200"
                : "border-red-200"
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between border-b px-4 py-3",
              review.approved && !review.changesRequested
                ? "border-green-100 bg-green-50"
                : review.changesRequested
                  ? "border-amber-100 bg-amber-50"
                  : "border-red-100 bg-red-50"
            )}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-semibold text-gray-900">{review.label}</span>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                review.approved && !review.changesRequested
                  ? "bg-green-100 text-green-800"
                  : review.changesRequested
                    ? "bg-amber-100 text-amber-800"
                    : "bg-red-100 text-red-800"
              )}
            >
              {review.approved && !review.changesRequested ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Approved
                </>
              ) : review.changesRequested ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Changes requested
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5" />
                  Not approved
                </>
              )}
            </span>
          </div>

          <div className="p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{review.feedback}</p>
          </div>

          {review.createdAt && (
            <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
              {new Date(review.createdAt).toLocaleString()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
