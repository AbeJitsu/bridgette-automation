import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { spawn, ChildProcess, execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Track active PTY session so browser refresh reconnects
let activePty: any = null;
let activeWs: WebSocket | null = null;

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url!, true);
    await handle(req, res, parsedUrl);
  });

  const wssTerminal = new WebSocketServer({ noServer: true });
  const wssChat = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url!, true);

    if (pathname === "/ws/terminal") {
      wssTerminal.handleUpgrade(req, socket, head, (ws) => {
        wssTerminal.emit("connection", ws, req);
      });
    } else if (pathname === "/ws/chat") {
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
  const chatIdleTimers = new Map<WebSocket, NodeJS.Timeout>();
  const chatAutoEval = new Map<WebSocket, boolean>();

  const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes

  function resetIdleTimer(ws: WebSocket) {
    const existing = chatIdleTimers.get(ws);
    if (existing) clearTimeout(existing);

    if (!chatAutoEval.get(ws)) return;

    const timer = setTimeout(() => triggerAutoEval(ws), IDLE_TIMEOUT);
    chatIdleTimers.set(ws, timer);
  }

  function triggerAutoEval(ws: WebSocket) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (chatProcesses.get(ws)?.killed === false) return; // already running

    const cwd = chatCwds.get(ws) || process.cwd();
    const branchName = "dev";

    try {
      // Switch to dev branch, creating it from main if it doesn't exist
      const currentBranch = execSync("git branch --show-current", { cwd, stdio: "pipe" }).toString().trim();
      if (currentBranch !== branchName) {
        try {
          execSync(`git checkout ${branchName}`, { cwd, stdio: "pipe" });
        } catch {
          // Branch doesn't exist yet — create it
          execSync(`git checkout -b ${branchName}`, { cwd, stdio: "pipe" });
        }
      }
    } catch (err: any) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", message: `Failed to switch to dev branch: ${err.message}` }));
      }
      return;
    }

    // Notify client
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "auto_eval_start", branch: branchName }));
    }

    // Read the eval prompt
    let prompt: string;
    try {
      const promptPath = join(process.cwd(), "..", "automations", "auto-eval", "prompt.md");
      prompt = readFileSync(promptPath, "utf-8");
    } catch {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", message: "Auto-eval prompt not found" }));
      }
      return;
    }

    // Send through existing chat handler
    const currentSession = chatSessions.get(ws) ?? null;
    handleChatMessage(ws, prompt, currentSession, false, undefined);
  }

  const defaultCwd = process.env.HOME || "/Users/abereyes";
  const cwdFile = require("path").join(process.cwd(), "..", ".last-cwd");

  function getLastCwd(): string {
    const fs = require("fs");
    try {
      const saved = fs.readFileSync(cwdFile, "utf-8").trim();
      if (saved && fs.existsSync(saved) && fs.statSync(saved).isDirectory()) {
        return saved;
      }
    } catch {}
    return defaultCwd;
  }

  function saveLastCwd(cwd: string): void {
    const fs = require("fs");
    try { fs.writeFileSync(cwdFile, cwd); } catch {}
  }

  wssChat.on("connection", (ws: WebSocket) => {
    chatSessions.set(ws, null);
    const initialCwd = getLastCwd();
    chatCwds.set(ws, initialCwd);

    // Send initial state including cwd
    ws.send(JSON.stringify({ type: "state", cwd: initialCwd }));

    ws.on("message", (msg: Buffer | string) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === "message") {
          resetIdleTimer(ws);
          handleChatMessage(ws, parsed.text, parsed.sessionId || chatSessions.get(ws), parsed.thinking, parsed.model);
        } else if (parsed.type === "stop") {
          const proc = chatProcesses.get(ws);
          if (proc && !proc.killed) {
            proc.kill("SIGTERM");
          }
        } else if (parsed.type === "set_cwd") {
          // Validate directory exists
          const fs = require("fs");
          const target = parsed.cwd;
          if (target && fs.existsSync(target) && fs.statSync(target).isDirectory()) {
            chatCwds.set(ws, target);
            saveLastCwd(target);
            // Reset session when changing directory (new context)
            chatSessions.set(ws, null);
            ws.send(JSON.stringify({ type: "state", cwd: target }));
          } else {
            ws.send(JSON.stringify({ type: "error", message: `Directory not found: ${target}` }));
          }
        } else if (parsed.type === "set_auto_eval") {
          chatAutoEval.set(ws, !!parsed.enabled);
          if (parsed.enabled) {
            resetIdleTimer(ws);
          } else {
            const timer = chatIdleTimers.get(ws);
            if (timer) clearTimeout(timer);
            chatIdleTimers.delete(ws);
          }
          ws.send(JSON.stringify({ type: "auto_eval_state", enabled: !!parsed.enabled }));
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      const proc = chatProcesses.get(ws);
      if (proc && !proc.killed) {
        proc.kill("SIGTERM");
      }
      chatProcesses.delete(ws);
      chatSessions.delete(ws);
      chatCwds.delete(ws);
      const timer = chatIdleTimers.get(ws);
      if (timer) clearTimeout(timer);
      chatIdleTimers.delete(ws);
      chatAutoEval.delete(ws);
    });
  });

  function handleChatMessage(ws: WebSocket, text: string, sessionId: string | null, thinking?: boolean, model?: string) {
    // Kill any existing process for this connection
    const existingProc = chatProcesses.get(ws);
    if (existingProc && !existingProc.killed) {
      existingProc.kill("SIGTERM");
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

    proc.on("close", (code: number | null) => {
      // Flush any remaining buffer
      if (buffer.trim() && ws.readyState === WebSocket.OPEN) {
        ws.send(buffer.trim());
      }
      buffer = "";
      chatProcesses.delete(ws);
      // Reset idle timer after completion (prevents chaining evals)
      resetIdleTimer(ws);
    });

    proc.on("error", (err) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", message: err.message }));
      }
      chatProcesses.delete(ws);
    });
  }

  // ============================================
  // TERMINAL WebSocket — PTY (legacy)
  // ============================================

  wssTerminal.on("connection", async (ws: WebSocket) => {
    // Lazy-load node-pty (native module)
    const pty = await import("node-pty");

    // If there's an existing PTY session, reconnect to it
    if (activePty) {
      // Clean up old WebSocket if any
      if (activeWs && activeWs !== ws && activeWs.readyState === WebSocket.OPEN) {
        activeWs.close();
      }
      activeWs = ws;

      // Tell the client the session is live
      ws.send(JSON.stringify({ type: "status", status: "connected" }));

      // Wire up the existing PTY to the new WebSocket
      const dataHandler = activePty.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      ws.on("message", (msg: Buffer | string) => {
        const message = msg.toString();
        try {
          const parsed = JSON.parse(message);
          if (parsed.type === "resize" && activePty) {
            activePty.resize(parsed.cols, parsed.rows);
            return;
          }
        } catch {
          // Not JSON — treat as keystroke
        }
        if (activePty) {
          activePty.write(message);
        }
      });

      ws.on("close", () => {
        dataHandler.dispose();
        if (activeWs === ws) {
          activeWs = null;
        }
      });

      ws.send("\r\n\x1b[33m[Reconnected to existing session]\x1b[0m\r\n");
      return;
    }

    // Resolve claude binary — ~/.local/bin may not be in default PATH
    const home = process.env.HOME || "/Users/abereyes";
    const claudePath = `${home}/.local/bin/claude`;

    // Ensure ~/.local/bin is in PATH for child processes
    const envPath = process.env.PATH || "";
    const localBin = `${home}/.local/bin`;
    const fullPath = envPath.includes(localBin) ? envPath : `${localBin}:${envPath}`;

    let shell;
    try {
      shell = pty.spawn(claudePath, [], {
        name: "xterm-256color",
        cols: 80,
        rows: 30,
        cwd: home,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          PATH: fullPath,
        } as Record<string, string>,
      });
    } catch (error: any) {
      console.error("Failed to spawn claude PTY:", error.message);
      ws.send(JSON.stringify({ type: "status", status: "error", message: error.message }));
      ws.send(
        "\r\n\x1b[31m[Failed to start Claude session]\x1b[0m\r\n" +
        `\x1b[33mError: ${error.message}\x1b[0m\r\n\r\n` +
        "\x1b[90mThis usually means:\x1b[0m\r\n" +
        "\x1b[90m  - PTY allocation blocked (run server from a real terminal, not inside Claude Code)\x1b[0m\r\n" +
        "\x1b[90m  - claude binary not found at: " + claudePath + "\x1b[0m\r\n" +
        "\x1b[90m  - node-pty native module needs rebuild: npm rebuild node-pty\x1b[0m\r\n"
      );
      return;
    }

    activePty = shell;
    activeWs = ws;

    // Tell the client the session is live
    ws.send(JSON.stringify({ type: "status", status: "connected" }));

    shell.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    shell.onExit(() => {
      activePty = null;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "status", status: "ended" }));
        ws.send("\r\n\x1b[31m[Claude session ended]\x1b[0m\r\n");
        ws.close();
      }
    });

    ws.on("message", (msg: Buffer | string) => {
      const message = msg.toString();
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === "resize") {
          shell.resize(parsed.cols, parsed.rows);
          return;
        }
      } catch {
        // Not JSON — treat as keystroke
      }
      shell.write(message);
    });

    ws.on("close", () => {
      if (activeWs === ws) {
        activeWs = null;
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Bridgette ready on http://${hostname}:${port}`);
  });
});
