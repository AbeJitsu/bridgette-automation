import { NextResponse } from "next/server";
import { getAllTasks, createTask, VALID_STATUSES, type Task } from "./task-store";

export async function GET() {
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
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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

  const options: { status?: Task["status"]; summary?: string } = {};
  if (body.status && VALID_STATUSES.includes(body.status as Task["status"])) {
    options.status = body.status as Task["status"];
  }
  if (typeof body.summary === "string") {
    options.summary = body.summary.slice(0, 5000);
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
