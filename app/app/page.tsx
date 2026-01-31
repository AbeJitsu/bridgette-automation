"use client";

import { useState } from "react";
import Terminal from "@/components/Terminal";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"terminal" | "memory">("terminal");

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-gray-800">
          🌉 Bridgette
        </h1>
        <nav className="flex gap-1">
          <button
            onClick={() => setActiveTab("terminal")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "terminal"
                ? "bg-emerald-100 text-emerald-700"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            Terminal
          </button>
          <button
            onClick={() => setActiveTab("memory")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "memory"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            Memory
          </button>
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "terminal" && <Terminal />}
        {activeTab === "memory" && (
          <div className="p-6 text-gray-500">
            Memory editor coming soon.
          </div>
        )}
      </main>
    </div>
  );
}
