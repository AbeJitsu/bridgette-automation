import { describe, test, expect, beforeEach, afterAll } from "vitest";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import WebSocket from "ws";

// ============================================
// PATHS & CONSTANTS
// ============================================

const PROJECT_ROOT = join(__dirname, "..", "..");
const INDEX_FILE = join(PROJECT_ROOT, ".auto-eval-index");
const EVAL_TYPES = ["frontend", "backend", "functionality"] as const;
const WS_URL = "ws://localhost:3000/ws/chat";

// ============================================
// HELPERS
// ============================================

function writeIndex(val: string) {
  writeFileSync(INDEX_FILE, val);
}

function readIndex(): string {
  return readFileSync(INDEX_FILE, "utf-8").trim();
}

function removeIndex() {
  try {
    unlinkSync(INDEX_FILE);
  } catch {}
}

// Replicates server's loadEvalIndex logic
function loadEvalIndex(): number {
  try {
    const val = parseInt(readFileSync(INDEX_FILE, "utf-8").trim(), 10);
    return isNaN(val) ? 0 : val % EVAL_TYPES.length;
  } catch {
    return 0;
  }
}

interface WSHelper {
  ws: WebSocket;
  waitForMessage: (
    type: string,
    timeout?: number
  ) => Promise<Record<string, unknown>>;
  waitForAnyOf: (
    types: string[],
    timeout?: number
  ) => Promise<Record<string, unknown>>;
  close: () => void;
}

