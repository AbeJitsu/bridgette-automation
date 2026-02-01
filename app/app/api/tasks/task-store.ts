import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const TASKS_FILE = path.join(process.cwd(), "..", "tasks.json");

export interface Task {
  id: string;
  title: string;
  status: "pending" | "needs_testing" | "completed";
  createdAt: string;
  summary?: string;
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

function readTasks(): Task[] {
  try {
    const data = fs.readFileSync(TASKS_FILE, "utf-8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeTasks(tasks: Task[]): void {
  const tmpFile = `${TASKS_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(tasks, null, 2));
  fs.renameSync(tmpFile, TASKS_FILE);
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

export function createTask(
  title: string,
  options?: { status?: Task["status"]; summary?: string }
): Promise<Task> {
  return withLock(() => {
    const tasks = readTasks();
    if (tasks.length >= MAX_TASKS) {
      throw new Error(`Task limit reached (${MAX_TASKS}). Delete old tasks first.`);
    }
    const task: Task = {
      id: randomUUID(),
      title,
      status: options?.status || "pending",
      createdAt: new Date().toISOString(),
    };
    if (options?.summary) task.summary = options.summary;
    tasks.push(task);
    writeTasks(tasks);
    return task;
  });
}

export function updateTask(
  id: string,
  updates: { title?: string; status?: Task["status"]; summary?: string }
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

    writeTasks(tasks);
    return tasks[index];
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
