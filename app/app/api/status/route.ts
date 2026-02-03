import { NextResponse } from "next/server";
import { isAuthorized, unauthorizedResponse } from "@/lib/auth";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const PROJECT_ROOT = join(process.cwd(), "..");

function getMemoryFiles(): { name: string; modified: string; size: number }[] {
  const memoryDir = join(PROJECT_ROOT, "memory");
  if (!existsSync(memoryDir)) return [];

  const results: { name: string; modified: string; size: number }[] = [];
  function walk(dir: string, prefix: string) {
    try {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath, prefix ? `${prefix}/${entry}` : entry);
        } else if (entry.endsWith(".md")) {
          results.push({
            name: prefix ? `${prefix}/${entry}` : entry,
            modified: stat.mtime.toISOString(),
            size: stat.size,
          });
        }
      }
    } catch {}
  }
  walk(memoryDir, "");
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

function getAutoEvalConfig(): {
  enabled: boolean;
  interval: number;
  currentIndex: number;
  evalTypes: string[];
  chaining: boolean;
} {
  const evalTypes = ["frontend", "backend", "functionality", "memory"];
  let enabled = false;
  let interval = 15 * 60 * 1000;
  let currentIndex = 0;

  try {
    enabled = readFileSync(join(PROJECT_ROOT, ".auto-eval-enabled"), "utf-8").trim() === "true";
  } catch {}
  try {
    const val = parseInt(readFileSync(join(PROJECT_ROOT, ".auto-eval-interval"), "utf-8").trim(), 10);
    if (!isNaN(val) && val >= 60000 && val <= 7200000) interval = val;
  } catch {}
  try {
    const val = parseInt(readFileSync(join(PROJECT_ROOT, ".auto-eval-index"), "utf-8").trim(), 10);
    if (!isNaN(val)) currentIndex = val % evalTypes.length;
  } catch {}

  return { enabled, interval, currentIndex, evalTypes, chaining: false };
}

// Timeout for shell commands — prevents blocking the server if git or launchctl hangs
const EXEC_TIMEOUT_MS = 5000;

function getGitInfo(): { branch: string; lastCommit: string; lastCommitDate: string } {
  const cwd = PROJECT_ROOT;
  const opts = { cwd, stdio: "pipe" as const, timeout: EXEC_TIMEOUT_MS };
  try {
    // Single git command instead of 3 sequential calls — prevents 15s blocking if git hangs
    const output = execSync("git log -1 --format=%D%n%s%n%ci", opts).toString().trim();
    const lines = output.split("\n");
    // %D gives "HEAD -> branch, origin/branch" — extract the branch name
    const refLine = lines[0] || "";
    const branchMatch = refLine.match(/HEAD -> ([^,]+)/);
    const branch = branchMatch ? branchMatch[1].trim() : execSync("git branch --show-current", opts).toString().trim();
    const lastCommit = lines[1] || "unknown";
    const lastCommitDate = lines[2] || "";
    return { branch, lastCommit, lastCommitDate };
  } catch {
    return { branch: "unknown", lastCommit: "unknown", lastCommitDate: "" };
  }
}

// Only allow safe characters in launchd labels to prevent shell injection
const SAFE_LABEL_RE = /^[a-zA-Z0-9._-]+$/;

function getLaunchdJobs(): { name: string; loaded: boolean }[] {
  const launchdDir = join(PROJECT_ROOT, "launchd");
  if (!existsSync(launchdDir)) return [];

  const results: { name: string; loaded: boolean }[] = [];
  try {
    const files = readdirSync(launchdDir).filter((f) => f.endsWith(".plist"));
    for (const file of files) {
      const label = file.replace(".plist", "");
      // Skip labels with unsafe characters to prevent shell injection
      if (!SAFE_LABEL_RE.test(label)) {
        console.warn(`[status] Skipping plist with unsafe label: ${file}`);
        continue;
      }
      let loaded = false;
      try {
        execSync(`launchctl list ${label}`, { stdio: "pipe", timeout: EXEC_TIMEOUT_MS });
        loaded = true;
      } catch {
        loaded = false;
      }
      results.push({ name: label, loaded });
    }
  } catch {}
  return results;
}

function getNightlyConfig(): {
  enabled: boolean;
  startHour: number;
  startMinute: number;
  intervalMinutes: number;
  nextRun: string | null;
} {
  const DEFAULT_CONFIG = {
    enabled: false,
    startHour: 3,
    startMinute: 0,
    intervalMinutes: 60,
    nextRun: null,
  };

  try {
    const configPath = join(PROJECT_ROOT, ".nightly-eval-config");
    if (!existsSync(configPath)) {
      return DEFAULT_CONFIG;
    }
    const data = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(data);
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : false,
      startHour: typeof parsed.startHour === "number" ? parsed.startHour : 3,
      startMinute: typeof parsed.startMinute === "number" ? parsed.startMinute : 0,
      intervalMinutes: typeof parsed.intervalMinutes === "number" ? parsed.intervalMinutes : 60,
      nextRun: null, // nextRun is computed server-side and broadcast via WS
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorizedResponse();

  return NextResponse.json({
    server: {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
    },
    git: getGitInfo(),
    memoryFiles: getMemoryFiles(),
    autoEval: getAutoEvalConfig(),
    nightly: getNightlyConfig(),
    launchdJobs: getLaunchdJobs(),
  });
}
