import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const TASKS_FILE = path.join(process.cwd(), "..", "tasks.json");

export type TaskPriority = "high" | "normal" | "low";

export interface Task {
  id: string;
  title: string;
  status: "pending" | "needs_testing" | "completed";
  createdAt: string;
  summary?: string;
  description?: string;
  priority?: TaskPriority;
}

export const VALID_STATUSES: Task["status"][] = [
  "pending",
  "needs_testing",
  "completed",
];

// ============================================
// ASYNC MUTEX — prevents concurrent read-modify-write races
// ============================================

let lockPromise: Promise<void> = Promise.resolve();

function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const prev = lockPromise;
  let release: () => void;
  lockPromise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return prev.then(fn).finally(() => release());
}

// ============================================
// FILE I/O — atomic writes via temp file + rename
// ============================================

function tryParseTasksFile(filePath: string): Task[] | null {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readTasks(): Task[] {
  // Clean up stale temp file from a previously failed write
  const tmpFile = `${TASKS_FILE}.tmp`;
  try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}

  try {
    const data = fs.readFileSync(TASKS_FILE, "utf-8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      // File exists but has wrong structure — back up before overwriting
      console.error("[tasks] tasks.json has invalid structure (not an array), backing up");
      try { fs.copyFileSync(TASKS_FILE, `${TASKS_FILE}.backup`); } catch {}
      // Try to recover from the previous backup (from an earlier corruption)
      const recovered = tryParseTasksFile(`${TASKS_FILE}.backup`);
      if (recovered) {
        console.log(`[tasks] Recovered ${recovered.length} tasks from backup`);
        return recovered;
      }
      return [];
    }
    return parsed;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      // File doesn't exist yet — normal on first run
      return [];
    }
    // Parse error or other read error — file may be corrupted
    console.error(`[tasks] Failed to read tasks.json: ${err.message}. Backing up corrupt file.`);
    try { fs.copyFileSync(TASKS_FILE, `${TASKS_FILE}.backup`); } catch {}
    // Attempt auto-recovery from backup — prevents data loss on corruption
    const backupFile = `${TASKS_FILE}.backup`;
    const recovered = tryParseTasksFile(backupFile);
    if (recovered) {
      console.log(`[tasks] Auto-recovered ${recovered.length} tasks from backup`);
      // Restore the backup as the main file so subsequent reads work
      try {
        fs.copyFileSync(backupFile, TASKS_FILE);
        console.log("[tasks] Restored backup as tasks.json");
      } catch {}
      return recovered;
    }
    return [];
  }
}

// Track writes to create periodic backups of known-good data
let writeCount = 0;
const BACKUP_EVERY_N_WRITES = 10;

function writeTasks(tasks: Task[]): void {
  const tmpFile = `${TASKS_FILE}.tmp`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(tasks, null, 2));
    fs.renameSync(tmpFile, TASKS_FILE);

    // Periodically snapshot a known-good backup for recovery
    writeCount++;
    if (writeCount % BACKUP_EVERY_N_WRITES === 0) {
      try { fs.copyFileSync(TASKS_FILE, `${TASKS_FILE}.backup`); } catch {}
    }
  } catch (err) {
    // Clean up temp file if rename failed — original file is still intact
    try { fs.unlinkSync(tmpFile); } catch {}
    throw err;
  }
}

// ============================================
// CONSTANTS
// ============================================

const MAX_TASKS = 500;

// UUID v4 pattern for ID validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidTaskId(id: string): boolean {
  // Accept both UUID format and legacy prefixed IDs (e.g. "test-ui-001")
  return UUID_RE.test(id) || /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

// ============================================
// PUBLIC API — all operations go through the lock
// ============================================

export function getAllTasks(): Promise<Task[]> {
  return withLock(() => readTasks());
}

// Number of oldest completed tasks to purge when approaching the limit
const PURGE_BATCH = 50;

export const VALID_PRIORITIES: TaskPriority[] = ["high", "normal", "low"];

export function createTask(
  title: string,
  options?: { status?: Task["status"]; summary?: string; description?: string; priority?: TaskPriority }
): Promise<Task> {
  return withLock(() => {
    let tasks = readTasks();

    // Auto-purge oldest completed tasks when nearing the limit
    if (tasks.length >= MAX_TASKS) {
      const completed = tasks
        .map((t, i) => ({ task: t, index: i }))
        .filter(({ task }) => task.status === "completed")
        .sort((a, b) => new Date(a.task.createdAt).getTime() - new Date(b.task.createdAt).getTime());

      if (completed.length > 0) {
        const toRemove = new Set(
          completed.slice(0, Math.min(PURGE_BATCH, completed.length)).map(({ task }) => task.id)
        );
        tasks = tasks.filter((t) => !toRemove.has(t.id));
        console.log(`[tasks] Auto-purged ${toRemove.size} oldest completed tasks (was at limit of ${MAX_TASKS})`);
      }

      // If still at limit after purge (all active tasks), reject
      if (tasks.length >= MAX_TASKS) {
        throw new Error(`Task limit reached (${MAX_TASKS}). Delete old tasks first.`);
      }
    }

    const task: Task = {
      id: randomUUID(),
      title,
      status: options?.status || "pending",
      createdAt: new Date().toISOString(),
    };
    if (options?.summary) task.summary = options.summary;
    if (options?.description) task.description = options.description;
    if (options?.priority && VALID_PRIORITIES.includes(options.priority)) task.priority = options.priority;
    tasks.push(task);
    writeTasks(tasks);
    return task;
  });
}

export function updateTask(
  id: string,
  updates: { title?: string; status?: Task["status"]; summary?: string; description?: string; priority?: TaskPriority }
): Promise<Task | null> {
  return withLock(() => {
    const tasks = readTasks();
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;

    if (updates.title !== undefined) {
      tasks[index].title = updates.title;
    }
    if (updates.status !== undefined) {
      tasks[index].status = updates.status;
    }
    if (updates.summary !== undefined) {
      tasks[index].summary = updates.summary;
    }
    if (updates.description !== undefined) {
      tasks[index].description = updates.description;
    }
    if (updates.priority !== undefined) {
      if (VALID_PRIORITIES.includes(updates.priority)) {
        tasks[index].priority = updates.priority;
      }
    }

    writeTasks(tasks);
    return tasks[index];
  });
}

export function advanceAllByStatus(fromStatus: Task["status"], toStatus: Task["status"]): Promise<number> {
  return withLock(() => {
    const tasks = readTasks();
    let count = 0;
    for (const task of tasks) {
      if (task.status === fromStatus) {
        task.status = toStatus;
        count++;
      }
    }
    if (count > 0) {
      writeTasks(tasks);
      console.log(`[tasks] Advanced ${count} tasks from ${fromStatus} to ${toStatus}`);
    }
    return count;
  });
}

export function clearCompletedTasks(): Promise<number> {
  return withLock(() => {
    const tasks = readTasks();
    const remaining = tasks.filter((t) => t.status !== "completed");
    const cleared = tasks.length - remaining.length;
    if (cleared > 0) {
      writeTasks(remaining);
      console.log(`[tasks] Cleared ${cleared} completed tasks`);
    }
    return cleared;
  });
}

export function deleteTask(id: string): Promise<boolean> {
  return withLock(() => {
    const tasks = readTasks();
    const filtered = tasks.filter((t) => t.id !== id);
    if (filtered.length === tasks.length) return false;
    writeTasks(filtered);
    return true;
  });
}
