"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { api } from "@/lib/api";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [ticketCount, setTicketCount] = useState(0);

  useEffect(() => {
    api<{ user: unknown }>("/api/auth/me")
      .then(() => {
        setReady(true);
        return api<{ total: number }>("/api/tickets/stats");
      })
      .then((s) => setTicketCount(s.total))
      .catch(() => router.push("/login"));
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      <AdminSidebar ticketCount={ticketCount} />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
