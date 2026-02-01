import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TASKS_FILE = path.join(process.cwd(), "..", "tasks.json");

interface Task {
  id: string;
  title: string;
  status: "pending" | "needs_testing" | "completed";
  createdAt: string;
}

function readTasks(): Task[] {
  try {
    const data = fs.readFileSync(TASKS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeTasks(tasks: Task[]): void {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const tasks = readTasks();
  const index = tasks.findIndex((t) => t.id === id);

  if (index === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.title) tasks[index].title = body.title;

  const VALID_STATUSES: Task["status"][] = ["pending", "needs_testing", "completed"];
  if (body.status) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    tasks[index].status = body.status;
  }

  writeTasks(tasks);
  return NextResponse.json(tasks[index]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tasks = readTasks();
  const filtered = tasks.filter((t) => t.id !== id);

  if (filtered.length === tasks.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  writeTasks(filtered);
  return NextResponse.json({ ok: true });
}
