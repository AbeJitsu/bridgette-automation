import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isAuthorized, unauthorizedResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

const EVAL_LOG_FILE = path.join(process.cwd(), "..", "eval-log.json");

interface EvalLogEntry {
  id: string;
  evalType: "frontend" | "backend" | "functionality" | "memory";
  timestamp: string;
  branch: string;
  commitHash: string;
  diffSummary: string;
  status: "success" | "error" | "timeout";
}

function readEvalLogs(): EvalLogEntry[] {
  try {
    const data = fs.readFileSync(EVAL_LOG_FILE, "utf-8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

const VALID_EVAL_TYPES = new Set(["frontend", "backend", "functionality", "memory"]);
const VALID_STATUSES = new Set(["success", "error", "timeout"]);
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse();

  const url = request.nextUrl;
  const typeFilter = url.searchParams.get("type");
  const statusFilter = url.searchParams.get("status");
  const limitParam = parseInt(url.searchParams.get("limit") || "", 10);
  const offsetParam = parseInt(url.searchParams.get("offset") || "", 10);

  const limit = !isNaN(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = !isNaN(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

  let logs = readEvalLogs();

  // Filter by eval type if provided
  if (typeFilter && VALID_EVAL_TYPES.has(typeFilter)) {
    logs = logs.filter((l) => l.evalType === typeFilter);
  }

  // Filter by status if provided
  if (statusFilter && VALID_STATUSES.has(statusFilter)) {
    logs = logs.filter((l) => l.status === statusFilter);
  }

  // Most recent first, then paginate
  const sorted = logs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const total = sorted.length;
  const paginated = sorted.slice(offset, offset + limit);

  // Return plain array for backward compatibility with frontend (expects Array.isArray check)
  // Pagination metadata available via response headers for API consumers
  const response = NextResponse.json(paginated);
  response.headers.set("X-Total-Count", String(total));
  response.headers.set("X-Limit", String(limit));
  response.headers.set("X-Offset", String(offset));
  return response;
}
