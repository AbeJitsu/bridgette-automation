import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { spawn, ChildProcess, execSync } from "child_process";
import { readFileSync, writeFileSync, renameSync, copyFileSync, existsSync, readdirSync, statSync, lstatSync } from "fs";
import { join } from "path";
import crypto from "crypto";
import { getNextAutomation } from "./lib/automation-queue";
import * as pty from "node-pty";

// Load .env if present
try {
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch {}

const BRIDGETTE_TOKEN = process.env.BRIDGETTE_TOKEN || "";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.BRIDGETTE_HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ============================================
// SERVER-LEVEL AUTO-EVAL STATE
// ============================================

const autoEvalFile = join(process.cwd(), "..", ".auto-eval-enabled");
const autoEvalIntervalFile = join(process.cwd(), "..", ".auto-eval-interval");

const DEFAULT_EVAL_INTERVAL = 15 * 60 * 1000; // 15 minutes
const MIN_EVAL_INTERVAL = 60 * 1000; // 1 minute
const MAX_EVAL_INTERVAL = 120 * 60 * 1000; // 2 hours

function loadAutoEvalEnabled(): boolean {
  try {
    return readFileSync(autoEvalFile, "utf-8").trim() === "true";
  } catch {
    return false;
  }
}

function saveAutoEvalEnabled(enabled: boolean): void {
  try { writeFileSync(autoEvalFile, String(enabled)); } catch {}
}

function loadEvalInterval(): number {
  try {
    const val = parseInt(readFileSync(autoEvalIntervalFile, "utf-8").trim(), 10);
    if (!isNaN(val) && val >= MIN_EVAL_INTERVAL && val <= MAX_EVAL_INTERVAL) return val;
  } catch {}
  return DEFAULT_EVAL_INTERVAL;
}

function saveEvalInterval(ms: number): void {
  try { writeFileSync(autoEvalIntervalFile, String(ms)); } catch {}
}

let serverAutoEvalEnabled = loadAutoEvalEnabled();
let serverEvalInterval = loadEvalInterval();
let serverIdleTimer: NodeJS.Timeout | null = null;
let serverAutoEvalProcess: ChildProcess | null = null;
let evalChaining = false;
let serverIdleTimerStart: number | null = null;

const EVAL_CHAIN_COOLDOWN = 30 * 1000; // 30 seconds between chained evals

// ============================================
// RATE LIMIT DETECTION & RETRY CONFIG
// ============================================

const RATE_LIMIT_PATTERNS = [
  /rate.?limit/i,
  /usage.?limit/i,
  /\b429\b/,
  /too many requests/i,
  /capacity/i,
  /overloaded/i,
];

function isRateLimitError(text: string): boolean {
  return RATE_LIMIT_PATTERNS.some((p) => p.test(text));
}

// Exponential backoff: 30s, 60s, 120s, 240s, 480s (~15 min total)
const RETRY_DELAYS = [30, 60, 120, 240, 480];

function getRetryDelay(attempt: number): number | null {
  return attempt < RETRY_DELAYS.length ? RETRY_DELAYS[attempt] : null;
}

// Three-eval rotation system
const EVAL_TYPES = ["frontend", "backend", "functionality", "memory"] as const;
type EvalType = (typeof EVAL_TYPES)[number];
const autoEvalIndexFile = join(process.cwd(), "..", ".auto-eval-index");

function loadEvalIndex(): number {
  try {
    const val = parseInt(readFileSync(autoEvalIndexFile, "utf-8").trim(), 10);
    return isNaN(val) ? 0 : val % EVAL_TYPES.length;
  } catch {
    return 0;
  }
}

function saveEvalIndex(index: number): void {
  try { writeFileSync(autoEvalIndexFile, String(index)); } catch {}
}

let currentEvalType: EvalType | null = null;

// ============================================
// EVAL LOG — persists eval run history
// ============================================

const EVAL_LOG_FILE = join(process.cwd(), "..", "eval-log.json");
const MAX_EVAL_LOG_ENTRIES = 200;
let evalLogWriteCount = 0;

interface EvalLogEntry {
  id: string;
  evalType: string;
  timestamp: string;
  branch: string;
  commitHash: string;
  diffSummary: string;
  status: "success" | "error" | "timeout";
}

// Mutex for eval-log writes — prevents concurrent read-modify-write races
let evalLogLock: Promise<void> = Promise.resolve();

function withEvalLogLock<T>(fn: () => T): Promise<T> {
  const prev = evalLogLock;
  let release: () => void;
  evalLogLock = new Promise<void>((resolve) => { release = resolve; });
  return prev.then(fn).finally(() => release());
}

function writeEvalLogEntry(entry: EvalLogEntry): Promise<void> {
  return withEvalLogLock(() => {
    try {
      let entries: EvalLogEntry[] = [];
      try {
        const data = readFileSync(EVAL_LOG_FILE, "utf-8");
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) entries = parsed;
      } catch {}
      entries.push(entry);
      if (entries.length > MAX_EVAL_LOG_ENTRIES) {
        entries = entries.slice(entries.length - MAX_EVAL_LOG_ENTRIES);
      }
      // Atomic write: temp file + rename prevents corruption on crash
      const tmpFile = `${EVAL_LOG_FILE}.tmp`;
      writeFileSync(tmpFile, JSON.stringify(entries, null, 2));
      renameSync(tmpFile, EVAL_LOG_FILE);
      // Periodic backup for corruption recovery (every 5 writes)
      evalLogWriteCount++;
      if (evalLogWriteCount % 5 === 0) {
        try { copyFileSync(EVAL_LOG_FILE, `${EVAL_LOG_FILE}.backup`); } catch {}
      }
    } catch (err: any) {
      console.error(`[eval-log] Failed to write: ${err.message}`);
    }
  });
}

