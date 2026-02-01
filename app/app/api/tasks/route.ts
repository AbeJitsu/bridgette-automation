import { NextResponse } from "next/server";
import { getAllTasks, createTask, VALID_STATUSES, VALID_PRIORITIES, type Task, type TaskPriority } from "./task-store";
import { isAuthorized, unauthorizedResponse, parseJsonBody } from "@/lib/auth";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorizedResponse();
  try {
    const tasks = await getAllTasks();
    return NextResponse.json(tasks);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to read tasks";
    console.error("[tasks GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorizedResponse();
  const result = await parseJsonBody(request);
  if (result instanceof NextResponse) return result;
  const body = result;

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  if (title.length > 500) {
    return NextResponse.json(
      { error: "Title must be 500 characters or fewer" },
      { status: 400 }
    );
  }

  const options: { status?: Task["status"]; summary?: string; description?: string; priority?: TaskPriority } = {};
  if (body.status && VALID_STATUSES.includes(body.status as Task["status"])) {
    options.status = body.status as Task["status"];
  }
  if (typeof body.summary === "string") {
    options.summary = body.summary.slice(0, 5000);
  }
  if (typeof body.description === "string") {
    options.description = body.description.slice(0, 2000);
  }
  if (body.priority && VALID_PRIORITIES.includes(body.priority as TaskPriority)) {
    options.priority = body.priority as TaskPriority;
  }

  try {
    const task = await createTask(title, options);
    return NextResponse.json(task, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create task";
    console.error("[tasks POST]", message);
    // Task limit reached returns 409 Conflict; other errors 500
    const status = message.includes("Task limit") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
