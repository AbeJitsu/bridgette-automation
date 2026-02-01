"use client";

import { useEffect, useState, useCallback } from "react";
import TabEmptyState from "@/components/TabEmptyState";

interface Automation {
  name: string;
  title: string;
  modified: string;
}

const COLORS: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  "content-creation": {
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    border: "border-emerald-500/20",
    accent: "text-emerald-400",
  },
  "job-search": {
    bg: "bg-blue-500/10",
    text: "text-blue-300",
    border: "border-blue-500/20",
    accent: "text-blue-400",
  },
  "codebase-eval": {
    bg: "bg-purple-500/10",
    text: "text-purple-300",
    border: "border-purple-500/20",
    accent: "text-purple-400",
  },
};

interface AutomationsProps {
  onSendToTerminal?: (text: string) => void;
}

export default function Automations({ onSendToTerminal }: AutomationsProps) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [promptContent, setPromptContent] = useState<string>("");
  const [copiedName, setCopiedName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/automations")
      .then((r) => r.json())
      .then((data) => {
        setAutomations(data.automations || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const viewPrompt = useCallback(async (name: string) => {
    if (expandedPrompt === name) {
      setExpandedPrompt(null);
      return;
    }
    try {
      const res = await fetch(`/api/automations/${name}`);
      const data = await res.json();
      setPromptContent(data.prompt);
      setExpandedPrompt(name);
    } catch {
      setPromptContent("Failed to load prompt");
      setExpandedPrompt(name);
    }
  }, [expandedPrompt]);

  const copyPrompt = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/automations/${name}`);
      const data = await res.json();
      await navigator.clipboard.writeText(data.prompt);
      setCopiedName(name);
      setTimeout(() => setCopiedName(null), 2000);
    } catch {
      // silent fail
    }
  }, []);

  if (loading) {
    return (
      <TabEmptyState
        icon="M13 2L3 14h9l-1 8 10-12h-9l1-8"
        title="Loading Automations"
        description="Fetching prompt templates..."
        variant="loading"
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-100">Automations</h2>
        <p className="text-sm text-gray-500 mt-1">
          Prompt templates for scheduled tasks. Copy to clipboard and paste into
          the terminal, or trigger via API.
        </p>
      </div>

      {automations.length === 0 && (
        <div className="text-sm text-gray-600 text-center py-12">
          No automations found. Add prompt templates to <code className="text-gray-400" style={{ fontFamily: 'var(--font-mono)' }}>automations/</code>
        </div>
      )}

      {automations.map((auto) => {
        const colors = COLORS[auto.name] || {
          bg: "bg-white/[0.04]",
          text: "text-gray-300",
          border: "border-white/[0.08]",
          accent: "text-gray-400",
        };

        return (
          <div
            key={auto.name}
            className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}
          >
            <div className="flex items-center justify-between p-4">
              <div>
                <h3 className={`font-medium ${colors.text}`}>{auto.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                  {auto.name} &middot; updated{" "}
                  {new Date(auto.modified).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => viewPrompt(auto.name)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-white/[0.08] text-gray-400 hover:text-gray-200 hover:bg-white/[0.05] transition-all duration-200"
                  style={{ background: 'var(--surface-2)' }}
                >
                  {expandedPrompt === auto.name ? "Hide" : "View"}
                </button>
                <button
                  onClick={() => copyPrompt(auto.name)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border ${colors.border} ${colors.accent} hover:bg-white/[0.05] transition-all duration-200`}
                  style={{ background: 'var(--surface-2)' }}
                >
                  {copiedName === auto.name ? "Copied!" : "Copy Prompt"}
                </button>
              </div>
            </div>

            {expandedPrompt === auto.name && (
              <div className="border-t border-white/[0.06] p-4" style={{ background: 'var(--surface-1)' }}>
                <pre className="text-sm text-gray-300 whitespace-pre-wrap" style={{ fontFamily: 'var(--font-mono)' }}>
                  {promptContent}
                </pre>
              </div>
            )}
          </div>
        );
      })}

      <div className="pt-4 border-t border-white/[0.06]">
        <h3 className="text-sm font-medium text-gray-400 mb-2">
          Scheduling (via launchd)
        </h3>
        <p className="text-xs text-gray-500">
          Automations can be triggered on a schedule using launchd plists that
          curl the API. See <code className="text-gray-400" style={{ fontFamily: 'var(--font-mono)' }}>launchd/</code> for templates.
        </p>
        <div className="mt-2 text-xs text-gray-500 space-y-1" style={{ fontFamily: 'var(--font-mono)' }}>
          <div>
            curl -X POST http://localhost:3000/api/automations/content-creation
          </div>
          <div>
            curl -X POST http://localhost:3000/api/automations/job-search
          </div>
          <div>
            curl -X POST http://localhost:3000/api/automations/codebase-eval
          </div>
        </div>
      </div>
    </div>
  );
}
