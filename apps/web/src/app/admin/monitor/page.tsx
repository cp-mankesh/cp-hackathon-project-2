"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function MonitorPage() {
  const [data, setData] = useState<{
    stats: Array<{ runId: string; ticketId: string; status: string; estimatedTokens: number }>;
    totalTokens: number;
    estimatedCostUsd: number;
  } | null>(null);

  useEffect(() => {
    api<typeof data>("/api/monitor/llm").then(setData);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">LLM Monitor</h1>
        <p className="text-sm text-gray-500">Estimated token usage and cost</p>
      </header>

      {data && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white p-5">
              <p className="text-sm text-gray-500">Total estimated tokens</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.totalTokens.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-5">
              <p className="text-sm text-gray-500">Estimated cost (USD)</p>
              <p className="text-2xl font-bold text-primary">
                ${data.estimatedCostUsd.toFixed(4)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-4 py-3">Run</th>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {data.stats.map((s) => (
                  <tr key={s.runId} className="border-b border-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{s.runId.slice(0, 8)}…</td>
                    <td className="px-4 py-3 font-mono text-xs">{s.ticketId.slice(0, 8)}…</td>
                    <td className="px-4 py-3">{s.status}</td>
                    <td className="px-4 py-3">{s.estimatedTokens.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
