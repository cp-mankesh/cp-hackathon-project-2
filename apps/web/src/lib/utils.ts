import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    completed: "bg-green-100 text-green-800",
    approved: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    rejected: "bg-red-100 text-red-800",
    awaiting_plan_approval: "bg-purple-100 text-purple-800",
    awaiting_human_review: "bg-amber-100 text-amber-800",
    implementing: "bg-blue-100 text-blue-800",
    reviewing: "bg-purple-100 text-purple-800",
    pr_created: "bg-indigo-100 text-indigo-800",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

export function priorityColor(p: string): string {
  const map: Record<string, string> = {
    P0: "border-red-200 bg-red-50",
    P1: "border-orange-200 bg-orange-50",
    P2: "border-blue-200 bg-blue-50",
    P3: "border-gray-200 bg-gray-50",
  };
  return map[p] ?? "border-gray-200 bg-gray-50";
}
