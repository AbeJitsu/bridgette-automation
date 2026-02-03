"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import TabEmptyState from "@/components/TabEmptyState";

interface Automation {
  name: string;
  title: string;
  modified: string;
}

interface NightlySchedule {
  enabled: boolean;
  startHour: number;
  startMinute: number;
  intervalMinutes: number;
  nextRun: number | null;
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
  const [sendingName, setSendingName] = useState<string | null>(null);

  // Nightly schedule state
  const [nightly, setNightly] = useState<NightlySchedule>({
    enabled: false,
    startHour: 3,
    startMinute: 0,
    intervalMinutes: 60,
    nextRun: null,
  });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetch("/api/automations")
      .then((r) => r.json())
      .then((data) => {
        setAutomations(data.automations || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Connect to chat WS to get/set nightly schedule
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "state" && data.nightlySchedule) {
          setNightly(data.nightlySchedule);
        } else if (data.type === "nightly_schedule_state" && data.nightlySchedule) {
          setNightly(data.nightlySchedule);
        }
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const sendNightlyUpdate = useCallback((update: Partial<NightlySchedule>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "set_nightly_schedule", ...update }));
    }
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
    <div className="max-w-3xl mx-auto p-6 space-y-4 overflow-y-auto h-full">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-100">Automations</h2>
        <p className="text-sm text-gray-500 mt-1">
          Prompt templates for scheduled tasks. Send directly to chat, copy to clipboard, or trigger via API.
        </p>
      </div>

      {/* Nightly Schedule Card */}
      <NightlyScheduleCard
        schedule={nightly}
        onUpdate={sendNightlyUpdate}
      />

      {automations.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-12">
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
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className={`font-medium ${colors.text}`}>{auto.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                    {auto.name} &middot; updated{" "}
                    {new Date(auto.modified).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => viewPrompt(auto.name)}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md border border-white/[0.08] text-gray-400 hover:text-gray-200 active:text-gray-100 hover:bg-white/[0.08] active:bg-white/[0.12] transition-all duration-200 focus:outline-none focus-visible:outline-1 focus-visible:outline-emerald-500/60"
                  style={{ background: 'var(--surface-2)' }}
                >
                  {expandedPrompt === auto.name ? "Hide" : "View"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => copyPrompt(auto.name)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border ${colors.border} ${colors.accent} hover:bg-white/[0.08] active:bg-white/[0.12] transition-all duration-200 focus:outline-none focus-visible:outline-1 focus-visible:outline-emerald-500/60`}
                  style={{ background: 'var(--surface-2)' }}
                >
                  {copiedName === auto.name ? "Copied!" : "Copy Prompt"}
                </button>
                {onSendToChat && (
                  <button
                    onClick={async () => {
                      setSendingName(auto.name);
                      try {
                        const res = await fetch(`/api/automations/${auto.name}`);
                        const data = await res.json();
                        onSendToChat(data.prompt);
                      } catch {
                        // silent fail
                      }
                      setSendingName(null);
                    }}
                    disabled={sendingName === auto.name}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border border-emerald-500/20 text-emerald-400 transition-all duration-200 focus:outline-none focus-visible:outline-1 focus-visible:outline-emerald-500/60 ${
                      sendingName === auto.name ? "opacity-60 cursor-wait" : "hover:bg-emerald-500/10 active:bg-emerald-500/20"
                    }`}
                    style={{ background: 'var(--surface-2)' }}
                  >
                    {sendingName === auto.name ? "Sending..." : "Send to Chat"}
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
// NIGHTLY SCHEDULE CARD
// ============================================

const EVAL_ORDER = ["Frontend", "Backend", "Functionality", "Memory"];

function NightlyScheduleCard({
  schedule,
  onUpdate,
}: {
  schedule: NightlySchedule;
  onUpdate: (update: Partial<NightlySchedule>) => void;
}) {
  const formatTime = (hour: number, minute: number) => {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";
    return `${h}:${String(minute).padStart(2, "0")} ${ampm}`;
  };

  const formatNextRun = (ts: number | null) => {
    if (!ts) return "Not scheduled";
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const timeStr = formatTime(d.getHours(), d.getMinutes());
    if (isToday) return `Today at ${timeStr}`;
    if (isTomorrow) return `Tomorrow at ${timeStr}`;
    return `${d.toLocaleDateString()} at ${timeStr}`;
  };

  // Build the schedule preview showing eval times
  const getEvalTimes = () => {
    return EVAL_ORDER.map((name, i) => {
      const totalMinutes = schedule.startHour * 60 + schedule.startMinute + i * schedule.intervalMinutes;
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      return { name, time: formatTime(h, m) };
    });
  };

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-blue-300">Nightly Eval Schedule</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Runs all 4 eval types sequentially overnight
            </p>
          </div>
          <button
            onClick={() => onUpdate({ enabled: !schedule.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:outline-1 focus-visible:outline-emerald-500/60 ${
              schedule.enabled ? "bg-emerald-500" : "bg-gray-600"
            }`}
            role="switch"
            aria-checked={schedule.enabled}
            aria-label="Enable nightly eval schedule"
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                schedule.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {schedule.enabled && (
          <>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Start time</label>
                <div className="flex items-center gap-1">
                  <select
                    value={schedule.startHour}
                    onChange={(e) => onUpdate({ startHour: parseInt(e.target.value) })}
                    className="px-2 py-1 text-sm rounded-md border border-white/[0.08] text-gray-200 focus:outline-none focus-visible:outline-1 focus-visible:outline-emerald-500/60"
                    style={{ background: 'var(--surface-2)' }}
                    aria-label="Start hour"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i === 0 ? "12" : i > 12 ? String(i - 12) : String(i)}
                        {i < 12 ? " AM" : " PM"}
                      </option>
                    ))}
                  </select>
                  <span className="text-gray-500">:</span>
                  <select
                    value={schedule.startMinute}
                    onChange={(e) => onUpdate({ startMinute: parseInt(e.target.value) })}
                    className="px-2 py-1 text-sm rounded-md border border-white/[0.08] text-gray-200 focus:outline-none focus-visible:outline-1 focus-visible:outline-emerald-500/60"
                    style={{ background: 'var(--surface-2)' }}
                    aria-label="Start minute"
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Interval</label>
                <select
                  value={schedule.intervalMinutes}
                  onChange={(e) => onUpdate({ intervalMinutes: parseInt(e.target.value) })}
                  className="px-2 py-1 text-sm rounded-md border border-white/[0.08] text-gray-200 focus:outline-none focus-visible:outline-1 focus-visible:outline-emerald-500/60"
                  style={{ background: 'var(--surface-2)' }}
                  aria-label="Interval between evals"
                >
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-gray-500 space-y-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
              {getEvalTimes().map(({ name, time }) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-gray-600 w-3">
                    {name === "Frontend" ? "1" : name === "Backend" ? "2" : name === "Functionality" ? "3" : "4"}
                  </span>
                  <span className="text-gray-400">{time}</span>
                  <span className="text-gray-600">{name}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Next run:</span>
              <span className="text-blue-400">{formatNextRun(schedule.nextRun)}</span>
            </div>
          </>
        )}
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
    <button
      className="group flex items-center gap-2 text-xs text-gray-500 rounded-md px-2.5 py-1.5 border border-white/[0.04] hover:border-white/[0.08] active:border-white/[0.12] hover:bg-white/[0.02] active:bg-white/[0.04] transition-all duration-150 cursor-pointer w-full text-left focus:outline-none focus-visible:outline-1 focus-visible:outline-emerald-500/60"
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
    </button>
  );
}
