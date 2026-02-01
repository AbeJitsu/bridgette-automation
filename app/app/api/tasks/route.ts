import { NextResponse } from "next/server";
import { getAllTasks, createTask } from "./task-store";

export async function GET() {
  const tasks = await getAllTasks();
  return NextResponse.json(tasks);
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

  const task = await createTask(title);
  return NextResponse.json(task, { status: 201 });
}
