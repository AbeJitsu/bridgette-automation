"use client";

import { useEffect, useState, useCallback } from "react";

interface Automation {
  name: string;
  title: string;
  modified: string;
}

const COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "content-creation": {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  "job-search": {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  "codebase-eval": {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
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
    } catch {
      // silent fail
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Loading automations...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Automations</h2>
        <p className="text-sm text-gray-500 mt-1">
          Prompt templates for scheduled tasks. Copy to clipboard and paste into
          the terminal, or trigger via API.
        </p>
      </div>

      {automations.map((auto) => {
        const colors = COLORS[auto.name] || {
          bg: "bg-gray-50",
          text: "text-gray-700",
          border: "border-gray-200",
        };

        return (
          <div
            key={auto.name}
            className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}
          >
            <div className="flex items-center justify-between p-4">
              <div>
                <h3 className={`font-medium ${colors.text}`}>{auto.title}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {auto.name} &middot; updated{" "}
                  {new Date(auto.modified).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => viewPrompt(auto.name)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {expandedPrompt === auto.name ? "Hide" : "View"}
                </button>
                <button
                  onClick={() => copyPrompt(auto.name)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md bg-white border ${colors.border} ${colors.text} hover:bg-opacity-80 transition-colors`}
                >
                  Copy Prompt
                </button>
              </div>
            </div>

            {expandedPrompt === auto.name && (
              <div className="border-t border-gray-200 bg-white p-4">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                  {promptContent}
                </pre>
              </div>
            )}
          </div>
        );
      })}

      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-600 mb-2">
          Scheduling (via launchd)
        </h3>
        <p className="text-xs text-gray-400">
          Automations can be triggered on a schedule using launchd plists that
          curl the API. See <code>launchd/</code> for templates.
        </p>
        <div className="mt-2 text-xs font-mono text-gray-400 space-y-1">
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
