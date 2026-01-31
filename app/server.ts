import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

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

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url!, true);

    if (pathname === "/ws/terminal") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", async (ws: WebSocket) => {
    // Lazy-load node-pty (native module)
    const pty = await import("node-pty");

    // If there's an existing PTY session, reconnect to it
    if (activePty) {
      // Clean up old WebSocket if any
      if (activeWs && activeWs !== ws && activeWs.readyState === WebSocket.OPEN) {
        activeWs.close();
      }
      activeWs = ws;

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
        // Keep PTY alive for reconnection
      });

      // Send a note that we reconnected
      ws.send("\r\n\x1b[33m[Reconnected to existing session]\x1b[0m\r\n");
      return;
    }

    // Spawn a new claude session
    const shell = pty.spawn("claude", [], {
      name: "xterm-256color",
      cols: 80,
      rows: 30,
      cwd: process.env.HOME || "/",
      env: {
        ...process.env,
        TERM: "xterm-256color",
      } as Record<string, string>,
    });

    activePty = shell;
    activeWs = ws;

    shell.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    shell.onExit(() => {
      activePty = null;
      if (ws.readyState === WebSocket.OPEN) {
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
      // Keep PTY alive — next connection will reconnect
    });
  });

  server.listen(port, () => {
    console.log(`> Bridgette ready on http://${hostname}:${port}`);
  });
});
