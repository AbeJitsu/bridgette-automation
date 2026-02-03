"use client";

import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";

interface TerminalProps {
  className?: string;
}

export default function Terminal({ className }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const token = localStorage.getItem("bridgette_token") || "";
    const url = `${protocol}//${window.location.host}/ws/terminal${token ? `?token=${token}` : ""}`;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      // Send initial resize
      const fitAddon = fitAddonRef.current;
      if (fitAddon && termRef.current) {
        try {
          fitAddon.fit();
        } catch {}
        ws.send(JSON.stringify({
          type: "resize",
          cols: termRef.current.cols,
          rows: termRef.current.rows,
        }));
      }
    };

    ws.onmessage = (event) => {
      const term = termRef.current;
      if (!term) return;
      if (typeof event.data === "string") {
        term.write(event.data);
      } else {
        term.write(new Uint8Array(event.data));
      }
    };

    ws.onclose = () => {
      // Auto-reconnect after 2s
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  // Listen for "send to terminal" events from automations / task panel
  useEffect(() => {
    function handleSendToTerminal(e: Event) {
      const text = (e as CustomEvent<string>).detail;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && text) {
        wsRef.current.send(text);
      }
    }
    window.addEventListener("bridgette-send-to-terminal", handleSendToTerminal);
    // Also listen to the old chat event for backwards compat
    window.addEventListener("bridgette-send-to-chat", handleSendToTerminal);
    return () => {
      window.removeEventListener("bridgette-send-to-terminal", handleSendToTerminal);
      window.removeEventListener("bridgette-send-to-chat", handleSendToTerminal);
    };
  }, []);

  // Listen for cwd changes
  useEffect(() => {
    function handleCwdChange(e: Event) {
      const cwd = (e as CustomEvent<string>).detail;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && cwd) {
        wsRef.current.send(JSON.stringify({ type: "set_cwd", cwd }));
      }
    }
    window.addEventListener("bridgette-set-cwd", handleCwdChange);
    return () => window.removeEventListener("bridgette-set-cwd", handleCwdChange);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: {
        background: "#0a0a0a",
        foreground: "#e5e5e5",
        cursor: "#10b981",
        selectionBackground: "#10b98140",
        black: "#1a1a1a",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e5e5e5",
        brightBlack: "#737373",
        brightRed: "#f87171",
        brightGreen: "#34d399",
        brightYellow: "#fbbf24",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#ffffff",
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Fit to container
    try { fitAddon.fit(); } catch {}

    // Send typed input to server
    term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(data);
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "resize",
            cols: term.cols,
            rows: term.rows,
          }));
        }
      } catch {}
    });
    resizeObserver.observe(containerRef.current);

    // Connect WebSocket
    connect();

    return () => {
      resizeObserver.disconnect();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      term.dispose();
    };
  }, [connect]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className || ""}`}
      style={{ background: "#0a0a0a" }}
    />
  );
}
