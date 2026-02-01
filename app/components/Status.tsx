"use client";

import { useEffect, useState, useCallback } from "react";
import { formatRelativeTime, formatBytes, formatUptime, formatInterval } from "@/lib/format";
import TabEmptyState from "@/components/TabEmptyState";

interface StatusData {
  server: {
    status: string;
    uptime: number;
    timestamp: string;
    nodeVersion: string;
  };
  git: {
    branch: string;
    lastCommit: string;
    lastCommitDate: string;
  };
  memoryFiles: {
    name: string;
    modified: string;
    size: number;
  }[];
  autoEval: {
    enabled: boolean;
    interval: number;
    currentIndex: number;
    evalTypes: string[];
  };
  launchdJobs: {
    name: string;
    loaded: boolean;
  }[];
}

const EVAL_TYPE_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  frontend: { text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  backend: { text: "text-blue-300", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  functionality: { text: "text-purple-300", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  memory: { text: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/20" },
};

export default function Status() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch status");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 30 seconds
    const id = setInterval(fetchStatus, 30000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  if (loading) {
    return (
      <TabEmptyState
        icon="M22 12h-4l-3 9L9 3l-3 9H2"
        title="Loading Status"
        description="Checking server health and configuration..."
        variant="loading"
      />
    );
  }

  if (error || !data) {
    return (
      <TabEmptyState
        icon="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        title="Status Unavailable"
        description={error || "Failed to load system status. Is the server running?"}
        variant="error"
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">System Status</h2>
          <p className="text-sm text-gray-500 mt-1">
            Server health, memory files, and automation configuration.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchStatus(); }}
          className="text-gray-500 hover:text-gray-300 p-1.5 rounded-md hover:bg-white/[0.05] transition-all duration-200 border border-white/[0.06]"
          title="Refresh status"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* Server Health */}
      <Section title="Server">
        <div className="grid grid-cols-2 gap-3">
          <InfoCard label="Status" value={data.server.status === "ok" ? "Healthy" : data.server.status} valueClass={data.server.status === "ok" ? "text-emerald-400" : "text-red-400"} />
          <InfoCard label="Uptime" value={formatUptime(data.server.uptime)} />
          <InfoCard label="Node" value={data.server.nodeVersion} />
          <InfoCard label="Last check" value={formatRelativeTime(data.server.timestamp)} />
        </div>
      </Section>

      {/* Git */}
      <Section title="Git">
        <div className="grid grid-cols-2 gap-3">
          <InfoCard label="Branch" value={data.git.branch} valueClass={data.git.branch === "main" ? "text-emerald-400" : "text-amber-400"} />
          <InfoCard label="Last commit" value={data.git.lastCommitDate ? formatRelativeTime(data.git.lastCommitDate) : "—"} />
        </div>
        <div className="mt-3 px-3 py-2 rounded-lg border border-white/[0.06] text-xs text-gray-400" style={{ background: "var(--surface-2)", fontFamily: "var(--font-mono)" }}>
          {data.git.lastCommit}
        </div>
      </Section>

      {/* Auto-Eval Config */}
      <Section title="Auto-Eval">
        <div className="grid grid-cols-2 gap-3">
          <InfoCard label="Status" value={data.autoEval.enabled ? "Enabled" : "Disabled"} valueClass={data.autoEval.enabled ? "text-emerald-400" : "text-gray-500"} />
          <InfoCard label="Interval" value={formatInterval(data.autoEval.interval)} />
        </div>
        <div className="mt-3">
          <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Rotation</span>
          <div className="mt-2 flex items-center gap-2">
            {data.autoEval.evalTypes.map((type, i) => {
              const style = EVAL_TYPE_STYLES[type] || EVAL_TYPE_STYLES.frontend;
              const isCurrent = i === data.autoEval.currentIndex;
              return (
                <div
                  key={type}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${style.text} ${style.bg} ${style.border} ${isCurrent ? "ring-1 ring-white/20" : "opacity-50"}`}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                  {type}
                  {isCurrent && (
                    <span className="text-gray-400 ml-1">next</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Memory Files */}
      <Section title={`Memory Files (${data.memoryFiles.length})`}>
        {data.memoryFiles.length === 0 ? (
          <div className="text-sm text-gray-600 text-center py-4">No memory files found.</div>
        ) : (
          <div className="border border-white/[0.06] rounded-lg divide-y divide-white/[0.04] overflow-hidden" style={{ background: "var(--surface-2)" }}>
            {data.memoryFiles.map((file) => (
              <div key={file.name} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="text-gray-300" style={{ fontFamily: "var(--font-mono)" }}>
                  {file.name}
                </span>
                <div className="flex items-center gap-3 text-gray-600" style={{ fontFamily: "var(--font-mono)" }}>
                  <span>{formatBytes(file.size)}</span>
                  <span>{formatRelativeTime(file.modified)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* launchd Jobs */}
      <Section title="Scheduled Jobs">
        {data.launchdJobs.length === 0 ? (
          <div className="text-sm text-gray-600 text-center py-4">No launchd plists found.</div>
        ) : (
          <div className="border border-white/[0.06] rounded-lg divide-y divide-white/[0.04] overflow-hidden" style={{ background: "var(--surface-2)" }}>
            {data.launchdJobs.map((job) => (
              <div key={job.name} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="text-gray-300" style={{ fontFamily: "var(--font-mono)" }}>
                  {job.name}
                </span>
                <span className={`font-medium ${job.loaded ? "text-emerald-400" : "text-gray-600"}`}>
                  {job.loaded ? "Loaded" : "Not loaded"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
      <div className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-1">{label}</div>
      <div className={`text-sm font-medium ${valueClass || "text-gray-200"}`} style={{ fontFamily: "var(--font-mono)" }}>
        {value}
      </div>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

