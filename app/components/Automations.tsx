"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  onSendToChat?: (text: string) => void;
}

export default function Automations({ onSendToTerminal, onSendToChat }: AutomationsProps) {
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
          Prompt templates for scheduled tasks. Send directly to chat, copy to clipboard, or trigger via API.
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
                {onSendToChat && (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/automations/${auto.name}`);
                        const data = await res.json();
                        onSendToChat(data.prompt);
                      } catch {
                        // silent fail
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    Send to Chat
                  </button>
                )}
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
        <div className="mt-2 space-y-1">
          {["content-creation", "job-search", "codebase-eval"].map((name) => (
            <CurlExample key={name} command={`curl -X POST http://localhost:3000/api/automations/${name}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// CURL EXAMPLE — One-click copyable command
// ============================================

function CurlExample({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div
      className="group flex items-center gap-2 text-xs text-gray-500 rounded-md px-2.5 py-1.5 border border-white/[0.04] hover:border-white/[0.08] transition-all duration-150 cursor-pointer"
      style={{ background: "var(--surface-2)", fontFamily: "var(--font-mono)" }}
      onClick={() => {
        navigator.clipboard.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title="Click to copy"
    >
      <span className="flex-1 truncate">{command}</span>
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 flex-shrink-0">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 group-hover:text-gray-400 flex-shrink-0 transition-colors">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </div>
  );
}
