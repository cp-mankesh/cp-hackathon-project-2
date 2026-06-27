"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QueueCollapsibleCardProps {
  isExpanded: boolean;
  onToggle: () => void;
  borderClassName?: string;
  hoverClassName?: string;
  repoLabel?: string;
  title: string;
  ticketHref?: string;
  badge: React.ReactNode;
  collapsedDescription?: string;
  collapsedPreview?: React.ReactNode;
  expandedContent?: React.ReactNode;
  footer?: React.ReactNode;
}

export function QueueCollapsibleCard({
  isExpanded,
  onToggle,
  borderClassName = "border-gray-100",
  hoverClassName = "hover:bg-gray-50/80",
  repoLabel,
  title,
  ticketHref,
  badge,
  collapsedDescription,
  collapsedPreview,
  expandedContent,
  footer,
}: QueueCollapsibleCardProps) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-white shadow-sm", borderClassName)}>
      <button
        type="button"
        onClick={onToggle}
        className={cn("flex w-full items-start gap-3 p-5 text-left", hoverClassName)}
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
        ) : (
          <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {repoLabel && <p className="text-xs text-gray-400">{repoLabel}</p>}
              {ticketHref ? (
                <Link
                  href={ticketHref}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-gray-900 hover:text-primary"
                >
                  {title}
                </Link>
              ) : (
                <p className="font-medium text-gray-900">{title}</p>
              )}
              {!isExpanded && collapsedDescription && (
                <p className="mt-2 line-clamp-2 text-sm text-gray-600">{collapsedDescription}</p>
              )}
            </div>
            {badge}
          </div>

          {!isExpanded && collapsedPreview && <div className="mt-3 space-y-1">{collapsedPreview}</div>}
        </div>
      </button>

      {isExpanded && expandedContent && (
        <div className={cn("border-t px-5 pb-5", borderClassName)}>{expandedContent}</div>
      )}

      {footer && <div className={cn("border-t px-5 py-3", borderClassName)}>{footer}</div>}
    </div>
  );
}
