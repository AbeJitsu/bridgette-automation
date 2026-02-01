import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const TASKS_FILE = path.join(process.cwd(), "..", "tasks.json");

export interface Task {
  id: string;
  title: string;
  status: "pending" | "needs_testing" | "completed";
  createdAt: string;
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
// PUBLIC API — all operations go through the lock
// ============================================

export function getAllTasks(): Promise<Task[]> {
  return withLock(() => readTasks());
}

export function createTask(title: string): Promise<Task> {
  return withLock(() => {
    const tasks = readTasks();
    const task: Task = {
      id: randomUUID(),
      title,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    tasks.push(task);
    writeTasks(tasks);
    return task;
  });
}

export function updateTask(
  id: string,
  updates: { title?: string; status?: Task["status"] }
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
