"use client";

import { useEffect, useState } from "react";
import { API_URL, api } from "@/lib/api";
import { Github } from "lucide-react";

export default function SettingsPage() {
  const [integrations, setIntegrations] = useState<Array<{ type: string }>>([]);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    api<{ integrations: Array<{ type: string }> }>("/api/integrations").then((d) =>
      setIntegrations(d.integrations)
    );
  }, []);

  async function disconnect(type: "github" | "jira") {
    const label = type === "github" ? "GitHub" : "Jira";
    if (!confirm(`Disconnect ${label}? You can reconnect anytime from this page.`)) return;

    setDisconnecting(type);
    try {
      await api(`/api/integrations/${type}`, { method: "DELETE" });
      setIntegrations((prev) => prev.filter((i) => i.type !== type));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setDisconnecting(null);
    }
  }

  const hasGithub = integrations.some((i) => i.type === "github");
  const hasJira = integrations.some((i) => i.type === "jira");

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Integrations and platform configuration</p>
      </header>

      <div className="max-w-xl space-y-4">
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Github className="h-5 w-5" />
              <div>
                <p className="font-medium">GitHub</p>
                <p className="text-sm text-gray-500">OAuth for repos, issues, and PRs</p>
              </div>
            </div>
            {hasGithub ? (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  Connected
                </span>
                <button
                  type="button"
                  onClick={() => disconnect("github")}
                  disabled={disconnecting === "github"}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                >
                  {disconnecting === "github" ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            ) : (
              <a
                href={`${API_URL}/api/auth/github`}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800"
              >
                Connect
              </a>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Jira</p>
              <p className="text-sm text-gray-500">Import issues via OAuth</p>
            </div>
            {hasJira ? (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  Connected
                </span>
                <button
                  type="button"
                  onClick={() => disconnect("jira")}
                  disabled={disconnecting === "jira"}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                >
                  {disconnecting === "jira" ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            ) : (
              <a
                href={`${API_URL}/api/auth/jira`}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Connect
              </a>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-5 text-sm text-gray-600">
          <p className="font-medium text-gray-900">Agent limits</p>
          <ul className="mt-2 space-y-1">
            <li>AGENT_MAX_RETRIES: 3 (dev ⇌ QA loop)</li>
            <li>AGENT_MAX_REVIEW_ROUNDS: 2 (review ⇌ dev loop)</li>
            <li>Human approval required before push/PR</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