function getCommitHash(cwd: string): string {
  try {
    return execSync("git rev-parse HEAD", { cwd, stdio: "pipe", timeout: 5000 }).toString().trim();
  } catch {
    return "unknown";
  }
}

function describeChangedFiles(diffSummary: string): string {
  // Parse "filename | N ++--" lines into human-readable descriptions
  const fileLines = diffSummary.split("\n").filter((l) => l.includes("|"));
  const areas: string[] = [];
  for (const line of fileLines) {
    const file = line.split("|")[0].trim();
    if (file.includes("components/")) {
      const comp = file.match(/components\/(\w+)/)?.[1];
      if (comp && !areas.includes(comp)) areas.push(comp);
    } else if (file.includes("server.ts")) {
      if (!areas.includes("server")) areas.push("server");
    } else if (file.includes("api/")) {
      const route = file.match(/api\/(\w+)/)?.[1];
      if (route && !areas.includes(route + " API")) areas.push(route + " API");
    } else if (file.endsWith(".css")) {
      if (!areas.includes("styles")) areas.push("styles");
    } else if (file.endsWith(".md")) {
      if (!areas.includes("docs")) areas.push("docs");
    } else if (file.endsWith(".json")) {
      // skip config/data files
    } else {
      const name = file.split("/").pop()?.replace(/\.\w+$/, "");
      if (name && !areas.includes(name)) areas.push(name);
    }
  }
  if (areas.length === 0) return "various files";
  if (areas.length <= 3) return areas.join(", ");
  return areas.slice(0, 3).join(", ") + ` and ${areas.length - 3} more`;
}

function buildEvalSummary(evalType: string, diffSummary: string): string {
  const fileLines = diffSummary.split("\n").filter((l) => l.includes("|"));
  const fileCount = fileLines.length;
  const insertions = diffSummary.match(/(\d+) insertion/)?.[1] || "0";
  const deletions = diffSummary.match(/(\d+) deletion/)?.[1] || "0";
  const changedAreas = describeChangedFiles(diffSummary);
  const evalLabel = evalType.charAt(0).toUpperCase() + evalType.slice(1);

  return [
    `What: ${evalLabel} quality pass — updated ${changedAreas}`,
    `Why: Automatic ${evalType} improvements to keep code clean and polished`,
    `How: ${fileCount} file${fileCount !== 1 ? "s" : ""} changed (+${insertions} -${deletions} lines)`,
  ].join("\n");
}

function createEvalTask(evalType: string, diffSummary: string): void {
  const evalLabel = evalType.charAt(0).toUpperCase() + evalType.slice(1);
  const summary = buildEvalSummary(evalType, diffSummary);
  const title = `[Auto-eval] ${evalLabel} eval needs review`;

  import("./app/api/tasks/task-store").then(async ({ createTask, getAllTasks }) => {
    // Prevent duplicate: skip if there's already a needs_testing task for this eval type
    const existing = await getAllTasks();
    const hasDuplicate = existing.some(
      (t) => t.status === "needs_testing" && t.title === title
    );
    if (hasDuplicate) {
      console.log(`[auto-eval] Skipping duplicate task: ${title} (already exists in needs_testing)`);
      return;
    }
    return createTask(title, { status: "needs_testing", summary });
  }).then(() => {
    console.log(`[auto-eval] Created task: ${title}`);
  }).catch((err: Error) => {
    console.error(`[auto-eval] Failed to create task: ${err.message}`);
  });
}

// ============================================
// MEMORY SYSTEM — loads memory/*.md as system prompt
// ============================================

const MEMORY_DIR = join(process.cwd(), "..", "memory");
const MEMORY_CACHE_TTL = 60_000; // 60 seconds
let memoryCache: { content: string; timestamp: number } | null = null;

function collectMdFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      // Skip symlinks to prevent directory traversal outside memory/
      const lstat = lstatSync(fullPath);
      if (lstat.isSymbolicLink()) continue;
      if (lstat.isDirectory()) {
        results.push(...collectMdFiles(fullPath));
      } else if (entry.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  } catch {}
  return results;
}

