"use client";

import { useEffect, useState, useCallback } from "react";

interface Task {
  id: string;
  title: string;
  status: "pending" | "needs_testing" | "completed";
  createdAt: string;
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

export function LeftTaskPanel() {
  const { tasks, error, addTask, advanceTask, deleteTask } = useTasks();
  const [newTitle, setNewTitle] = useState("");

  const pending = tasks.filter((t) => t.status === "pending");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addTask(newTitle.trim());
    setNewTitle("");
  }

  return (
    <div className="flex flex-col h-full border-r border-white/[0.06] w-[240px] flex-shrink-0" style={{ background: 'var(--surface-1)' }}>
      <div className="px-3.5 py-2.5 border-b border-white/[0.06]">
        <h2 className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>Pending</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {pending.map((task) => (
          <TaskItem key={task.id} task={task} onAdvance={advanceTask} onDelete={deleteTask} />
        ))}
        {pending.length === 0 && (
          <p className="text-xs text-gray-600 px-2 py-6 text-center">No pending tasks</p>
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
            className="bg-emerald-500/80 text-white px-2.5 py-1.5 rounded-lg text-sm hover:bg-emerald-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 shadow-sm shadow-emerald-500/15 disabled:shadow-none"
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

export function RightTaskPanel() {
  const { tasks, advanceTask, deleteTask } = useTasks();

  const needsTesting = tasks.filter((t) => t.status === "needs_testing");
  const completed = tasks.filter((t) => t.status === "completed");
  const [showCompleted, setShowCompleted] = useState(false);

  return (
    <div className="flex flex-col h-full border-l border-white/[0.06] w-[240px] flex-shrink-0" style={{ background: 'var(--surface-1)' }}>
      {/* Needs Testing */}
      <div className="px-3.5 py-2.5 border-b border-white/[0.06]">
        <h2 className="text-[10px] uppercase tracking-widest text-amber-400/80 font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>Needs Testing</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {needsTesting.map((task) => (
          <TaskItem key={task.id} task={task} onAdvance={advanceTask} onDelete={deleteTask} />
        ))}
        {needsTesting.length === 0 && (
          <p className="text-xs text-gray-600 px-2 py-6 text-center">Nothing to test</p>
        )}
      </div>

      {/* Completed */}
      <div className="border-t border-white/[0.06]">
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.03] transition-colors duration-150"
        >
          <h2 className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>
            Completed ({completed.length})
          </h2>
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`text-gray-600 transition-transform duration-200 ${showCompleted ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {showCompleted && (
          <div className="px-2 pb-2 space-y-0.5 max-h-48 overflow-y-auto">
            {completed.map((task) => (
              <TaskItem key={task.id} task={task} onAdvance={advanceTask} onDelete={deleteTask} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// TASK ITEM
// ============================================

function TaskItem({
  task,
  onAdvance,
  onDelete,
}: {
  task: Task;
  onAdvance: (id: string) => void;
  onDelete: (id: string) => void;
}) {
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
    <div className="group flex items-start gap-2 px-2.5 py-2 rounded-lg hover:bg-white/[0.03] focus-within:bg-white/[0.03] transition-all duration-150">
      <button
        onClick={() => onAdvance(task.id)}
        className={`mt-0.5 text-sm flex-shrink-0 ${statusIcon[task.status]} hover:text-emerald-400 transition-colors duration-150`}
        aria-label={`${advanceTitle[task.status]}: ${task.title}`}
        title={advanceTitle[task.status]}
      >
        {statusSymbol[task.status]}
      </button>
      <span
        className={`text-[13px] flex-1 leading-snug ${
          task.status === "completed" ? "text-gray-600 line-through" : "text-gray-300"
        }`}
      >
        {task.title}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150">
        {task.status !== "completed" && (
          <button
            onClick={() => onAdvance(task.id)}
            className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors duration-150"
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

  return { tasks: globalTasks, error: errorMessage, addTask, advanceTask, deleteTask };
}
