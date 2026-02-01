import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { spawn, ChildProcess, execSync } from "child_process";
import { readFileSync, writeFileSync, renameSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import crypto from "crypto";

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
    } catch (err: any) {
      console.error(`[eval-log] Failed to write: ${err.message}`);
    }
  });
}

function getCommitHash(cwd: string): string {
  try {
    return execSync("git rev-parse HEAD", { cwd, stdio: "pipe" }).toString().trim();
  } catch {
    return "unknown";
  }
}

function createEvalTask(evalType: string, diffSummary: string): void {
  const url = `http://localhost:${port}/api/tasks`;
  // Format summary in what/why/how style
  const fileCount = (diffSummary.match(/\n/g) || []).length;
  const insertions = diffSummary.match(/(\d+) insertion/)?.[1] || "0";
  const deletions = diffSummary.match(/(\d+) deletion/)?.[1] || "0";
  const summary = [
    `What: ${evalType} improvements across ${fileCount} files`,
    `Why: Automatic ${evalType} quality pass`,
    `How: +${insertions} -${deletions} lines changed`,
    ``,
    diffSummary,
  ].join("\n");
  const body = JSON.stringify({
    title: `[Auto-eval] ${evalType.charAt(0).toUpperCase() + evalType.slice(1)} eval completed`,
    status: "completed",
    summary,
  });
  // Fire-and-forget POST to create the task
  import("http").then(({ default: http }) => {
    const req = http.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    });
    req.on("error", () => {}); // Ignore errors
    req.write(body);
    req.end();
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
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
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

  server.on("upgrade", (req, socket, head) => {
    const { pathname, query } = parse(req.url!, true);

    if (pathname === "/ws/chat") {
      // Token auth check (skip if no token configured)
      if (BRIDGETTE_TOKEN) {
        const authHeader = req.headers["authorization"];
        const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
        const queryToken = typeof query.token === "string" ? query.token : null;
        if (headerToken !== BRIDGETTE_TOKEN && queryToken !== BRIDGETTE_TOKEN) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
      }
      wssChat.handleUpgrade(req, socket, head, (ws) => {
        wssChat.emit("connection", ws, req);
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

  function getGitBranch(cwd: string): string {
    try {
      return execSync("git branch --show-current", { cwd, stdio: "pipe" }).toString().trim();
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
          execSync(`git checkout ${branchName}`, { cwd, stdio: "pipe" });
        } catch {
          execSync(`git checkout -b ${branchName}`, { cwd, stdio: "pipe" });
        }
      }
      // Keep dev up to date with main
      try {
        execSync("git merge main --no-edit", { cwd, stdio: "pipe" });
      } catch (mergeErr: any) {
        console.error(`Failed to merge main into dev: ${mergeErr.message}`);
        broadcastToChat({ type: "error", message: `Failed to merge main into dev: ${mergeErr.message}` });
        // Abort the failed merge and bail
        try { execSync("git merge --abort", { cwd, stdio: "pipe" }); } catch {}
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

    proc.stderr?.on("data", (chunk: Buffer) => {
      const errText = chunk.toString().trim();
      if (errText) {
        console.error(`[auto-eval stderr] ${errText}`);
        broadcastToChat({ type: "error", message: errText });
      }
    });

    proc.on("close", () => {
      clearTimeout(evalTimeout);
      // Flush remaining buffer
      if (buffer.trim()) {
        try { broadcastToChat(JSON.parse(buffer.trim()) as Record<string, unknown>); } catch {}
      }
      buffer = "";
      serverAutoEvalProcess = null;
      const completedEvalType = currentEvalType;
      currentEvalType = null;

      // Get change summary
      let summary = "";
      try {
        summary = execSync("git diff HEAD~1 --stat", { cwd, stdio: "pipe" }).toString().trim();
      } catch {
        summary = "No changes detected";
      }

      const evalBranch = getGitBranch(cwd);
      const commitHash = getCommitHash(cwd);

      // Write eval log entry
      writeEvalLogEntry({
        id: crypto.randomUUID(),
        evalType: completedEvalType || "unknown",
        timestamp: new Date().toISOString(),
        branch: evalBranch,
        commitHash,
        diffSummary: summary,
        status: "success",
      });

      // Create completed task with summary
      if (completedEvalType) {
        createEvalTask(completedEvalType, summary);
      }

      broadcastToChat({ type: "auto_eval_complete", summary, branch: evalBranch, evalType: completedEvalType });

      // Chain: next eval fires after short cooldown
      evalChaining = true;
      resetServerIdleTimer();
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

  // Maximum WebSocket message size (1MB) to prevent memory abuse
  const MAX_WS_MESSAGE_SIZE = 1024 * 1024;

  // Allowed model values to prevent injection via the --model flag
  const ALLOWED_MODELS = new Set([
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
    "claude-haiku-3-5-20241022",
    "sonnet",
    "opus",
    "haiku",
  ]);

  wssChat.on("connection", (ws: WebSocket) => {
    chatSessions.set(ws, null);
    const initialCwd = getLastCwd();
    chatCwds.set(ws, initialCwd);

    // Send initial state including branch and auto-eval
    const branch = getGitBranch(initialCwd);
    const evalRunning = !!serverAutoEvalProcess && serverAutoEvalProcess.exitCode === null;
    ws.send(JSON.stringify({ type: "state", cwd: initialCwd, branch, autoEval: serverAutoEvalEnabled, evalInterval: serverEvalInterval, evalRunning, evalType: evalRunning ? currentEvalType : null, evalTimerStart: serverIdleTimerStart, evalChaining }));

    ws.on("message", (msg: Buffer | string) => {
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
          handleChatMessage(ws, parsed.text, parsed.sessionId || chatSessions.get(ws), parsed.thinking, parsed.model);
        } else if (parsed.type === "stop") {
          const proc = chatProcesses.get(ws);
          if (proc && proc.exitCode === null) {
            killProcessWithTimeout(proc);
          }
        } else if (parsed.type === "set_cwd") {
          const target = typeof parsed.cwd === "string" ? parsed.cwd : "";
          // Validate the path doesn't contain null bytes (path injection)
          if (!target || target.includes("\0")) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid directory path" }));
            return;
          }
          if (existsSync(target)) {
            chatCwds.set(ws, target);
            saveLastCwd(target);
            chatSessions.set(ws, null);
            const branch = getGitBranch(target);
            const evalRunningNow = !!serverAutoEvalProcess && serverAutoEvalProcess.exitCode === null;
            ws.send(JSON.stringify({ type: "state", cwd: target, branch, autoEval: serverAutoEvalEnabled, evalInterval: serverEvalInterval, evalRunning: evalRunningNow, evalType: evalRunningNow ? currentEvalType : null, evalTimerStart: serverIdleTimerStart, evalChaining }));
          } else {
            ws.send(JSON.stringify({ type: "error", message: `Directory not found: ${target}` }));
          }
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
        } else if (parsed.type === "set_eval_interval") {
          const ms = typeof parsed.interval === "number" ? parsed.interval : 0;
          if (ms >= MIN_EVAL_INTERVAL && ms <= MAX_EVAL_INTERVAL) {
            serverEvalInterval = ms;
            saveEvalInterval(ms);
            resetServerIdleTimer();
            broadcastToChat({ type: "eval_interval_state", interval: serverEvalInterval, evalTimerStart: serverIdleTimerStart, evalChaining });
          }
        }
      } catch {
        // Ignore malformed JSON
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
      // Note: idle timer is server-level now, not cleaned up per-connection
    });
  });

  function handleChatMessage(ws: WebSocket, text: string, sessionId: string | null, thinking?: boolean, model?: string) {
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

    // Select model if specified
    if (model) {
      args.push("--model", model);
    }

    // Enable thinking if requested
    if (thinking) {
      args.push("--thinking");
    }

    // Inject memory files as system prompt context
    const memoryPrompt = loadMemoryPrompt();
    if (memoryPrompt) {
      args.push("--append-system-prompt", memoryPrompt);
    }

    // Resume session if we have one
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

    // Buffer for incomplete NDJSON lines
    let buffer = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();

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

    proc.stderr?.on("data", (chunk: Buffer) => {
      const errText = chunk.toString().trim();
      if (errText && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", message: errText }));
      }
    });

    proc.on("close", () => {
      // Flush any remaining buffer
      if (buffer.trim() && ws.readyState === WebSocket.OPEN) {
        ws.send(buffer.trim());
      }
      buffer = "";
      chatProcesses.delete(ws);
      // Reset server idle timer after completion
      resetServerIdleTimer();
    });

    proc.on("error", (err) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", message: err.message }));
      }
      chatProcesses.delete(ws);
    });
  }

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

    // Stop idle timer
    if (serverIdleTimer) {
      clearTimeout(serverIdleTimer);
      serverIdleTimer = null;
    }

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
