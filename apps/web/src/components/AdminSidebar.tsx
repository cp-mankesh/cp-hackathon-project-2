"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Ticket,
  ClipboardList,
  ListChecks,
  GitBranch,
  History,
  Users,
  FolderKanban,
  Activity,
  Settings,
  Zap,
  LogOut,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, section: "main" },
  { href: "/admin/tickets", label: "Ticket Hub", icon: Ticket, section: "modules", badge: true },
  { href: "/admin/plan-queue", label: "Plan Queue", icon: ClipboardList, section: "modules" },
  { href: "/admin/queue", label: "Document Queue", icon: ListChecks, section: "modules" },
  { href: "/admin/review", label: "Review Queue", icon: GitBranch, section: "modules" },
  { href: "/admin/workflows", label: "Workflow Monitor", icon: Activity, section: "modules" },
  { href: "/admin/history", label: "Run History", icon: History, section: "modules" },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban, section: "management" },
  { href: "/admin/users", label: "Users", icon: Users, section: "management" },
  { href: "/admin/monitor", label: "LLM Monitor", icon: Activity, section: "system" },
  { href: "/admin/settings", label: "Settings", icon: Settings, section: "system" },
];

export function AdminSidebar({ ticketCount }: { ticketCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      router.push("/");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to log out");
    }
  }

  const sections = [
    { key: "main", label: null },
    { key: "modules", label: "MODULES" },
    { key: "management", label: "MANAGEMENT" },
    { key: "system", label: "SYSTEM" },
  ];

  return (
    <aside className="flex w-60 flex-col border-r border-gray-200 bg-[var(--sidebar-bg)]">
      <div className="border-b border-gray-200 px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">AI Engineer Hub</p>
            <p className="text-[10px] text-gray-500">Autonomous Delivery App</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.key} className="mb-4">
            {section.label && (
              <p className="mb-2 px-2 text-[10px] font-semibold tracking-wider text-gray-400">
                {section.label}
              </p>
            )}
            {nav
              .filter((item) => item.section === section.key)
              .map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                      active
                        ? "bg-primary-light font-medium text-primary"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && ticketCount !== undefined && ticketCount > 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {ticketCount}
                      </span>
                    )}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-200 px-4 py-3">
        <p className="text-xs font-medium text-gray-700">Admin</p>
        <p className="text-[10px] text-gray-400">Super Admin</p>
        <button
          type="button"
          onClick={logout}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800"
        >
          <LogOut className="h-3.5 w-3.5" />
          Log out
        </button>
      </div>
    </aside>
  );
}