function loadMemoryPrompt(): string {
  if (memoryCache && Date.now() - memoryCache.timestamp < MEMORY_CACHE_TTL) {
    return memoryCache.content;
  }

  if (!existsSync(MEMORY_DIR)) return "";

  const files = collectMdFiles(MEMORY_DIR).sort();
  if (files.length === 0) return "";

  const sections: string[] = [];
  for (const filePath of files) {
    try {
      const relativeName = filePath.slice(MEMORY_DIR.length + 1);
      const content = readFileSync(filePath, "utf-8").trim();
      if (content) {
        sections.push(`## ${relativeName}\n\n${content}`);
      }
    } catch {}
  }

  const prompt = sections.length > 0
    ? `# Memory\n\nThe following is your persistent memory — personality, identity, and context:\n\n${sections.join("\n\n---\n\n")}`
    : "";

  memoryCache = { content: prompt, timestamp: Date.now() };
  return prompt;
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url!, true);
    await handle(req, res, parsedUrl);
  });

  const wssChat = new WebSocketServer({ noServer: true });
  const wssTerminal = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname, query } = parse(req.url!, true);

    // Token auth check helper
    function checkAuth(): boolean {
      if (!BRIDGETTE_TOKEN) return true;
      const authHeader = req.headers["authorization"];
      const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
      const queryToken = typeof query.token === "string" ? query.token : null;
      return headerToken === BRIDGETTE_TOKEN || queryToken === BRIDGETTE_TOKEN;
    }

    if (pathname === "/ws/chat") {
      if (!checkAuth()) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wssChat.handleUpgrade(req, socket, head, (ws) => {
        wssChat.emit("connection", ws, req);
      });
    } else if (pathname === "/ws/terminal") {
      if (!checkAuth()) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wssTerminal.handleUpgrade(req, socket, head, (ws) => {
        wssTerminal.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  // ============================================
  // CHAT WebSocket — claude --print --stream-json
  // ============================================

  // Per-connection state
  const chatSessions = new Map<WebSocket, string | null>();
  const chatProcesses = new Map<WebSocket, ChildProcess>();
  const chatCwds = new Map<WebSocket, string>();
  const chatAlive = new Map<WebSocket, boolean>();

  // Per-connection rate limit retry state
  interface ChatRetryState {
    timer: NodeJS.Timeout | null;
    countdownTimer: NodeJS.Timeout | null;
    attempt: number;
    text: string;
    sessionId: string | null;
    model: string | undefined;
  }
  const chatRetryStates = new Map<WebSocket, ChatRetryState>();

  // Module-level eval retry state
  let evalRetryAttempt = 0;
  let evalRetryTimer: NodeJS.Timeout | null = null;

  // ============================================
  // WEBSOCKET HEARTBEAT — detect stale connections
  // ============================================

  const HEARTBEAT_INTERVAL = 30_000; // 30 seconds

  const heartbeatTimer = setInterval(() => {
    wssChat.clients.forEach((ws) => {
      if (chatAlive.get(ws) === false) {
        // No pong received since last ping — connection is stale
        console.log("[ws] Terminating stale connection (no pong)");
        const proc = chatProcesses.get(ws);
        if (proc && proc.exitCode === null) {
          killProcessWithTimeout(proc);
        }
        chatProcesses.delete(ws);
        chatSessions.delete(ws);
        chatCwds.delete(ws);
        chatAlive.delete(ws);
        rateLimitCounters.delete(ws);
        const retryState = chatRetryStates.get(ws);
        if (retryState) {
          if (retryState.timer) clearTimeout(retryState.timer);
          if (retryState.countdownTimer) clearInterval(retryState.countdownTimer);
          chatRetryStates.delete(ws);
        }
        ws.terminate();
        return;
      }
      chatAlive.set(ws, false);
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  // ============================================
  // SERVER-LEVEL IDLE TIMER
  // ============================================

  function resetServerIdleTimer() {
    if (serverIdleTimer) clearTimeout(serverIdleTimer);
    serverIdleTimer = null;
    serverIdleTimerStart = null;

    if (!serverAutoEvalEnabled) return;

    const delay = evalChaining ? EVAL_CHAIN_COOLDOWN : serverEvalInterval;
    console.log(`[auto-eval] ${evalChaining ? "Chain" : "Idle"} timer set for ${Math.round(delay / 1000)}s`);
    serverIdleTimerStart = Date.now();
    serverIdleTimer = setTimeout(() => triggerServerAutoEval(), delay);

    // Broadcast timer state to clients
    broadcastToChat({ type: "eval_timer_state", evalTimerStart: serverIdleTimerStart, evalChaining });
  }

  // Timeout for shell commands — prevents blocking the event loop if git hangs
  const GIT_EXEC_TIMEOUT = 10_000;

  function getGitBranch(cwd: string): string {
    try {
      return execSync("git branch --show-current", { cwd, stdio: "pipe", timeout: GIT_EXEC_TIMEOUT }).toString().trim();
    } catch {
      return "unknown";
    }
  }

  function broadcastToChat(data: Record<string, unknown>) {
    const msg = JSON.stringify(data);
    wssChat.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  function killProcessWithTimeout(proc: ChildProcess, timeoutMs = 5000): void {
    if (!proc || proc.exitCode !== null) return;
    proc.kill("SIGTERM");
    const killTimer = setTimeout(() => {
      if (proc.exitCode === null) {
        console.warn("[process] SIGTERM did not exit in time, sending SIGKILL");
        proc.kill("SIGKILL");
      }
    }, timeoutMs);
    proc.once("exit", () => clearTimeout(killTimer));
  }

  function triggerServerAutoEval() {
    // Don't run if already running — use exitCode (reliable) instead of .killed (unreliable)
    if (serverAutoEvalProcess && serverAutoEvalProcess.exitCode === null) return;

    // Clear timer state — eval is now running
    serverIdleTimerStart = null;
    if (serverIdleTimer) clearTimeout(serverIdleTimer);
    serverIdleTimer = null;

    const cwd = getLastCwd();
    const branchName = "dev";

    try {
      const currentBranch = getGitBranch(cwd);
      if (currentBranch !== branchName) {
        try {
          execSync(`git checkout ${branchName}`, { cwd, stdio: "pipe", timeout: GIT_EXEC_TIMEOUT });
        } catch {
          execSync(`git checkout -b ${branchName}`, { cwd, stdio: "pipe", timeout: GIT_EXEC_TIMEOUT });
        }
      }
      // Keep dev up to date with main
      try {
        execSync("git merge main --no-edit", { cwd, stdio: "pipe", timeout: GIT_EXEC_TIMEOUT });
      } catch (mergeErr: any) {
        console.error(`Failed to merge main into dev: ${mergeErr.message}`);
        broadcastToChat({ type: "error", message: `Failed to merge main into dev: ${mergeErr.message}` });
        // Abort the failed merge and bail
        try { execSync("git merge --abort", { cwd, stdio: "pipe", timeout: GIT_EXEC_TIMEOUT }); } catch {}
        return;
      }
    } catch (err: any) {
      console.error(`Failed to switch to dev branch: ${err.message}`);
      broadcastToChat({ type: "error", message: `Failed to switch to dev branch: ${err.message}` });
      return;
    }

    // Rotation: pick the next eval type
    const evalIndex = loadEvalIndex();
    const evalType = EVAL_TYPES[evalIndex];
    currentEvalType = evalType;
    saveEvalIndex((evalIndex + 1) % EVAL_TYPES.length);

    // Create pending task for this eval run
    // The dynamic import is async — store the promise so the close handler can
    // await it before checking evalTaskId, preventing duplicate task creation.
    let evalTaskId: string | null = null;
    const evalLabel = evalType.charAt(0).toUpperCase() + evalType.slice(1);
    const taskCreationPromise = import("./app/api/tasks/task-store").then(({ createTask }) => {
      return createTask(`[Auto-eval] ${evalLabel} eval running...`, { status: "pending" });
    }).then((task) => {
      evalTaskId = task.id;
    }).catch((err: Error) => {
      console.error(`[auto-eval] Failed to create pending task: ${err.message}`);
    });

    // Notify connected clients
    broadcastToChat({ type: "auto_eval_start", branch: branchName, evalType });

    // Read the eval prompt for this type
    let prompt: string;
    try {
      const promptPath = join(process.cwd(), "..", "automations", "auto-eval", `${evalType}.md`);
      prompt = readFileSync(promptPath, "utf-8");
    } catch {
      // Fallback to generic prompt
      try {
        const fallbackPath = join(process.cwd(), "..", "automations", "auto-eval", "prompt.md");
        prompt = readFileSync(fallbackPath, "utf-8");
      } catch {
        console.error("Auto-eval prompt not found");
        broadcastToChat({ type: "error", message: "Auto-eval prompt not found" });
        currentEvalType = null;
        return;
      }
    }

    const home = process.env.HOME || "/Users/abereyes";
    const claudePath = `${home}/.local/bin/claude`;

    const args = [
      "-p",
      "--output-format=stream-json",
      "--verbose",
      "--include-partial-messages",
      prompt,
    ];

    const envPath = process.env.PATH || "";
    const localBin = `${home}/.local/bin`;
    const fullPath = envPath.includes(localBin) ? envPath : `${localBin}:${envPath}`;

    const proc = spawn(claudePath, args, {
      cwd,
      env: { ...process.env, PATH: fullPath },
      stdio: ["ignore", "pipe", "pipe"],
    });

    serverAutoEvalProcess = proc;

    // Safety timeout — kill if eval runs longer than 30 minutes
    const AUTO_EVAL_TIMEOUT = 30 * 60 * 1000;
    const evalTimeout = setTimeout(() => {
      if (proc && proc.exitCode === null) {
        console.error("[auto-eval] Timeout after 30 minutes — killing process");
        broadcastToChat({ type: "error", message: "Auto-eval timed out after 30 minutes" });
        writeEvalLogEntry({
          id: crypto.randomUUID(),
          evalType: currentEvalType || "unknown",
          timestamp: new Date().toISOString(),
          branch: getGitBranch(cwd),
          commitHash: getCommitHash(cwd),
          diffSummary: "Timed out after 30 minutes",
          status: "timeout",
        });
        killProcessWithTimeout(proc);
      }
    }, AUTO_EVAL_TIMEOUT);

    let buffer = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();

      // Guard against unbounded buffer growth
      if (buffer.length > MAX_STDOUT_BUFFER) {
        console.warn(`[auto-eval] stdout buffer exceeded ${MAX_STDOUT_BUFFER} bytes, discarding`);
        buffer = "";
        return;
      }

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Forward to any connected clients
        const hasClients = [...wssChat.clients].some((c) => c.readyState === WebSocket.OPEN);
        if (hasClients) {
          wssChat.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(trimmed);
            }
          });
        }
      }
    });

    let evalStderrBuffer = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      evalStderrBuffer += chunk.toString();
      // Cap stderr buffer to prevent memory exhaustion from verbose error output
      if (evalStderrBuffer.length > MAX_STDOUT_BUFFER) {
        evalStderrBuffer = evalStderrBuffer.slice(-MAX_STDOUT_BUFFER);
      }
    });

    proc.on("close", async (code) => {
      clearTimeout(evalTimeout);
      // Flush remaining buffer
      if (buffer.trim()) {
        try { broadcastToChat(JSON.parse(buffer.trim()) as Record<string, unknown>); } catch {}
      }
      buffer = "";
      serverAutoEvalProcess = null;
      const completedEvalType = currentEvalType;
      currentEvalType = null;

      // Detect whether the eval actually succeeded based on exit code
      const exitedCleanly = code === 0 || code === null;

      // Rate limit retry for eval
      if (!exitedCleanly && isRateLimitError(evalStderrBuffer)) {
        const delay = getRetryDelay(evalRetryAttempt);
        if (delay !== null) {
          console.log(`[auto-eval] Rate limited, retrying in ${delay}s (attempt ${evalRetryAttempt + 1}/${RETRY_DELAYS.length})`);
          broadcastToChat({
            type: "eval_rate_limit_retry",
            attempt: evalRetryAttempt + 1,
            maxAttempts: RETRY_DELAYS.length,
            delaySeconds: delay,
          });

          // Update task title to show retry
          if (evalTaskId) {
            import("./app/api/tasks/task-store").then(({ updateTask }) => {
              return updateTask(evalTaskId!, { title: `[Auto-eval] ${evalLabel} eval retrying in ${delay}s...` });
            }).catch(() => {});
          }

          evalRetryAttempt++;
          evalRetryTimer = setTimeout(() => {
            evalRetryTimer = null;
            triggerServerAutoEval();
          }, delay * 1000);
          return; // Don't log, don't chain, don't update task yet
        }
        // Retries exhausted — fall through
      }

      // Reset eval retry on completion (success or non-rate-limit failure)
      evalRetryAttempt = 0;

      // Log stderr if present
      if (evalStderrBuffer.trim()) {
        console.error(`[auto-eval stderr] ${evalStderrBuffer.trim()}`);
      }

      // Get change summary
      let summary = "";
      try {
        summary = execSync("git diff HEAD~1 --stat", { cwd, stdio: "pipe", timeout: GIT_EXEC_TIMEOUT }).toString().trim();
      } catch {
        summary = "No changes detected";
      }

      const evalBranch = getGitBranch(cwd);
      const commitHash = getCommitHash(cwd);

      // Wait for task creation to finish before checking evalTaskId — prevents
      // the race where close fires before the dynamic import resolves, which
      // would cause evalTaskId to be null and trigger duplicate task creation.
      await taskCreationPromise;

      // Write eval log entry — use exit code to determine real status
      const evalStatus = exitedCleanly ? "success" : "error";
      writeEvalLogEntry({
        id: crypto.randomUUID(),
        evalType: completedEvalType || "unknown",
        timestamp: new Date().toISOString(),
        branch: evalBranch,
        commitHash,
        diffSummary: exitedCleanly ? summary : `Process exited with code ${code}. ${summary}`,
        status: evalStatus,
      });

      if (!exitedCleanly) {
        console.error(`[auto-eval] Process exited with code ${code}`);
        broadcastToChat({ type: "error", message: `Auto-eval exited with code ${code}` });
      }

      // Update eval task: pending → needs_testing with summary (for user to review)
      if (completedEvalType && evalTaskId) {
        const evalSummary = buildEvalSummary(completedEvalType, summary);
        const evalTitle = `[Auto-eval] ${completedEvalType.charAt(0).toUpperCase() + completedEvalType.slice(1)} eval ${exitedCleanly ? "needs review" : "failed"}`;
        import("./app/api/tasks/task-store").then(({ updateTask }) => {
          return updateTask(evalTaskId!, {
            title: evalTitle,
            status: exitedCleanly ? "needs_testing" : "completed",
            summary: evalSummary,
          });
        }).catch((err: Error) => {
          console.error(`[auto-eval] Failed to update task: ${err.message}`);
        });
      } else if (completedEvalType && exitedCleanly) {
        // Fallback: create as needs_testing if we lost the task ID
        createEvalTask(completedEvalType, summary);
      }

      broadcastToChat({ type: "auto_eval_complete", summary, branch: evalBranch, evalType: completedEvalType, status: evalStatus });

      // Chain: next eval fires after short cooldown (only if auto-eval is still enabled)
      if (serverAutoEvalEnabled) {
        evalChaining = true;
        resetServerIdleTimer();
      }
    });

    proc.on("error", (err) => {
      clearTimeout(evalTimeout);
      console.error(`[auto-eval error] ${err.message}`);
      broadcastToChat({ type: "error", message: err.message });
      writeEvalLogEntry({
        id: crypto.randomUUID(),
        evalType: currentEvalType || "unknown",
        timestamp: new Date().toISOString(),
        branch: getGitBranch(cwd),
        commitHash: getCommitHash(cwd),
        diffSummary: err.message,
        status: "error",
      });
      serverAutoEvalProcess = null;
      currentEvalType = null;
      // Reset idle timer so evals keep running after errors
      resetServerIdleTimer();
    });
  }

  const defaultCwd = process.env.HOME || "/Users/abereyes";
  const cwdFile = require("path").join(process.cwd(), "..", ".last-cwd");

  function getLastCwd(): string {
    try {
      const saved = readFileSync(cwdFile, "utf-8").trim();
      if (saved && existsSync(saved)) {
        return saved;
      }
    } catch {}
    return defaultCwd;
  }

  function saveLastCwd(cwd: string): void {
    try { writeFileSync(cwdFile, cwd); } catch {}
  }

  // Maximum stdout buffer size (5MB) — if a single line exceeds this, discard and reset
  // Prevents unbounded memory growth if claude emits very long lines without newlines
  const MAX_STDOUT_BUFFER = 5 * 1024 * 1024;

  // Safety timeout for chat processes (10 minutes) — prevents hung claude processes
  const CHAT_PROCESS_TIMEOUT = 10 * 60 * 1000;

  // Maximum WebSocket message size (1MB) to prevent memory abuse
  const MAX_WS_MESSAGE_SIZE = 1024 * 1024;

  // Per-connection rate limiting — max 20 messages per 10 seconds
  const RATE_LIMIT_WINDOW = 10_000;
  const RATE_LIMIT_MAX = 20;
  const rateLimitCounters = new Map<WebSocket, { count: number; resetAt: number }>();

  // Allowed model values to prevent injection via the --model flag
  const ALLOWED_MODELS = new Set([
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
    "claude-opus-4-5-20251101",
    "claude-haiku-3-5-20241022",
    "sonnet",
    "opus",
    "haiku",
  ]);

  wssChat.on("connection", (ws: WebSocket) => {
    chatSessions.set(ws, null);
    chatAlive.set(ws, true);
    const initialCwd = getLastCwd();
    chatCwds.set(ws, initialCwd);

    ws.on("pong", () => {
      chatAlive.set(ws, true);
    });

    // Send initial state including branch and auto-eval
    const branch = getGitBranch(initialCwd);
    const evalRunning = !!serverAutoEvalProcess && serverAutoEvalProcess.exitCode === null;
    ws.send(JSON.stringify({ type: "state", cwd: initialCwd, branch, autoEval: serverAutoEvalEnabled, evalInterval: serverEvalInterval, evalRunning, evalType: evalRunning ? currentEvalType : null, evalTimerStart: serverIdleTimerStart, evalChaining }));

    // Process any pending automations queued by scheduled triggers (e.g., from curl POST)
    const pendingAuto = getNextAutomation();
    if (pendingAuto) {
      console.log("[automation] Executing queued automation prompt");
      handleChatMessage(ws, pendingAuto.prompt, chatSessions.get(ws) || null, undefined);
    }

    ws.on("message", (msg: Buffer | string) => {
      // Rate limiting — prevent message flooding
      const now = Date.now();
      let rl = rateLimitCounters.get(ws);
      if (!rl || now >= rl.resetAt) {
        rl = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
        rateLimitCounters.set(ws, rl);
      }
      rl.count++;
      if (rl.count > RATE_LIMIT_MAX) {
        ws.send(JSON.stringify({ type: "error", message: "Rate limit exceeded, slow down" }));
        return;
      }

      // Reject oversized messages
      const raw = msg.toString();
      if (raw.length > MAX_WS_MESSAGE_SIZE) {
        ws.send(JSON.stringify({ type: "error", message: "Message too large" }));
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        if (parsed.type === "message") {
          // Validate text is a non-empty string
          if (typeof parsed.text !== "string" || !parsed.text.trim()) {
            ws.send(JSON.stringify({ type: "error", message: "Message text required" }));
            return;
          }
          // Validate model if provided
          if (parsed.model && !ALLOWED_MODELS.has(parsed.model)) {
            ws.send(JSON.stringify({ type: "error", message: `Invalid model: ${parsed.model}` }));
            return;
          }
          evalChaining = false;
          resetServerIdleTimer();
          // Cancel any pending rate limit retry
          const pendingRetry = chatRetryStates.get(ws);
          if (pendingRetry) {
            if (pendingRetry.timer) clearTimeout(pendingRetry.timer);
            if (pendingRetry.countdownTimer) clearInterval(pendingRetry.countdownTimer);
            chatRetryStates.delete(ws);
            ws.send(JSON.stringify({ type: "retry_cancelled" }));
          }
          handleChatMessage(ws, parsed.text, parsed.sessionId || chatSessions.get(ws), parsed.model);
        } else if (parsed.type === "stop") {
          const proc = chatProcesses.get(ws);
          if (proc && proc.exitCode === null) {
            killProcessWithTimeout(proc);
          }
          // Cancel any pending rate limit retry
          const stopRetry = chatRetryStates.get(ws);
          if (stopRetry) {
            if (stopRetry.timer) clearTimeout(stopRetry.timer);
            if (stopRetry.countdownTimer) clearInterval(stopRetry.countdownTimer);
            chatRetryStates.delete(ws);
            ws.send(JSON.stringify({ type: "retry_cancelled" }));
          }
        } else if (parsed.type === "set_cwd") {
          const target = typeof parsed.cwd === "string" ? parsed.cwd : "";
          // Validate the path doesn't contain null bytes (path injection)
          if (!target || target.includes("\0")) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid directory path" }));
            return;
          }
          try {
            const targetStat = statSync(target);
            if (!targetStat.isDirectory()) {
              ws.send(JSON.stringify({ type: "error", message: `Not a directory: ${target}` }));
              return;
            }
          } catch {
            ws.send(JSON.stringify({ type: "error", message: `Directory not found: ${target}` }));
            return;
          }
          chatCwds.set(ws, target);
          saveLastCwd(target);
          chatSessions.set(ws, null);
          const branch = getGitBranch(target);
          const evalRunningNow = !!serverAutoEvalProcess && serverAutoEvalProcess.exitCode === null;
          ws.send(JSON.stringify({ type: "state", cwd: target, branch, autoEval: serverAutoEvalEnabled, evalInterval: serverEvalInterval, evalRunning: evalRunningNow, evalType: evalRunningNow ? currentEvalType : null, evalTimerStart: serverIdleTimerStart, evalChaining }));
        } else if (parsed.type === "set_auto_eval") {
          serverAutoEvalEnabled = !!parsed.enabled;
          saveAutoEvalEnabled(serverAutoEvalEnabled);
          if (serverAutoEvalEnabled) {
            evalChaining = false;
            resetServerIdleTimer();
          } else {
            if (serverIdleTimer) clearTimeout(serverIdleTimer);
            serverIdleTimer = null;
            serverIdleTimerStart = null;
            evalChaining = false;
          }
          // Broadcast to all clients
          broadcastToChat({ type: "auto_eval_state", enabled: serverAutoEvalEnabled, evalTimerStart: serverIdleTimerStart, evalChaining });
        } else if (parsed.type === "trigger_auto_eval") {
          triggerServerAutoEval();
        } else if (parsed.type === "stop_auto_eval") {
          if (serverAutoEvalProcess && serverAutoEvalProcess.exitCode === null) {
            console.log("[auto-eval] Stopping eval via user request");
            killProcessWithTimeout(serverAutoEvalProcess);
          }
          // Cancel eval retry timer if pending
          if (evalRetryTimer) {
            clearTimeout(evalRetryTimer);
            evalRetryTimer = null;
            evalRetryAttempt = 0;
          }
        } else if (parsed.type === "set_eval_interval") {
          const ms = typeof parsed.interval === "number" ? parsed.interval : 0;
          if (ms >= MIN_EVAL_INTERVAL && ms <= MAX_EVAL_INTERVAL) {
            serverEvalInterval = ms;
            saveEvalInterval(ms);
            resetServerIdleTimer();
            broadcastToChat({ type: "eval_interval_state", interval: serverEvalInterval, evalTimerStart: serverIdleTimerStart, evalChaining });
          }
        } else if (parsed.type === "trigger_automation") {
          // Receive automation prompt from API and forward to chat as a user message
          const prompt = typeof parsed.prompt === "string" ? parsed.prompt : null;
          if (prompt) {
            handleChatMessage(ws, prompt, chatSessions.get(ws) || null, undefined);
          }
        } else if (parsed.type === "restart_server") {
          console.log("[server] Restart requested via WebSocket");
          // Notify all clients before shutting down
          broadcastToChat({ type: "restarting" });
          // Give clients a moment to receive the message, then exit
          // launchd KeepAlive will restart the process
          setTimeout(() => {
            console.log("[server] Shutting down for restart...");
            process.exit(0);
          }, 500);
        }
      } catch (err) {
        // Distinguish JSON parse errors (expected for malformed messages) from real bugs
        if (err instanceof SyntaxError) {
          // Malformed JSON from client — not actionable, skip silently
        } else {
          console.error("[ws] Unexpected error handling message:", err instanceof Error ? err.message : err);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "error", message: "Internal server error" }));
          }
        }
      }
    });

    ws.on("close", () => {
      const proc = chatProcesses.get(ws);
      if (proc && proc.exitCode === null) {
        killProcessWithTimeout(proc);
      }
      chatProcesses.delete(ws);
      chatSessions.delete(ws);
      chatCwds.delete(ws);
      chatAlive.delete(ws);
      rateLimitCounters.delete(ws);
      const closeRetry = chatRetryStates.get(ws);
      if (closeRetry) {
        if (closeRetry.timer) clearTimeout(closeRetry.timer);
        if (closeRetry.countdownTimer) clearInterval(closeRetry.countdownTimer);
        chatRetryStates.delete(ws);
      }
      // Note: idle timer is server-level now, not cleaned up per-connection
    });
  });

  // Session IDs from claude are UUIDs — reject anything else to prevent CLI argument injection via --resume
  const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Maximum user message length (100KB) — prevents spawning claude with absurdly large arguments
  const MAX_MESSAGE_LENGTH = 100 * 1024;

  function handleChatMessage(ws: WebSocket, text: string, sessionId: string | null, model?: string) {
    // Don't spawn a process if the client already disconnected
    if (ws.readyState !== WebSocket.OPEN) {
      console.log("[ws] Skipping message — client already disconnected");
      return;
    }

    // Validate message length before spawning a process
    if (text.length > MAX_MESSAGE_LENGTH) {
      ws.send(JSON.stringify({ type: "error", message: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` }));
      return;
    }

    // Sanitize sessionId — must be a valid UUID or null
    // Prevents CLI argument injection via crafted --resume values (e.g. "--model evil")
    if (sessionId && !SESSION_ID_RE.test(sessionId)) {
      console.warn(`[ws] Rejected invalid sessionId: ${String(sessionId).slice(0, 50)}`);
      sessionId = null;
    }

    // Kill any existing process for this connection
    const existingProc = chatProcesses.get(ws);
    if (existingProc && existingProc.exitCode === null) {
      killProcessWithTimeout(existingProc);
    }

    const home = process.env.HOME || "/Users/abereyes";
    const claudePath = `${home}/.local/bin/claude`;

    // Build args
    const args = [
      "-p",
      "--output-format=stream-json",
      "--verbose",
      "--include-partial-messages",
    ];

    // Select model if specified (already validated against ALLOWED_MODELS allowlist)
    if (model) {
      args.push("--model", model);
    }

    // TODO: Extended thinking available in Claude API but not exposed via CLI flag yet
    // Thinking must be passed at API level, not as --thinking CLI argument
    // if (thinking) {
    //   args.push("--thinking");
    // }

    // Inject memory files as system prompt context
    const memoryPrompt = loadMemoryPrompt();
    if (memoryPrompt) {
      args.push("--append-system-prompt", memoryPrompt);
    }

    // Resume session if we have one (already validated as UUID above)
    if (sessionId) {
      args.push("--resume", sessionId);
    }

    // The user message is the last argument
    args.push(text);

    // Ensure ~/.local/bin is in PATH
    const envPath = process.env.PATH || "";
    const localBin = `${home}/.local/bin`;
    const fullPath = envPath.includes(localBin) ? envPath : `${localBin}:${envPath}`;

    const cwd = chatCwds.get(ws) || home;

    const proc = spawn(claudePath, args, {
      cwd,
      env: { ...process.env, PATH: fullPath },
      stdio: ["ignore", "pipe", "pipe"],
    });

    chatProcesses.set(ws, proc);

    // Safety timeout — kill hung chat processes after 10 minutes
    const chatTimeout = setTimeout(() => {
      if (proc && proc.exitCode === null) {
        console.warn("[chat] Process timed out after 10 minutes — killing");
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "error", message: "Chat process timed out after 10 minutes" }));
        }
        killProcessWithTimeout(proc);
      }
    }, CHAT_PROCESS_TIMEOUT);

    // Buffer for incomplete NDJSON lines
    let buffer = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();

      // Guard against unbounded buffer growth (e.g. very long line without newlines)
      if (buffer.length > MAX_STDOUT_BUFFER) {
        console.warn(`[chat] stdout buffer exceeded ${MAX_STDOUT_BUFFER} bytes, discarding`);
        buffer = "";
        return;
      }

      // Process complete lines
      const lines = buffer.split("\n");
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Extract session_id from init event for future --resume
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.type === "system" && parsed.subtype === "init" && parsed.session_id) {
            chatSessions.set(ws, parsed.session_id);
          }
        } catch {
          // Not valid JSON, forward anyway
        }

        // Forward raw NDJSON line to the client
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(trimmed);
        }
      }
    });

    // Buffer stderr for rate limit detection instead of sending immediately
    let stderrBuffer = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString();
      // Cap stderr buffer to prevent memory exhaustion from verbose error output
      if (stderrBuffer.length > MAX_STDOUT_BUFFER) {
        stderrBuffer = stderrBuffer.slice(-MAX_STDOUT_BUFFER);
      }
    });

    proc.on("close", (code) => {
      clearTimeout(chatTimeout);
      // Flush any remaining buffer
      if (buffer.trim() && ws.readyState === WebSocket.OPEN) {
        ws.send(buffer.trim());
      }
      buffer = "";
      chatProcesses.delete(ws);

      // Check for rate limit on non-zero exit
      if (code !== 0 && code !== null && isRateLimitError(stderrBuffer)) {
        const retryState = chatRetryStates.get(ws) || {
          timer: null, countdownTimer: null, attempt: 0,
          text, sessionId, model,
        };
        const delay = getRetryDelay(retryState.attempt);

        if (delay !== null && ws.readyState === WebSocket.OPEN) {
          console.log(`[chat] Rate limited, retrying in ${delay}s (attempt ${retryState.attempt + 1}/${RETRY_DELAYS.length})`);

          ws.send(JSON.stringify({
            type: "rate_limit_retry",
            attempt: retryState.attempt + 1,
            maxAttempts: RETRY_DELAYS.length,
            delaySeconds: delay,
          }));

          // Countdown timer — tick every second
          let secondsLeft = delay;
          retryState.countdownTimer = setInterval(() => {
            secondsLeft--;
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "retry_countdown", secondsLeft }));
            }
            if (secondsLeft <= 0 && retryState.countdownTimer) {
              clearInterval(retryState.countdownTimer);
              retryState.countdownTimer = null;
            }
          }, 1000);

          // Schedule retry
          retryState.timer = setTimeout(() => {
            retryState.timer = null;
            if (ws.readyState === WebSocket.OPEN) {
              handleChatMessage(ws, retryState.text, retryState.sessionId, retryState.model);
            }
          }, delay * 1000);

          retryState.attempt++;
          chatRetryStates.set(ws, retryState);
          return; // Don't send error or reset idle timer yet
        }

        // Retries exhausted — fall through to send error
      }

      // Send stderr as error if not a rate limit retry
      if (stderrBuffer.trim() && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", message: stderrBuffer.trim() }));
      }

      // Clear retry state on success
      chatRetryStates.delete(ws);

      // Reset server idle timer after completion
      resetServerIdleTimer();
    });

    proc.on("error", (err) => {
      clearTimeout(chatTimeout);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", message: err.message }));
      }
      chatProcesses.delete(ws);
    });
  }

  // ============================================
  // TERMINAL WebSocket — real PTY via node-pty
  // ============================================

  const terminalPtys = new Map<WebSocket, pty.IPty>();

  wssTerminal.on("connection", (ws: WebSocket) => {
    const cwd = getLastCwd();
    const shell = process.env.SHELL || "/bin/zsh";

    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      } as Record<string, string>,
    });

    terminalPtys.set(ws, ptyProcess);

    ptyProcess.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    ptyProcess.onExit(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      terminalPtys.delete(ws);
    });

    ws.on("message", (msg: Buffer | string) => {
      const raw = msg.toString();

      // Check for JSON control messages
      if (raw.startsWith("{")) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.type === "resize" && typeof parsed.cols === "number" && typeof parsed.rows === "number") {
            ptyProcess.resize(Math.max(1, parsed.cols), Math.max(1, parsed.rows));
            return;
          }
          if (parsed.type === "set_cwd" && typeof parsed.cwd === "string") {
            // Can't change cwd of running PTY, but write a cd command
            ptyProcess.write(`cd ${JSON.stringify(parsed.cwd)}\r`);
            saveLastCwd(parsed.cwd);
            return;
          }
        } catch {
          // Not JSON — treat as regular input
        }
      }

      // Regular terminal input
      ptyProcess.write(raw);
    });

    ws.on("close", () => {
      ptyProcess.kill();
      terminalPtys.delete(ws);
    });
  });

  server.listen(port, () => {
    console.log(`> Bridgette ready on http://${hostname}:${port}`);
    // Start idle timer on server startup if auto-eval is enabled
    if (serverAutoEvalEnabled) {
      resetServerIdleTimer();
      console.log("> Auto-eval enabled — idle timer started (15 min)");
    }
  });

  // ============================================
  // GRACEFUL SHUTDOWN — kill child processes, close connections
  // ============================================

  function gracefulShutdown(signal: string) {
    console.log(`\n[shutdown] Received ${signal}, cleaning up...`);

    // Stop heartbeat and idle timers
    clearInterval(heartbeatTimer);
    if (serverIdleTimer) {
      clearTimeout(serverIdleTimer);
      serverIdleTimer = null;
    }

    // Cancel eval retry timer
    if (evalRetryTimer) {
      clearTimeout(evalRetryTimer);
      evalRetryTimer = null;
    }

    // Cancel all chat retry timers
    for (const [, retryState] of chatRetryStates) {
      if (retryState.timer) clearTimeout(retryState.timer);
      if (retryState.countdownTimer) clearInterval(retryState.countdownTimer);
    }
    chatRetryStates.clear();

    // Kill auto-eval process if running
    if (serverAutoEvalProcess && serverAutoEvalProcess.exitCode === null) {
      console.log("[shutdown] Killing auto-eval process");
      killProcessWithTimeout(serverAutoEvalProcess, 3000);
    }

    // Kill all active chat processes
    let chatKills = 0;
    for (const [, proc] of chatProcesses) {
      if (proc && proc.exitCode === null) {
        killProcessWithTimeout(proc, 3000);
        chatKills++;
      }
    }
    if (chatKills > 0) {
      console.log(`[shutdown] Killed ${chatKills} active chat process(es)`);
    }

    // Kill all terminal PTYs
    for (const [, ptyProc] of terminalPtys) {
      ptyProc.kill();
    }
    terminalPtys.clear();

    // Close all WebSocket connections
    wssChat.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1001, "Server shutting down");
      }
    });

    // Close the HTTP server
    server.close(() => {
      console.log("[shutdown] Server closed");
      process.exit(0);
    });

    // Force exit if graceful close takes too long
    setTimeout(() => {
      console.error("[shutdown] Forced exit after timeout");
      process.exit(1);
    }, 8000).unref();
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
});