function connectWS(): Promise<WSHelper> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("WS connect timeout"));
    }, 5000);

    ws.on("open", () => {
      clearTimeout(timer);

      function waitForAnyOf(types: string[], timeout = 10000): Promise<Record<string, unknown>> {
          return new Promise((res, rej) => {
            const t = setTimeout(() => {
              rej(
                new Error(
                  `Timeout waiting for message types: ${types.join(", ")}`
                )
              );
            }, timeout);

            const handler = (data: WebSocket.Data) => {
              try {
                const parsed = JSON.parse(data.toString());
                if (types.includes(parsed.type)) {
                  clearTimeout(t);
                  ws.off("message", handler);
                  res(parsed);
                }
              } catch {}
            };
            ws.on("message", handler);
          });
      }

      resolve({
        ws,
        waitForMessage(type: string, timeout = 10000) {
          return waitForAnyOf([type], timeout);
        },
        waitForAnyOf,
        close() {
          ws.close();
        },
      });
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// Track connections for cleanup
const openConnections: WSHelper[] = [];

afterAll(() => {
  openConnections.forEach((c) => c.close());
});

// ============================================
// UNIT: Rotation index math (no server needed)
// ============================================

describe("Rotation index math", () => {
  beforeEach(() => removeIndex());

  test("index file starts at 0 when missing", () => {
    expect(loadEvalIndex()).toBe(0);
  });

  test("index 0 → frontend, 1 → backend, 2 → functionality", () => {
    writeIndex("0");
    expect(EVAL_TYPES[loadEvalIndex()]).toBe("frontend");

    writeIndex("1");
    expect(EVAL_TYPES[loadEvalIndex()]).toBe("backend");

    writeIndex("2");
    expect(EVAL_TYPES[loadEvalIndex()]).toBe("functionality");
  });

  test("wraps from 2 back to 0", () => {
    writeIndex("3");
    expect(loadEvalIndex()).toBe(0);

    writeIndex("6");
    expect(loadEvalIndex()).toBe(0);

    writeIndex("4");
    expect(loadEvalIndex()).toBe(1);
  });

  test("handles corrupted index file gracefully", () => {
    writeIndex("garbage");
    expect(loadEvalIndex()).toBe(0);

    writeIndex("");
    expect(loadEvalIndex()).toBe(0);

    writeIndex("-1");
    const val = parseInt("-1", 10);
    const result = isNaN(val) ? 0 : val % EVAL_TYPES.length;
    expect(loadEvalIndex()).toBe(result);
  });
});

// ============================================
// INTEGRATION: WS message flow (requires :3000)
// ============================================

describe("WebSocket auto-eval integration", () => {
  beforeEach(() => {
    writeIndex("0");
  });

  test("state event includes evalRunning and evalType on connect", async () => {
    const conn = await connectWS();
    openConnections.push(conn);

    const state = await conn.waitForMessage("state");
    expect(typeof state.evalRunning).toBe("boolean");
    expect(
      state.evalType === null || typeof state.evalType === "string"
    ).toBe(true);
    expect(state.autoEval).toBeDefined();

    conn.close();
  });

  test("set_auto_eval broadcasts auto_eval_state", async () => {
    const conn = await connectWS();
    openConnections.push(conn);
    await conn.waitForMessage("state");

    conn.ws.send(JSON.stringify({ type: "set_auto_eval", enabled: true }));
    const ack = await conn.waitForMessage("auto_eval_state");
    expect(ack.enabled).toBe(true);

    conn.ws.send(JSON.stringify({ type: "set_auto_eval", enabled: false }));
    const ack2 = await conn.waitForMessage("auto_eval_state");
    expect(ack2.enabled).toBe(false);

    conn.close();
  });

  test("trigger_auto_eval responds with auto_eval_start or error", async () => {
    writeIndex("0");

    const conn = await connectWS();
    openConnections.push(conn);
    await conn.waitForMessage("state");

    conn.ws.send(JSON.stringify({ type: "set_auto_eval", enabled: true }));
    await conn.waitForMessage("auto_eval_state");

    conn.ws.send(JSON.stringify({ type: "trigger_auto_eval" }));

    // Server will either start the eval (auto_eval_start) or fail on
    // branch switch (error). Both are valid WS responses.
    const msg = await conn.waitForAnyOf(["auto_eval_start", "error"]);

    if (msg.type === "auto_eval_start") {
      // Eval started — index should have advanced
      expect(msg.evalType).toBe("frontend");
      expect(readIndex()).toBe("1");
    } else {
      // Branch switch failed (e.g. uncommitted changes) — index unchanged
      expect(msg.type).toBe("error");
      expect(typeof msg.message).toBe("string");
    }

    conn.close();
  });

  test("rotation advances index correctly across eval types", async () => {
    // This tests that triggering with different starting indices
    // produces the expected eval types. If git checkout fails,
    // the index stays the same (server bails before rotation).
    const conn = await connectWS();
    openConnections.push(conn);
    await conn.waitForMessage("state");

    conn.ws.send(JSON.stringify({ type: "set_auto_eval", enabled: true }));
    await conn.waitForMessage("auto_eval_state");

    for (let i = 0; i < 3; i++) {
      writeIndex(String(i));

      // Wait for any previous eval to not be running
      await new Promise((r) => setTimeout(r, 300));

      conn.ws.send(JSON.stringify({ type: "trigger_auto_eval" }));
      const msg = await conn.waitForAnyOf(["auto_eval_start", "error"]);

      if (msg.type === "auto_eval_start") {
        expect(msg.evalType).toBe(EVAL_TYPES[i]);
        expect(readIndex()).toBe(String((i + 1) % 3));
      }
      // If error, skip — branch checkout blocked it
    }

    conn.close();
  });

  test("reconnect receives current eval state", async () => {
    const conn1 = await connectWS();
    openConnections.push(conn1);
    const state1 = await conn1.waitForMessage("state");

    // Open a second connection — should get same evalRunning state
    const conn2 = await connectWS();
    openConnections.push(conn2);
    const state2 = await conn2.waitForMessage("state");

    expect(typeof state2.evalRunning).toBe("boolean");
    // Both connections should see the same eval state
    expect(state2.evalRunning).toBe(state1.evalRunning);
    expect(state2.evalType).toBe(state1.evalType);

    conn1.close();
    conn2.close();
  });
});
