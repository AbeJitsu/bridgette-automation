import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const EVAL_LOG_FILE = path.join(process.cwd(), "..", "eval-log.json");

interface EvalLogEntry {
  id: string;
  evalType: "frontend" | "backend" | "functionality";
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

export async function GET() {
  const logs = readEvalLogs();
  // Most recent first, capped at 50
  const sorted = logs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50);
  return NextResponse.json(sorted);
}
