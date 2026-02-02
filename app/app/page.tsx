"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import ChatSession from "@/components/ChatSession";
import MemoryEditor from "@/components/MemoryEditor";
import Automations from "@/components/Automations";
import EvalLogs from "@/components/EvalLogs";
import Status from "@/components/Status";
import { LeftTaskPanel, RightTaskPanel, useTaskCounts } from "@/components/TaskPanel";

type Tab = "chat" | "memory" | "automations" | "logs" | "status";

const TABS: { id: Tab; label: string; icon: string; activeClass: string }[] = [
  { id: "chat", label: "Chat", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", activeClass: "text-emerald-400 border-emerald-400" },
  { id: "memory", label: "Memory", icon: "M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z", activeClass: "text-blue-400 border-blue-400" },
  { id: "automations", label: "Automations", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8", activeClass: "text-purple-400 border-purple-400" },
  { id: "logs", label: "Eval Logs", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8", activeClass: "text-amber-400 border-amber-400" },
  { id: "status", label: "Status", icon: "M22 12h-4l-3 9L9 3l-3 9H2", activeClass: "text-emerald-400 border-emerald-400" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  // Auto-collapse panels on narrow screens
  const isNarrow = typeof window !== "undefined" && window.innerWidth < 1024;
  const [leftPanelOpen, setLeftPanelOpen] = useState(!isNarrow);
  const [rightPanelOpen, setRightPanelOpen] = useState(!isNarrow);
  const [leftPanelWidth, setLeftPanelWidth] = useState(240);
  const [rightPanelWidth, setRightPanelWidth] = useState(240);
  const taskCounts = useTaskCounts();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const draggingRef = useRef<"left" | "right" | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Panel resize via drag
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      e.preventDefault();
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.max(180, Math.min(500, startWidthRef.current + (draggingRef.current === "left" ? delta : -delta)));
      if (draggingRef.current === "left") setLeftPanelWidth(newWidth);
      else setRightPanelWidth(newWidth);
    }
    function onMouseUp() {
      if (draggingRef.current) {
        draggingRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  function startDrag(side: "left" | "right", e: React.MouseEvent) {
    draggingRef.current = side;
    startXRef.current = e.clientX;
    startWidthRef.current = side === "left" ? leftPanelWidth : rightPanelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  // Auto-collapse panels when window becomes narrow
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 1024) {
        setLeftPanelOpen(false);
        setRightPanelOpen(false);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Cmd+1-5 keyboard shortcuts for tab switching
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= TABS.length) {
        e.preventDefault();
        const tab = TABS[num - 1];
        setActiveTab(tab.id);
        tabRefs.current[num - 1]?.focus();
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const handleTabKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = TABS.findIndex((t) => t.id === activeTab);
    let nextIndex: number | null = null;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % TABS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = TABS.length - 1;
    }

    if (nextIndex !== null) {
      setActiveTab(TABS[nextIndex].id);
      tabRefs.current[nextIndex]?.focus();
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col h-screen text-gray-100" style={{ background: 'var(--surface-0)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-2.5 border-b border-white/[0.06] flex-wrap gap-y-1" style={{ background: 'var(--surface-1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/20" role="img" aria-label="Bridgette logo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="text-sm font-semibold tracking-tight text-gray-100 hidden sm:block" style={{ fontFamily: 'var(--font-mono)' }}>
            Bridgette
          </h1>
        </div>
        <nav role="tablist" aria-label="Dashboard sections" className="flex gap-0.5 flex-wrap">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              ref={(el) => { tabRefs.current[index] = el; }}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={handleTabKeyDown}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border-b-2 ${
                activeTab === tab.id
                  ? `${tab.activeClass} bg-white/[0.04]`
                  : "text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/[0.03] active:bg-white/[0.06]"
              } focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/60`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={tab.icon} />
              </svg>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Content — all tabs stay mounted, hidden via CSS to preserve state */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <div role="tabpanel" id="tabpanel-chat" aria-labelledby="tab-chat" tabIndex={0} className={`flex-1 overflow-hidden flex ${activeTab !== "chat" ? "hidden" : ""}`} hidden={activeTab !== "chat" || undefined}>
          {/* Left panel toggle */}
          {!leftPanelOpen && (
            <button
              onClick={() => setLeftPanelOpen(true)}
              className="relative flex-shrink-0 w-8 flex items-center justify-center border-r border-white/[0.06] hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors text-gray-600 hover:text-emerald-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-emerald-500/60"
              style={{ background: 'var(--surface-1)' }}
              title="Show pending tasks"
              aria-label="Show pending tasks panel"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
              {taskCounts.pending > 0 && (
                <span className="absolute top-1.5 right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-emerald-500/80 text-white text-[10px] font-bold px-1">{taskCounts.pending}</span>
              )}
            </button>
          )}
          {leftPanelOpen && (
            <>
              <LeftTaskPanel onCollapse={() => setLeftPanelOpen(false)} width={leftPanelWidth} />
              <div
                onMouseDown={(e) => startDrag("left", e)}
                className="group/drag flex-shrink-0 w-1.5 cursor-col-resize hover:bg-emerald-500/20 active:bg-emerald-500/40 transition-colors duration-100 flex items-center justify-center"
                style={{ background: draggingRef.current === "left" ? "rgba(16,185,129,0.3)" : undefined }}
                title="Drag to resize"
              >
                <div className="w-0.5 h-8 rounded-full bg-white/[0.06] group-hover/drag:bg-emerald-400/40 transition-colors" />
              </div>
            </>
          )}
          <div className="flex-1 overflow-hidden">
            <ChatSession />
          </div>
          {rightPanelOpen && (
            <>
              <div
                onMouseDown={(e) => startDrag("right", e)}
                className="group/drag flex-shrink-0 w-1.5 cursor-col-resize hover:bg-emerald-500/20 active:bg-emerald-500/40 transition-colors duration-100 flex items-center justify-center"
                style={{ background: draggingRef.current === "right" ? "rgba(16,185,129,0.3)" : undefined }}
                title="Drag to resize"
              >
                <div className="w-0.5 h-8 rounded-full bg-white/[0.06] group-hover/drag:bg-emerald-400/40 transition-colors" />
              </div>
              <RightTaskPanel onCollapse={() => setRightPanelOpen(false)} width={rightPanelWidth} />
            </>
          )}
          {!rightPanelOpen && (
            <button
              onClick={() => setRightPanelOpen(true)}
              className="relative flex-shrink-0 w-8 flex items-center justify-center border-l border-white/[0.06] hover:bg-amber-500/10 active:bg-amber-500/20 transition-colors text-gray-600 hover:text-amber-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500/60"
              style={{ background: 'var(--surface-1)' }}
              title="Show active tasks"
              aria-label="Show active tasks panel"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              {taskCounts.needsTesting > 0 && (
                <span className="absolute top-1.5 left-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-amber-500/80 text-white text-[10px] font-bold px-1">{taskCounts.needsTesting}</span>
              )}
            </button>
          )}
        </div>
        <div role="tabpanel" id="tabpanel-memory" aria-labelledby="tab-memory" tabIndex={0} className={`flex-1 overflow-hidden ${activeTab !== "memory" ? "hidden" : ""}`} hidden={activeTab !== "memory" || undefined}>
          <MemoryEditor />
        </div>
        <div role="tabpanel" id="tabpanel-automations" aria-labelledby="tab-automations" tabIndex={0} className={`flex-1 overflow-hidden overflow-y-auto ${activeTab !== "automations" ? "hidden" : ""}`} hidden={activeTab !== "automations" || undefined}>
          <Automations onSendToChat={(text) => {
            window.dispatchEvent(new CustomEvent("bridgette-send-to-chat", { detail: text }));
            setActiveTab("chat");
          }} />
        </div>
        <div role="tabpanel" id="tabpanel-logs" aria-labelledby="tab-logs" tabIndex={0} className={`flex-1 overflow-hidden ${activeTab !== "logs" ? "hidden" : ""}`} hidden={activeTab !== "logs" || undefined}>
          <EvalLogs />
        </div>
        <div role="tabpanel" id="tabpanel-status" aria-labelledby="tab-status" tabIndex={0} className={`flex-1 overflow-hidden overflow-y-auto ${activeTab !== "status" ? "hidden" : ""}`} hidden={activeTab !== "status" || undefined}>
          <Status />
        </div>
      </main>
    </div>
  );
}
