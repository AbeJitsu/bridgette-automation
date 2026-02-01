"use client";

import { useState } from "react";
import ChatSession from "@/components/ChatSession";
import Terminal from "@/components/Terminal";
import MemoryEditor from "@/components/MemoryEditor";
import Automations from "@/components/Automations";
import { LeftTaskPanel, RightTaskPanel } from "@/components/TaskPanel";

type Tab = "chat" | "terminal" | "memory" | "automations";

const TABS: { id: Tab; label: string; icon: string; activeClass: string }[] = [
  { id: "chat", label: "Chat", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", activeClass: "text-emerald-400 border-emerald-400" },
  { id: "terminal", label: "Terminal", icon: "M4 17l6-5-6-5M12 19h8", activeClass: "text-gray-200 border-gray-200" },
  { id: "memory", label: "Memory", icon: "M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z", activeClass: "text-blue-400 border-blue-400" },
  { id: "automations", label: "Automations", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8", activeClass: "text-purple-400 border-purple-400" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  return (
    <div className="flex flex-col h-screen text-gray-100" style={{ background: 'var(--surface-0)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-2.5 border-b border-white/[0.06]" style={{ background: 'var(--surface-1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="text-sm font-semibold tracking-tight text-gray-100" style={{ fontFamily: 'var(--font-mono)' }}>
            Bridgette
          </h1>
        </div>
        <nav className="flex gap-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border-b-2 ${
                activeTab === tab.id
                  ? `${tab.activeClass} bg-white/[0.04]`
                  : "text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/[0.03]"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden flex">
        {activeTab === "chat" && (
          <>
            <LeftTaskPanel />
            <div className="flex-1 overflow-hidden">
              <ChatSession />
            </div>
            <RightTaskPanel />
          </>
        )}
        {activeTab === "terminal" && <Terminal />}
        {activeTab === "memory" && <MemoryEditor />}
        {activeTab === "automations" && <Automations />}
      </main>
    </div>
  );
}
