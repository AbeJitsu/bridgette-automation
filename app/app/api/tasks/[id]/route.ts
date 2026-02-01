import { NextResponse } from "next/server";
import { updateTask, deleteTask, isValidTaskId, VALID_STATUSES, VALID_PRIORITIES, type Task, type TaskPriority } from "../task-store";
import { isAuthorized, unauthorizedResponse, parseJsonBody } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isAuthorized(request)) return unauthorizedResponse();

  if (!isValidTaskId(id)) {
    return NextResponse.json({ error: "Invalid task ID format" }, { status: 400 });
  }

  const result = await parseJsonBody(request);
  if (result instanceof NextResponse) return result;
  const body = result;

  const updates: { title?: string; status?: Task["status"]; summary?: string; description?: string; priority?: TaskPriority } = {};

  if (typeof body.title === "string" && body.title.trim()) {
    const title = body.title.trim();
    if (title.length > 500) {
      return NextResponse.json(
        { error: "Title must be 500 characters or fewer" },
        { status: 400 }
      );
    }
    updates.title = title;
  }

  if (body.status) {
    if (!VALID_STATUSES.includes(body.status as Task["status"])) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    updates.status = body.status as Task["status"];
  }

  if (typeof body.summary === "string") {
    updates.summary = body.summary.slice(0, 5000);
  }
  if (typeof body.description === "string") {
    updates.description = body.description.slice(0, 2000);
  }
  if (body.priority !== undefined) {
    if (VALID_PRIORITIES.includes(body.priority as TaskPriority)) {
      updates.priority = body.priority as TaskPriority;
    } else {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}` },
        { status: 400 }
      );
    }
  }

  try {
    const task = await updateTask(id, updates);
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(task);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update task";
    console.error("[tasks PUT]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isAuthorized(request)) return unauthorizedResponse();

  if (!isValidTaskId(id)) {
    return NextResponse.json({ error: "Invalid task ID format" }, { status: 400 });
  }

  try {
    const deleted = await deleteTask(id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete task";
    console.error("[tasks DELETE]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
