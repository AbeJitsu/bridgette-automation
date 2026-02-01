"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type TaskPriority = "high" | "normal" | "low";

interface Task {
  id: string;
  title: string;
  status: "pending" | "needs_testing" | "completed";
  createdAt: string;
  summary?: string;
  description?: string;
  priority?: TaskPriority;
}

// Brief error flash for failed task operations
let errorMessage: string | null = null;
let errorTimeout: ReturnType<typeof setTimeout> | null = null;

function setError(msg: string) {
  errorMessage = msg;
  notify();
  if (errorTimeout) clearTimeout(errorTimeout);
  errorTimeout = setTimeout(() => {
    errorMessage = null;
    notify();
  }, 3000);
}

// ============================================
// TASK PANEL — Left sidebar (Pending)
// ============================================

const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 };

function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority || "normal"] ?? 1;
    const pb = PRIORITY_ORDER[b.priority || "normal"] ?? 1;
    return pa - pb;
  });
}

export function LeftTaskPanel({ onCollapse, width }: { onCollapse?: () => void; width?: number }) {
  const { tasks, error, addTask, advanceTask, deleteTask, renameTask, updateDescription, updatePriority } = useTasks();
  const [newTitle, setNewTitle] = useState("");

  const pending = sortByPriority(tasks.filter((t) => t.status === "pending"));

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addTask(newTitle.trim());
    setNewTitle("");
  }

  return (
    <div className="flex flex-col h-full border-r border-white/[0.06] flex-shrink-0" style={{ background: 'var(--surface-1)', width: width ? `${width}px` : '240px' }}>
      <div className="px-3.5 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-gray-500 font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>Pending</h2>
        {onCollapse && (
          <button onClick={onCollapse} className="text-gray-600 hover:text-gray-400 transition-colors p-0.5" title="Collapse panel" aria-label="Collapse pending tasks panel">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {pending.map((task) => (
          <TaskItem key={task.id} task={task} onAdvance={advanceTask} onDelete={deleteTask} onRename={renameTask} onUpdateDescription={updateDescription} onUpdatePriority={updatePriority} />
        ))}
        {pending.length === 0 && (
          <p className="text-xs text-gray-500 px-2 py-6 text-center">No pending tasks</p>
        )}
      </div>

      {error && (
        <div className="mx-2 mb-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
          {error}
        </div>
      )}
      <form onSubmit={handleAdd} className="p-2 border-t border-white/[0.06]">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add task..."
            aria-label="New task title"
            className="flex-1 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40 input-glow transition-all duration-200"
            style={{ background: 'var(--surface-2)', fontFamily: 'var(--font-sans)' }}
          />
          <button
            type="submit"
            disabled={!newTitle.trim()}
            aria-label="Add task"
            className="bg-emerald-500/80 text-white px-2.5 py-1.5 rounded-lg text-sm hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm shadow-emerald-500/15 disabled:shadow-none"
          >
            +
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================
// TASK PANEL — Right sidebar (Needs Testing + Completed)
// ============================================

export function RightTaskPanel({ onCollapse, width }: { onCollapse?: () => void; width?: number }) {
  const { tasks, advanceTask, deleteTask, renameTask, updateDescription, updatePriority, clearCompleted, advanceAll } = useTasks();

  const needsTesting = sortByPriority(tasks.filter((t) => t.status === "needs_testing"));
  const completed = tasks.filter((t) => t.status === "completed");

  // Vertical resize: track the percentage of height for needs_testing section
  const [topPercent, setTopPercent] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return;
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setTopPercent(Math.max(15, Math.min(85, pct)));
    }
    function onMouseUp() {
      if (draggingRef.current) {
        draggingRef.current = false;
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

  function startVDrag(e: React.MouseEvent) {
    draggingRef.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full border-l border-white/[0.06] flex-shrink-0" style={{ background: 'var(--surface-1)', width: width ? `${width}px` : '240px' }}>
      {/* Needs Testing */}
      <div className="flex flex-col min-h-0" style={{ height: `${topPercent}%` }}>
        <div className="px-3.5 py-2.5 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
          <h2 className="text-xs uppercase tracking-widest text-amber-400/80 font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>Needs Testing</h2>
          <div className="flex items-center gap-1.5">
            {needsTesting.length > 1 && (
              <button
                onClick={() => advanceAll("needs_testing", "completed")}
                className="text-xs text-gray-600 hover:text-emerald-400 transition-colors duration-150 px-2 py-0.5 rounded hover:bg-emerald-500/5"
                style={{ fontFamily: 'var(--font-mono)' }}
                title="Mark all as completed"
              >
                Done all
              </button>
            )}
          {onCollapse && (
            <button onClick={onCollapse} className="text-gray-600 hover:text-gray-400 transition-colors p-0.5" title="Collapse panel" aria-label="Collapse active tasks panel">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {needsTesting.map((task) => (
            <TaskItem key={task.id} task={task} onAdvance={advanceTask} onDelete={deleteTask} onRename={renameTask} onUpdateDescription={updateDescription} onUpdatePriority={updatePriority} />
          ))}
          {needsTesting.length === 0 && (
            <p className="text-xs text-gray-500 px-2 py-6 text-center">Nothing to test</p>
          )}
        </div>
      </div>

      {/* Vertical drag handle */}
      <div
        onMouseDown={startVDrag}
        className="group/vdrag flex-shrink-0 h-1.5 cursor-row-resize hover:bg-emerald-500/20 active:bg-emerald-500/40 transition-colors duration-100 border-t border-white/[0.06] flex items-center justify-center"
        title="Drag to resize"
      >
        <div className="h-0.5 w-8 rounded-full bg-white/[0.06] group-hover/vdrag:bg-emerald-400/40 transition-colors" />
      </div>

      {/* Completed */}
      <div className="flex flex-col min-h-0" style={{ height: `${100 - topPercent}%` }}>
        <div className="px-3.5 py-2.5 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
          <h2 className="text-xs uppercase tracking-widest text-gray-500 font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>
            Completed ({completed.length})
          </h2>
          {completed.length > 0 && (
            <button
              onClick={clearCompleted}
              className="text-xs text-gray-600 hover:text-red-400 transition-colors duration-150 px-2 py-0.5 rounded hover:bg-red-500/5"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Clear all
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {completed.map((task) => (
            <TaskItem key={task.id} task={task} onAdvance={advanceTask} onDelete={deleteTask} onRename={renameTask} onUpdateDescription={updateDescription} onUpdatePriority={updatePriority} />
          ))}
          {completed.length === 0 && (
            <p className="text-xs text-gray-500 px-2 py-6 text-center">No completed tasks</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// TASK ITEM
// ============================================

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: "text-red-400",
  normal: "text-gray-600",
  low: "text-blue-400/60",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "!!",
  normal: "",
  low: "\u2193",
};

const PRIORITY_CYCLE: Record<TaskPriority, TaskPriority> = {
  normal: "high",
  high: "low",
  low: "normal",
};

function TaskItem({
  task,
  onAdvance,
  onDelete,
  onRename,
  onUpdateDescription,
  onUpdatePriority,
}: {
  task: Task;
  onAdvance: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onUpdateDescription: (id: string, description: string) => void;
  onUpdatePriority: (id: string, priority: TaskPriority) => void;
}) {
  const [showSummary, setShowSummary] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState(task.description || "");

  const statusIcon = {
    pending: "text-gray-600",
    needs_testing: "text-amber-400/80",
    completed: "text-emerald-400/80",
  };

  const statusSymbol = {
    pending: "\u25CB",       // circle outline
    needs_testing: "\u25CF", // filled circle
    completed: "\u2713",     // checkmark
  };

  const advanceTitle = {
    pending: "Move to Needs Testing",
    needs_testing: "Mark Completed",
    completed: "Done",
  };

  return (
    <div className={`group px-2.5 py-2 rounded-lg hover:bg-white/[0.03] focus-within:bg-white/[0.03] transition-all duration-150 ${
      task.priority === "high" && task.status !== "completed" ? "border-l-2 border-red-400/60" : ""
    }`}>
      <div className="flex items-start gap-2">
        <button
          onClick={() => onAdvance(task.id)}
          className={`mt-0.5 text-sm flex-shrink-0 ${statusIcon[task.status]} hover:text-emerald-400 transition-colors duration-150`}
          aria-label={`${advanceTitle[task.status]}: ${task.title}`}
          title={advanceTitle[task.status]}
        >
          {statusSymbol[task.status]}
        </button>
        {task.status !== "completed" && (task.priority || "normal") !== "normal" && (
          <button
            onClick={() => onUpdatePriority(task.id, PRIORITY_CYCLE[task.priority || "normal"])}
            className={`mt-0.5 text-xs flex-shrink-0 font-bold ${PRIORITY_COLORS[task.priority || "normal"]} hover:opacity-70 transition-opacity duration-150`}
            title={`Priority: ${task.priority || "normal"} (click to cycle)`}
            aria-label={`Priority ${task.priority}, click to change`}
            style={{ fontFamily: 'var(--font-mono)', minWidth: '14px' }}
          >
            {PRIORITY_LABELS[task.priority || "normal"]}
          </button>
        )}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => {
                const trimmed = editTitle.trim();
                if (trimmed && trimmed !== task.title) onRename(task.id, trimmed);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === "Escape") {
                  setEditTitle(task.title);
                  setEditing(false);
                }
              }}
              autoFocus
              className="text-[13px] leading-snug w-full bg-transparent text-gray-200 border-b border-emerald-500/40 outline-none px-0 py-0"
              style={{ fontFamily: 'var(--font-sans)' }}
            />
          ) : (
            <button
              onClick={() => task.summary && setShowSummary(!showSummary)}
              onDoubleClick={() => {
                if (task.status !== "completed") {
                  setEditTitle(task.title);
                  setEditing(true);
                }
              }}
              className={`text-[13px] leading-snug text-left w-full ${
                task.status === "completed" ? "text-gray-600 line-through" : "text-gray-300"
              } ${task.summary ? "cursor-pointer hover:text-gray-400" : ""}`}
              title={task.status !== "completed" ? "Double-click to rename" : undefined}
            >
              {task.title}
            </button>
          )}
          {task.status === "completed" && task.createdAt && (
            <span className="text-xs text-gray-600 block mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
              {formatEST(task.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150">
          {task.status !== "completed" && (
            <button
              onClick={() => onUpdatePriority(task.id, PRIORITY_CYCLE[task.priority || "normal"])}
              className={`text-xs px-1 py-0.5 rounded transition-colors duration-150 ${
                task.priority === "high" ? "text-red-400 bg-red-500/10 hover:bg-red-500/20" :
                task.priority === "low" ? "text-blue-400/60 bg-blue-500/5 hover:bg-blue-500/10" :
                "text-gray-600 hover:text-gray-400 hover:bg-white/[0.03]"
              }`}
              style={{ fontFamily: 'var(--font-mono)' }}
              title={`Priority: ${task.priority || "normal"} (click to cycle)`}
              aria-label={`Set priority for "${task.title}"`}
            >
              {task.priority === "high" ? "!!" : task.priority === "low" ? "\u2193" : "\u2022"}
            </button>
          )}
          {task.status !== "completed" && (
            <button
              onClick={() => {
                const text = task.description
                  ? `Work on this task: ${task.title}\n\nDescription: ${task.description}`
                  : `Work on this task: ${task.title}`;
                window.dispatchEvent(new CustomEvent("bridgette-send-to-chat", { detail: text }));
              }}
              className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors duration-150"
              style={{ fontFamily: 'var(--font-mono)' }}
              aria-label={`Send "${task.title}" to chat`}
              title="Send to Chat"
            >
              chat
            </button>
          )}
          {task.status !== "completed" && (
            <button
              onClick={() => onAdvance(task.id)}
              className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors duration-150"
              style={{ fontFamily: 'var(--font-mono)' }}
              aria-label={task.status === "pending" ? `Move "${task.title}" to testing` : `Mark "${task.title}" done`}
            >
              {task.status === "pending" ? "test" : "done"}
            </button>
          )}
          <button
            onClick={() => onDelete(task.id)}
            className="text-gray-600 hover:text-red-400 transition-colors duration-150 text-xs"
            aria-label={`Delete task: ${task.title}`}
            title="Delete"
          >
            ×
          </button>
        </div>
      </div>
      {/* Description — click to add/edit, shows below title for non-completed tasks */}
      {task.status !== "completed" && (
        editingDesc ? (
          <div className="mt-1.5 ml-5">
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              onBlur={() => {
                const trimmed = editDesc.trim();
                if (trimmed !== (task.description || "")) {
                  onUpdateDescription(task.id, trimmed);
                }
                setEditingDesc(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditDesc(task.description || "");
                  setEditingDesc(false);
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              autoFocus
              rows={2}
              placeholder="Add a description..."
              className="w-full text-xs bg-transparent text-gray-400 border border-white/[0.08] rounded-md px-2 py-1.5 outline-none focus:border-emerald-500/40 resize-none transition-all duration-200"
              style={{ background: 'var(--surface-2)', fontFamily: 'var(--font-sans)' }}
              maxLength={2000}
            />
          </div>
        ) : task.description ? (
          <button
            onClick={() => { setEditDesc(task.description || ""); setEditingDesc(true); }}
            className="mt-1 ml-5 text-xs text-gray-500 hover:text-gray-400 text-left leading-relaxed transition-colors duration-150 line-clamp-2"
            title="Click to edit description"
          >
            {task.description}
          </button>
        ) : (
          <button
            onClick={() => { setEditDesc(""); setEditingDesc(true); }}
            className="mt-0.5 ml-5 text-xs text-gray-600 hover:text-gray-500 transition-colors duration-150 opacity-0 group-hover:opacity-100"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            + description
          </button>
        )
      )}
      {/* Completed task description (read-only) */}
      {task.status === "completed" && task.description && (
        <div className="mt-1 ml-5 text-xs text-gray-600 leading-relaxed line-clamp-2">
          {task.description}
        </div>
      )}
      {/* Auto-show summary preview for completed tasks, full summary on click */}
      {task.status === "completed" && task.summary && !showSummary && (
        <button
          onClick={() => setShowSummary(true)}
          className="mt-1.5 ml-5 text-xs text-gray-500 leading-relaxed text-left w-full hover:text-gray-400 transition-colors duration-150"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {parseSummaryLines(task.summary).slice(0, 3).map((line, i) => (
            <div key={i} className="truncate">{line}</div>
          ))}
          {parseSummaryLines(task.summary).length > 3 && (
            <div className="text-gray-600 mt-0.5">+ more...</div>
          )}
        </button>
      )}
      {showSummary && task.summary && (
        <div
          className="mt-1.5 ml-5 text-xs text-gray-500 overflow-x-auto max-h-40 overflow-y-auto rounded-md border border-white/[0.06] px-2.5 py-2 space-y-1 cursor-pointer"
          style={{ background: 'var(--surface-2)' }}
          onClick={() => setShowSummary(false)}
        >
          {parseSummaryLines(task.summary).map((line, i) => (
            <div key={i} className="leading-relaxed" style={{ fontFamily: 'var(--font-mono)' }}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// SHARED TASK HOOK
// ============================================

let globalTasks: Task[] = [];
let listeners: (() => void)[] = [];
let pollInterval: number | null = null;

function notify() {
  listeners.forEach((l) => l());
}

function fetchTasks() {
  fetch("/api/tasks")
    .then((r) => r.json())
    .then((data) => {
      // Only notify if data actually changed
      if (JSON.stringify(data) !== JSON.stringify(globalTasks)) {
        globalTasks = data;
        notify();
      }
    })
    .catch(() => {});
}

function useTasks() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.push(listener);

    // Always fetch on mount to handle HMR and ensure data is fresh
    fetchTasks();

    // Start polling if first subscriber
    if (!pollInterval) {
      pollInterval = window.setInterval(fetchTasks, 3000);
    }

    return () => {
      listeners = listeners.filter((l) => l !== listener);
      // Stop polling when no subscribers
      if (listeners.length === 0 && pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
  }, []);

  const addTask = useCallback(async (title: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to add task");
      const task = await res.json();
      globalTasks = [...globalTasks, task];
      notify();
    } catch {
      setError("Failed to add task");
    }
  }, []);

  const advanceTask = useCallback(async (id: string) => {
    const task = globalTasks.find((t) => t.id === id);
    if (!task) return;

    const nextStatus: Record<string, string> = {
      pending: "needs_testing",
      needs_testing: "completed",
      completed: "completed",
    };
    const newStatus = nextStatus[task.status];
    if (newStatus === task.status) return;

    // Optimistic update
    const previous = [...globalTasks];
    globalTasks = globalTasks.map((t) => (t.id === id ? { ...t, status: newStatus as Task["status"] } : t));
    notify();

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      const updated = await res.json();
      globalTasks = globalTasks.map((t) => (t.id === id ? updated : t));
      notify();
    } catch {
      globalTasks = previous;
      notify();
      setError("Failed to update task");
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    // Optimistic update
    const previous = [...globalTasks];
    globalTasks = globalTasks.filter((t) => t.id !== id);
    notify();

    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
    } catch {
      globalTasks = previous;
      notify();
      setError("Failed to delete task");
    }
  }, []);

  const renameTask = useCallback(async (id: string, title: string) => {
    const previous = [...globalTasks];
    globalTasks = globalTasks.map((t) => (t.id === id ? { ...t, title } : t));
    notify();

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to rename task");
      const updated = await res.json();
      globalTasks = globalTasks.map((t) => (t.id === id ? updated : t));
      notify();
    } catch {
      globalTasks = previous;
      notify();
      setError("Failed to rename task");
    }
  }, []);

  const advanceAll = useCallback(async (from: string, to: string) => {
    const matching = globalTasks.filter((t) => t.status === from);
    if (matching.length === 0) return;

    // Optimistic update
    const previous = [...globalTasks];
    globalTasks = globalTasks.map((t) => (t.status === from ? { ...t, status: to as Task["status"] } : t));
    notify();

    try {
      const res = await fetch("/api/tasks/advance-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      if (!res.ok) throw new Error("Failed to advance tasks");
      fetchTasks(); // Re-sync from server
    } catch {
      globalTasks = previous;
      notify();
      setError("Failed to advance tasks");
    }
  }, []);

  const clearCompleted = useCallback(async () => {
    const completedIds = globalTasks.filter((t) => t.status === "completed").map((t) => t.id);
    if (completedIds.length === 0) return;

    // Optimistic update
    const previous = [...globalTasks];
    globalTasks = globalTasks.filter((t) => t.status !== "completed");
    notify();

    try {
      const res = await fetch("/api/tasks/clear-completed", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear completed tasks");
    } catch {
      globalTasks = previous;
      notify();
      setError("Failed to clear completed tasks");
    }
  }, []);

  const updatePriority = useCallback(async (id: string, priority: TaskPriority) => {
    const previous = [...globalTasks];
    globalTasks = globalTasks.map((t) => (t.id === id ? { ...t, priority } : t));
    notify();

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      if (!res.ok) throw new Error("Failed to update priority");
      const updated = await res.json();
      globalTasks = globalTasks.map((t) => (t.id === id ? updated : t));
      notify();
    } catch {
      globalTasks = previous;
      notify();
      setError("Failed to update priority");
    }
  }, []);

  const updateDescription = useCallback(async (id: string, description: string) => {
    const previous = [...globalTasks];
    globalTasks = globalTasks.map((t) => (t.id === id ? { ...t, description } : t));
    notify();

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) throw new Error("Failed to update description");
      const updated = await res.json();
      globalTasks = globalTasks.map((t) => (t.id === id ? updated : t));
      notify();
    } catch {
      globalTasks = previous;
      notify();
      setError("Failed to update description");
    }
  }, []);

  return { tasks: globalTasks, error: errorMessage, addTask, advanceTask, deleteTask, renameTask, updateDescription, updatePriority, clearCompleted, advanceAll };
}

// ============================================
// HELPERS
// ============================================

function formatEST(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }) + " EST";
  } catch {
    return iso;
  }
}

function parseSummaryLines(summary: string): string[] {
  return summary.split("\n").filter((line) => line.trim());
}

// ============================================
// EXPORTED HOOK — task counts for collapsed badges
// ============================================

export function useTaskCounts() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.push(listener);

    // Start polling if first subscriber
    if (!pollInterval) {
      fetchTasks();
      pollInterval = window.setInterval(fetchTasks, 3000);
    }

    return () => {
      listeners = listeners.filter((l) => l !== listener);
      if (listeners.length === 0 && pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
  }, []);

  const pending = globalTasks.filter((t) => t.status === "pending").length;
  const needsTesting = globalTasks.filter((t) => t.status === "needs_testing").length;
  return { pending, needsTesting };
}
