"use client";

import { useEffect, useState, useCallback } from "react";
import TabEmptyState from "@/components/TabEmptyState";

interface MemoryFile {
  name: string;
  path: string;
  size: number;
  modified: string;
}

export default function MemoryEditor() {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  // Load file list
  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((data) => {
        setFiles(data.files || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Load file content when selected
  const loadFile = useCallback(async (path: string) => {
    setSelectedFile(path);
    setSaveStatus("idle");
    try {
      const res = await fetch(`/api/memory/${path}`);
      const data = await res.json();
      setContent(data.content);
      setOriginalContent(data.content);
    } catch {
      setContent("Failed to load file");
    }
  }, []);

  // Save file
  const saveFile = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch(`/api/memory/${selectedFile}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setOriginalContent(content);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
    setSaving(false);
  }, [selectedFile, content]);

  // Keyboard shortcut: Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveFile]);

  const hasChanges = content !== originalContent;

  // Group files by directory
  const grouped = files.reduce<Record<string, MemoryFile[]>>((acc, file) => {
    const dir = file.path.includes("/") ? file.path.split("/")[0] : "root";
    if (!acc[dir]) acc[dir] = [];
    acc[dir].push(file);
    return acc;
  }, {});

  if (loading) {
    return (
      <TabEmptyState
        icon="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z"
        title="Loading Memory"
        description="Fetching memory files..."
        variant="loading"
      />
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar — file list */}
      <div className="w-64 border-r border-white/[0.06] overflow-y-auto" style={{ background: 'var(--surface-1)' }}>
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>
            Memory Files
          </h2>
        </div>
        <nav className="py-2">
          {Object.entries(grouped).map(([dir, dirFiles]) => (
            <div key={dir}>
              {dir !== "root" && (
                <div className="px-4 py-1.5 text-xs font-medium text-gray-600 uppercase">
                  {dir}/
                </div>
              )}
              {dirFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => loadFile(file.path)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors duration-150 ${
                    selectedFile === file.path
                      ? "bg-emerald-500/10 text-emerald-400 font-medium"
                      : "text-gray-300 hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="truncate">
                    {dir !== "root" ? file.name : file.path}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {new Date(file.modified).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]" style={{ background: 'var(--surface-1)' }}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-200">
                  {selectedFile}
                </span>
                {hasChanges && (
                  <span className="text-xs text-amber-400 font-medium">
                    unsaved
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-600" style={{ fontFamily: 'var(--font-mono)' }}>
                  {"\u2318"}S
                </span>
                {saveStatus === "saved" && (
                  <span className="text-xs text-emerald-400">Saved</span>
                )}
                {saveStatus === "error" && (
                  <span className="text-xs text-red-400">Save failed</span>
                )}
                <button
                  onClick={saveFile}
                  disabled={saving || !hasChanges}
                  className={`px-3 py-1 text-sm rounded-lg font-medium transition-all duration-200 ${
                    hasChanges
                      ? "bg-emerald-500/80 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-500/15"
                      : "bg-white/[0.04] text-gray-600 cursor-not-allowed"
                  }`}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {/* Textarea */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 p-4 font-mono text-sm text-gray-200 resize-none focus:outline-none"
              style={{ background: 'var(--surface-0)' }}
              spellCheck={false}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600">
            Select a file to edit
          </div>
        )}
      </div>
    </div>
  );
}
