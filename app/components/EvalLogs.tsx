"use client";

import { useEffect, useState, useCallback } from "react";

interface EvalLogEntry {
  id: string;
  evalType: "frontend" | "backend" | "functionality";
  timestamp: string;
  branch: string;
  commitHash: string;
  diffSummary: string;
  status: "success" | "error" | "timeout";
}

const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  success: { dot: "bg-emerald-400", text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  error: { dot: "bg-red-400", text: "text-red-300", bg: "bg-red-500/10", border: "border-red-500/20" },
  timeout: { dot: "bg-amber-400", text: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/20" },
};

const TYPE_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  frontend: { text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  backend: { text: "text-blue-300", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  functionality: { text: "text-purple-300", bg: "bg-purple-500/10", border: "border-purple-500/20" },
};

export default function EvalLogs() {
  const [logs, setLogs] = useState<EvalLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/eval-logs");
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filtered = filterType === "all" ? logs : logs.filter((l) => l.evalType === filterType);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading eval logs...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Eval Logs</h2>
          <p className="text-sm text-gray-500 mt-1">
            Auto-evaluation run history. {logs.length} total runs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter by type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-gray-400 text-xs font-medium border border-white/[0.06] rounded-md px-2 py-1 hover:border-white/[0.12] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer transition-all duration-200"
            style={{ background: "var(--surface-2)", fontFamily: "var(--font-mono)" }}
          >
            <option value="all">All types</option>
            <option value="frontend">Frontend</option>
            <option value="backend">Backend</option>
            <option value="functionality">Functionality</option>
          </select>
          {/* Refresh */}
          <button
            onClick={() => { setLoading(true); fetchLogs(); }}
            className="text-gray-500 hover:text-gray-300 p-1.5 rounded-md hover:bg-white/[0.05] transition-all duration-200 border border-white/[0.06]"
            title="Refresh logs"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-gray-600 text-center py-12">
          {logs.length === 0
            ? "No eval runs yet. Enable auto-eval or trigger one manually."
            : "No runs matching this filter."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const statusStyle = STATUS_STYLES[entry.status] || STATUS_STYLES.success;
            const typeStyle = TYPE_STYLES[entry.evalType] || TYPE_STYLES.frontend;
            const isExpanded = expandedId === entry.id;

            return (
              <div
                key={entry.id}
                className={`rounded-xl border ${statusStyle.border} overflow-hidden transition-all duration-200`}
                style={{ background: "var(--surface-1)" }}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors duration-150 text-left"
                >
                  {/* Status dot */}
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusStyle.dot}`} />

                  {/* Eval type badge */}
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-medium ${typeStyle.text} ${typeStyle.bg} border ${typeStyle.border}`}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {entry.evalType}
                  </span>

                  {/* Timestamp */}
                  <span className="text-xs text-gray-400 flex-shrink-0" style={{ fontFamily: "var(--font-mono)" }}>
                    {formatTimestamp(entry.timestamp)}
                  </span>

                  {/* Branch + commit */}
                  <span className="text-xs text-gray-600 truncate" style={{ fontFamily: "var(--font-mono)" }}>
                    {entry.branch}@{entry.commitHash.slice(0, 7)}
                  </span>

                  {/* Status label */}
                  <span className={`ml-auto text-xs font-medium ${statusStyle.text}`}>
                    {entry.status}
                  </span>

                  {/* Expand arrow */}
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`text-gray-600 transition-transform duration-200 flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/[0.06] px-4 py-3" style={{ background: "var(--surface-2)" }}>
                    <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Changes</div>
                    <pre
                      className="text-xs text-gray-400 whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {entry.diffSummary || "No changes recorded"}
                    </pre>
                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-600" style={{ fontFamily: "var(--font-mono)" }}>
                      <span>ID: {entry.id.slice(0, 8)}</span>
                      <span>Commit: {entry.commitHash.slice(0, 12)}</span>
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
