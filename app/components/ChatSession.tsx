"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { formatRelativeTime } from "@/lib/format";

// ============================================
// CLICK OUTSIDE HOOK
// ============================================

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [ref, onClose]);
}

// ============================================
// TYPES
// ============================================

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolUses?: ToolUse[];
  cost?: number;
  duration?: number;
  model?: string;
}

interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isComplete: boolean;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "streaming";

interface SessionEntry {
  sessionId: string;
  firstMessage: string;
  timestamp: string;
  model?: string;
}

const SESSIONS_KEY = "bridgette-sessions";
const MAX_SESSIONS = 20;

function loadSessions(): SessionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
  } catch { return []; }
}

function saveSession(entry: SessionEntry) {
  const sessions = loadSessions().filter((s) => s.sessionId !== entry.sessionId);
  sessions.unshift(entry);
  if (sessions.length > MAX_SESSIONS) sessions.length = MAX_SESSIONS;
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function deleteSession(sessionId: string) {
  const sessions = loadSessions().filter((s) => s.sessionId !== sessionId);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function clearAllSessions() {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify([]));
}

// ============================================
// CHAT SESSION COMPONENT
// ============================================

export default function ChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("bridgette-model") || "";
    }
    return "";
  });
  const [cwd, setCwd] = useState<string>("");
  const [showDirPicker, setShowDirPicker] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [autoEval, setAutoEval] = useState(false);
  const [evalInterval, setEvalInterval] = useState(15 * 60 * 1000);
  const [sessionSearch, setSessionSearch] = useState("");
  const [branch, setBranch] = useState<string | null>(null);
  const [evalRunning, setEvalRunning] = useState(false);
  const [evalType, setEvalType] = useState<string | null>(null);
  const [evalTimerStart, setEvalTimerStart] = useState<number | null>(null);
  const [evalChaining, setEvalChaining] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [needsToken, setNeedsToken] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingMessageRef = useRef<ChatMessage | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
  const historyRef = useRef<HTMLDivElement>(null);
  const dirPickerRef = useRef<HTMLDivElement>(null);

  const closeHistory = useCallback(() => { setShowHistory(false); setSessionSearch(""); }, []);
  useClickOutside(historyRef, closeHistory);
  const closeDirPicker = useCallback(() => setShowDirPicker(false), []);
  useClickOutside(dirPickerRef, closeDirPicker);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Listen for "Send to Chat" events from Automations tab
  useEffect(() => {
    function handleSendToChat(e: Event) {
      const text = (e as CustomEvent<string>).detail;
      if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (status === "streaming") return;

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);

      const payload: Record<string, unknown> = { type: "message", text, sessionId, thinking };
      if (selectedModel) payload.model = selectedModel;
      wsRef.current.send(JSON.stringify(payload));
      setStatus("streaming");
    }
    window.addEventListener("bridgette-send-to-chat", handleSendToChat);
    return () => window.removeEventListener("bridgette-send-to-chat", handleSendToChat);
  }, [status, sessionId, thinking, selectedModel]);

  // Save session to localStorage when we get a sessionId
  useEffect(() => {
    if (!sessionId) return;
    const firstUserMsg = messages.find((m) => m.role === "user");
    if (!firstUserMsg) return;
    saveSession({
      sessionId,
      firstMessage: firstUserMsg.content.slice(0, 100),
      timestamp: new Date().toISOString(),
      model: selectedModel || undefined,
    });
    setSessions(loadSessions());
  }, [sessionId, messages, selectedModel]);

  // Load sessions on mount
  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  // Countdown timer for auto-eval
  useEffect(() => {
    if (!autoEval || evalRunning || evalTimerStart === null) {
      setCountdown(null);
      return;
    }
    const delay = evalChaining ? 30 * 1000 : evalInterval;
    const tick = () => {
      const remaining = Math.max(0, evalTimerStart + delay - Date.now());
      if (remaining <= 0) {
        setCountdown("0s");
        return;
      }
      const totalSec = Math.ceil(remaining / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      setCountdown(min > 0 ? `${min}m ${sec}s` : `${sec}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [autoEval, evalRunning, evalTimerStart, evalInterval, evalChaining]);

  const connectRef = useRef<(() => void) | null>(null);

  const connectWebSocket = useCallback(() => {
    // Don't reconnect if already connected or actively connecting
    if (wsRef.current) {
      const state = wsRef.current.readyState;
      if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) return;
      // Clean up stale socket
      wsRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const token = localStorage.getItem("bridgette-token") || "";
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat${tokenParam}`);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      setStatus("connected");
      setNeedsToken(false);
      reconnectAttemptRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerEvent(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = (event) => {
      setStatus("disconnected");
      wsRef.current = null;

      // If connection was rejected (never opened) and we're on a non-localhost host,
      // likely a 401 — show token prompt instead of reconnecting endlessly
      const isRemote = !["localhost", "127.0.0.1"].includes(window.location.hostname);
      if (event.code === 1006 && reconnectAttemptRef.current >= 2 && isRemote) {
        setNeedsToken(true);
        return;
      }

      // Auto-reconnect with exponential backoff
      if (!reconnectTimerRef.current) {
        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(1000 * Math.pow(2, attempt), 15000);
        reconnectAttemptRef.current = attempt + 1;
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connectRef.current?.();
        }, delay);
      }
    };

    ws.onerror = () => {
      setStatus("disconnected");
    };
  }, []);

  connectRef.current = connectWebSocket;

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  // ============================================
  // EVENT HANDLING
  // ============================================

  const handleServerEvent = useCallback((data: any) => {
    const type = data.type;

    if (type === "state") {
      if (data.cwd) setCwd(data.cwd);
      if (data.branch) setBranch(data.branch);
      if (data.autoEval !== undefined) setAutoEval(!!data.autoEval);
      if (data.evalInterval !== undefined) setEvalInterval(data.evalInterval);
      if (data.evalRunning !== undefined) setEvalRunning(!!data.evalRunning);
      if (data.evalType !== undefined) setEvalType(data.evalType);
      if (data.evalTimerStart !== undefined) setEvalTimerStart(data.evalTimerStart);
      if (data.evalChaining !== undefined) setEvalChaining(!!data.evalChaining);
      return;
    }

    if (type === "eval_interval_state") {
      if (data.interval !== undefined) setEvalInterval(data.interval);
      if (data.evalTimerStart !== undefined) setEvalTimerStart(data.evalTimerStart);
      if (data.evalChaining !== undefined) setEvalChaining(!!data.evalChaining);
      return;
    }

    if (type === "eval_timer_state") {
      if (data.evalTimerStart !== undefined) setEvalTimerStart(data.evalTimerStart);
      if (data.evalChaining !== undefined) setEvalChaining(!!data.evalChaining);
      return;
    }

    if (type === "system" && data.subtype === "init") {
      if (data.session_id) setSessionId(data.session_id);
      if (data.model) setCurrentModel(data.model);
      return;
    }

    if (type === "stream_event") {
      const event = data.event;
      if (!event) return;

      if (event.type === "message_start") {
        const newMsg: ChatMessage = {
          id: event.message?.id || crypto.randomUUID(),
          role: "assistant",
          content: "",
          toolUses: [],
        };
        streamingMessageRef.current = newMsg;
        setMessages((prev) => [...prev, newMsg]);
        setStatus("streaming");
        return;
      }

      if (event.type === "content_block_start") {
        const block = event.content_block;
        if (block?.type === "tool_use") {
          const toolUse: ToolUse = {
            id: block.id,
            name: block.name,
            input: {},
            isComplete: false,
          };
          updateStreamingMessage((msg) => ({
            ...msg,
            toolUses: [...(msg.toolUses || []), toolUse],
          }));
        }
        return;
      }

      if (event.type === "content_block_delta") {
        const delta = event.delta;
        if (delta?.type === "text_delta" && delta.text) {
          updateStreamingMessage((msg) => ({
            ...msg,
            content: msg.content + delta.text,
          }));
        } else if (delta?.type === "input_json_delta" && delta.partial_json) {
          updateStreamingMessage((msg) => {
            const tools = [...(msg.toolUses || [])];
            if (tools.length > 0) {
              const last = { ...tools[tools.length - 1] };
              last.input = { ...last.input, _partial: ((last.input._partial as string) || "") + delta.partial_json };
              tools[tools.length - 1] = last;
            }
            return { ...msg, toolUses: tools };
          });
        }
        return;
      }

      if (event.type === "content_block_stop") {
        updateStreamingMessage((msg) => {
          const tools = [...(msg.toolUses || [])];
          if (tools.length > 0) {
            const last = { ...tools[tools.length - 1] };
            if (last.input._partial) {
              try { last.input = JSON.parse(last.input._partial as string); } catch {}
            }
            tools[tools.length - 1] = last;
          }
          return { ...msg, toolUses: tools };
        });
        return;
      }

      if (event.type === "message_stop") {
        setStatus("connected");
        streamingMessageRef.current = null;
        return;
      }
      return;
    }

    if (type === "assistant") {
      const msg = data.message;
      if (!msg) return;
      const content = msg.content?.filter((c: any) => c.type === "text").map((c: any) => c.text).join("") || "";
      const toolUses: ToolUse[] = msg.content?.filter((c: any) => c.type === "tool_use").map((c: any) => ({
        id: c.id, name: c.name, input: c.input, isComplete: false,
      })) || [];
      const newMsg: ChatMessage = { id: msg.id || crypto.randomUUID(), role: "assistant", content, toolUses, model: msg.model };
      setMessages((prev) => {
        const existing = prev.findIndex((m) => m.id === newMsg.id);
        if (existing >= 0) { const updated = [...prev]; updated[existing] = newMsg; return updated; }
        return [...prev, newMsg];
      });
      return;
    }

    if (type === "tool_result" || (type === "system" && data.subtype === "tool_result")) {
      const toolUseId = data.tool_use_id;
      const result = typeof data.content === "string" ? data.content : JSON.stringify(data.content, null, 2);
      setMessages((prev) => prev.map((msg) => {
        if (!msg.toolUses?.some((t) => t.id === toolUseId)) return msg;
        return { ...msg, toolUses: msg.toolUses?.map((t) => t.id === toolUseId ? { ...t, result, isComplete: true } : t) };
      }));
      return;
    }

    if (type === "auto_eval_start") {
      if (data.branch) setBranch(data.branch);
      setEvalRunning(true);
      setEvalType(data.evalType || null);
      setEvalTimerStart(null);
      return;
    }

    if (type === "auto_eval_complete") {
      if (data.branch) setBranch(data.branch);
      setEvalRunning(false);
      setEvalType(null);
      const evalLabel = data.evalType ? data.evalType.charAt(0).toUpperCase() + data.evalType.slice(1) : "Auto";
      const summaryMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `**${evalLabel} eval complete**\n\n\`\`\`\n${data.summary || "No changes"}\n\`\`\``,
      };
      setMessages((prev) => [...prev, summaryMsg]);
      return;
    }

    if (type === "auto_eval_state") {
      setAutoEval(!!data.enabled);
      if (data.evalTimerStart !== undefined) setEvalTimerStart(data.evalTimerStart);
      if (data.evalChaining !== undefined) setEvalChaining(!!data.evalChaining);
      return;
    }

    if (type === "error") {
      // Reset eval state on error (eval may have failed)
      setEvalRunning(false);
      setEvalType(null);
      // Show error to user in chat
      if (data.message) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `**Error:** ${data.message}`,
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
      setStatus("connected");
      streamingMessageRef.current = null;
      return;
    }

    if (type === "result") {
      setStatus("connected");
      streamingMessageRef.current = null;
      if (data.session_id) setSessionId(data.session_id);
      // Reset eval state — if an eval's claude process finished, this fires
      setEvalRunning(false);
      setEvalType(null);
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role !== "assistant") return prev;
        return [...prev.slice(0, -1), { ...last, cost: data.total_cost_usd, duration: data.duration_ms }];
      });
      return;
    }
  }, []);

  function updateStreamingMessage(updater: (msg: ChatMessage) => ChatMessage) {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role !== "assistant") return prev;
      const updated = updater(last);
      streamingMessageRef.current = updated;
      return [...prev.slice(0, -1), updated];
    });
  }

  // ============================================
  // ACTIONS
  // ============================================

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (status === "streaming") return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = "auto";

    const payload: Record<string, unknown> = { type: "message", text, sessionId, thinking };
    if (selectedModel) payload.model = selectedModel;
    wsRef.current.send(JSON.stringify(payload));
    setStatus("streaming");
  }, [input, status, sessionId, thinking, selectedModel]);

  const startNewChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    streamingMessageRef.current = null;
    setStatus("connected");
    setShowHistory(false);
    inputRef.current?.focus();
  }, []);

  const resumeSession = useCallback((entry: SessionEntry) => {
    setMessages([]);
    setSessionId(entry.sessionId);
    streamingMessageRef.current = null;
    setStatus("connected");
    setShowHistory(false);
    if (entry.model) {
      setSelectedModel(entry.model);
      localStorage.setItem("bridgette-model", entry.model);
    }
    inputRef.current?.focus();
  }, []);

  const stopExecution = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "stop" }));
    setStatus("connected");
    streamingMessageRef.current = null;
  }, []);

  // Keyboard shortcuts: Escape to stop, Cmd+K to clear
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && status === "streaming") {
        stopExecution();
      }
      if (e.key === "k" && (e.metaKey || e.ctrlKey) && status !== "streaming") {
        e.preventDefault();
        startNewChat();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, stopExecution, startNewChat]);

  const changeCwd = useCallback((newCwd: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "set_cwd", cwd: newCwd }));
    setMessages([]);
    setSessionId(null);
    streamingMessageRef.current = null;
    setShowDirPicker(false);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  // ============================================
  // RENDER
  // ============================================

  const isReady = status === "connected" || status === "streaming";

  // Token prompt for remote access
  if (needsToken) {
    return <TokenPrompt onSubmit={(token) => {
      localStorage.setItem("bridgette-token", token);
      setNeedsToken(false);
      reconnectAttemptRef.current = 0;
      connectWebSocket();
    }} />;
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-0)' }}>
      {/* Status bar */}
      <div
        className="flex items-center gap-2.5 px-4 py-1.5 border-b border-white/[0.06] text-xs"
        style={{ background: 'var(--surface-1)' }}
      >
        <StatusDot status={status} />
        <span className="text-gray-400" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          {status === "disconnected" && `Reconnecting in ${Math.min(Math.pow(2, reconnectAttemptRef.current), 15)}s...`}
          {status === "connecting" && "Connecting..."}
          {status === "connected" && (currentModel ? formatModel(currentModel) : "Ready")}
          {status === "streaming" && "Responding..."}
        </span>
        {status === "disconnected" && (
          <button
            onClick={() => {
              if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
              }
              reconnectAttemptRef.current = 0;
              connectWebSocket();
            }}
            className="text-xs px-2 py-0.5 rounded border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors duration-150"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Retry
          </button>
        )}

        {/* Working directory */}
        <button
          onClick={() => setShowDirPicker(!showDirPicker)}
          className="ml-1 flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-all duration-200 text-xs px-2.5 py-1 rounded-md border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]"
          style={{ fontFamily: 'var(--font-mono)' }}
          title="Change working directory"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          {cwd ? shortenPath(cwd) : "Select directory"}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {/* Model selector */}
          <select
            value={selectedModel}
            onChange={(e) => { setSelectedModel(e.target.value); localStorage.setItem("bridgette-model", e.target.value); }}
            className="text-gray-400 text-xs font-medium border border-white/[0.06] rounded-md px-2 py-1 hover:border-white/[0.12] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer transition-all duration-200"
            style={{ background: 'var(--surface-2)', fontFamily: 'var(--font-mono)' }}
          >
            <option value="">Default</option>
            <option value="claude-opus-4-5-20251101">Opus 4.5</option>
            <option value="claude-sonnet-4-20250514">Sonnet 4</option>
            <option value="claude-haiku-3-5-20241022">Haiku 3.5</option>
          </select>

          {/* Auto-eval toggle */}
          <button
            onClick={() => {
              wsRef.current?.send(JSON.stringify({ type: "set_auto_eval", enabled: !autoEval }));
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 border ${
              autoEval
                ? "bg-blue-500/10 text-blue-300 border-blue-500/30 shadow-sm shadow-blue-500/10"
                : "text-gray-500 border-white/[0.06] hover:text-gray-300 hover:border-white/[0.12] hover:bg-white/[0.03]"
            }`}
            title={autoEval ? `Auto-eval enabled (${Math.round(evalInterval / 60000)} min idle)` : "Auto-eval disabled"}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            Auto
          </button>

          {/* Eval interval selector (visible when auto-eval enabled) */}
          {autoEval && (
            <select
              value={evalInterval}
              onChange={(e) => {
                const ms = parseInt(e.target.value, 10);
                wsRef.current?.send(JSON.stringify({ type: "set_eval_interval", interval: ms }));
              }}
              className="text-gray-400 text-xs font-medium border border-white/[0.06] rounded-md px-1.5 py-1 hover:border-white/[0.12] focus:outline-none focus:ring-1 focus:ring-blue-500/50 cursor-pointer transition-all duration-200"
              style={{ background: 'var(--surface-2)', fontFamily: 'var(--font-mono)' }}
              title="Auto-eval interval"
            >
              <option value={60000}>1 min</option>
              <option value={300000}>5 min</option>
              <option value={900000}>15 min</option>
              <option value={1800000}>30 min</option>
              <option value={3600000}>1 hr</option>
              <option value={7200000}>2 hr</option>
            </select>
          )}

          {/* Run Now button (visible when auto-eval enabled) */}
          {autoEval && (
            <button
              onClick={() => {
                if (!evalRunning) {
                  wsRef.current?.send(JSON.stringify({ type: "trigger_auto_eval" }));
                }
              }}
              disabled={status === "streaming" || evalRunning}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all duration-150 border cursor-pointer disabled:cursor-not-allowed ${
                evalRunning
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 animate-subtle-pulse"
                  : "bg-blue-500/10 text-blue-300 border-blue-500/30 hover:bg-blue-500/25 hover:text-blue-200 hover:border-blue-400/50 hover:shadow-sm hover:shadow-blue-500/20 active:bg-blue-500/35 active:scale-95 disabled:opacity-40"
              }`}
              title={evalRunning ? "Auto-eval running..." : "Run auto-eval now"}
            >
              {evalRunning ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
              {evalRunning ? `Running: ${evalType ? evalType.charAt(0).toUpperCase() + evalType.slice(1) : "Eval"}...` : "Run Now"}
            </button>
          )}

          {/* Countdown timer */}
          {autoEval && !evalRunning && countdown && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${evalChaining ? "text-emerald-400" : "text-gray-500"}`}
              style={{ fontFamily: 'var(--font-mono)' }}
              title={evalChaining ? "Chaining — next eval in..." : "Next eval in..."}
            >
              {evalChaining && <span className="text-emerald-500 mr-1">chain</span>}
              {countdown}
            </span>
          )}

          {/* Branch indicator (always visible when not on main) */}
          {branch && branch !== "main" && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20" style={{ fontFamily: 'var(--font-mono)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              {branch}
            </span>
          )}

          {/* Thinking toggle */}
          <button
            onClick={() => setThinking(!thinking)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 border ${
              thinking
                ? "bg-purple-500/10 text-purple-300 border-purple-500/30 shadow-sm shadow-purple-500/10"
                : "text-gray-500 border-white/[0.06] hover:text-gray-300 hover:border-white/[0.12] hover:bg-white/[0.03]"
            }`}
            title={thinking ? "Thinking enabled" : "Thinking disabled"}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z" />
              <path d="M9 22h6" />
            </svg>
            Think
          </button>

          {sessionId && (
            <span className="text-gray-600 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
              {sessionId.slice(0, 8)}
            </span>
          )}

          {/* Session history */}
          <div className="relative" ref={historyRef}>
            <button
              onClick={() => { setSessions(loadSessions()); setShowHistory(!showHistory); }}
              className="text-gray-500 hover:text-gray-300 transition-all duration-200 p-1 rounded-md hover:bg-white/[0.05]"
              title="Session history"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </button>
            {showHistory && (
              <div
                className="absolute right-0 top-full mt-1 w-72 max-h-96 rounded-xl border border-white/[0.08] shadow-2xl z-50 flex flex-col"
                style={{ background: 'var(--surface-2)' }}
              >
                <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
                  <span className="text-xs uppercase tracking-widest text-gray-500 font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>
                    Recent Sessions
                  </span>
                  <div className="flex items-center gap-1.5">
                    {sessions.length > 0 && (
                      <button
                        onClick={() => { clearAllSessions(); setSessions([]); }}
                        className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                        title="Clear all sessions"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        Clear
                      </button>
                    )}
                    <button
                      onClick={() => { setShowHistory(false); setSessionSearch(""); }}
                      className="text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Search input */}
                <div className="px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    placeholder="Search sessions..."
                    className="w-full text-xs border border-white/[0.08] rounded-md px-2.5 py-1.5 text-gray-200 focus:outline-none focus:border-emerald-500/40 transition-all duration-200 placeholder:text-gray-600"
                    style={{ background: 'var(--surface-1)', fontFamily: 'var(--font-mono)' }}
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto flex-1">
                  {/* Current session */}
                  {sessionId && messages.length > 0 && !sessions.some((s) => s.sessionId === sessionId) && (
                    <div className="px-3 py-2.5 border-b border-white/[0.04] bg-emerald-500/5">
                      <div className="text-[13px] text-gray-300 truncate leading-snug">
                        {messages.find((m) => m.role === "user")?.content.slice(0, 100) || "Current session"}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-emerald-400" style={{ fontFamily: 'var(--font-mono)' }}>active</span>
                        <span className="text-xs text-gray-600" style={{ fontFamily: 'var(--font-mono)' }}>{sessionId.slice(0, 8)}</span>
                      </div>
                    </div>
                  )}
                  {(() => {
                    const query = sessionSearch.toLowerCase().trim();
                    const filteredSessions = query
                      ? sessions.filter((s) => s.firstMessage.toLowerCase().includes(query) || s.sessionId.includes(query))
                      : sessions;
                    if (filteredSessions.length === 0 && !sessionId) {
                      return <div className="px-3 py-4 text-xs text-gray-600 text-center">{query ? "No matching sessions" : "No previous sessions"}</div>;
                    }
                    return filteredSessions.map((s) => (
                      <div
                        key={s.sessionId}
                        className={`group/session flex items-center border-b border-white/[0.04] last:border-0 ${
                          s.sessionId === sessionId ? "bg-emerald-500/5" : ""
                        }`}
                      >
                        <button
                          onClick={() => { resumeSession(s); setSessionSearch(""); }}
                          className="flex-1 text-left px-3 py-2.5 hover:bg-white/[0.04] transition-colors min-w-0"
                        >
                          <div className="text-[13px] text-gray-300 truncate leading-snug">{s.firstMessage}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {s.sessionId === sessionId && (
                              <span className="text-xs text-emerald-400" style={{ fontFamily: 'var(--font-mono)' }}>active</span>
                            )}
                            <span className="text-xs text-gray-600" style={{ fontFamily: 'var(--font-mono)' }}>
                              {s.sessionId.slice(0, 8)}
                            </span>
                            <span className="text-xs text-gray-600">
                              {formatRelativeTime(s.timestamp)}
                            </span>
                            {s.model && (
                              <span className="text-xs text-gray-600" style={{ fontFamily: 'var(--font-mono)' }}>
                                {formatModel(s.model)}
                              </span>
                            )}
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(s.sessionId);
                            setSessions(loadSessions());
                          }}
                          className="opacity-0 group-hover/session:opacity-100 transition-opacity duration-150 p-1.5 mr-2 text-gray-600 hover:text-red-400 rounded-md hover:bg-white/[0.05]"
                          title="Delete session"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>

          {messages.length > 0 && (
            <button
              onClick={() => {
                const md = messages.map((m) => {
                  const role = m.role === "user" ? "**You**" : "**Claude**";
                  let text = `${role}\n\n${m.content}`;
                  if (m.toolUses && m.toolUses.length > 0) {
                    text += "\n\n" + m.toolUses.map((t) => `> Tool: ${t.name}${t.result ? `\n> Result: ${t.result.slice(0, 200)}` : ""}`).join("\n\n");
                  }
                  if (m.cost !== undefined) text += `\n\n_Cost: $${m.cost.toFixed(4)}_`;
                  return text;
                }).join("\n\n---\n\n");
                const blob = new Blob([md], { type: "text/markdown" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `chat-${sessionId?.slice(0, 8) || "export"}-${new Date().toISOString().slice(0, 10)}.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="text-gray-500 hover:text-gray-300 transition-all duration-200 p-1 rounded-md hover:bg-white/[0.05]"
              title="Export chat as Markdown"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={startNewChat}
              className="text-gray-500 hover:text-gray-300 transition-all duration-200 p-1 rounded-md hover:bg-white/[0.05]"
              title="New chat"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Directory picker dropdown */}
      {showDirPicker && (
        <div ref={dirPickerRef}>
          <DirectoryPicker
            currentPath={cwd}
            onSelect={changeCwd}
            onClose={() => setShowDirPicker(false)}
          />
        </div>
      )}

      {/* Disconnection banner */}
      {status === "disconnected" && (
        <div className="flex items-center justify-center gap-3 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Connection lost. Auto-reconnecting...</span>
          <button
            onClick={() => {
              if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
              }
              reconnectAttemptRef.current = 0;
              connectWebSocket();
            }}
            className="px-2.5 py-0.5 rounded border border-amber-500/30 text-amber-300 hover:bg-amber-500/15 transition-colors duration-150 font-medium"
          >
            Retry now
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} isStreaming={status === "streaming" && msg === messages[messages.length - 1] && msg.role === "assistant"} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-white/[0.06]" style={{ background: 'var(--surface-1)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isReady ? "Message Claude..." : "Connecting..."}
                rows={1}
                className="w-full resize-none rounded-xl border border-white/[0.08] px-4 py-3 pr-12 text-[15px] text-gray-100 focus:outline-none focus:border-emerald-500/40 transition-all duration-200 placeholder:text-gray-600 input-glow"
                style={{ background: 'var(--surface-2)', fontFamily: 'var(--font-sans)' }}
                disabled={!isReady}
              />
              {status === "streaming" ? (
                <button
                  onClick={stopExecution}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-red-500/90 text-white p-1.5 hover:bg-red-500 transition-all duration-200 shadow-lg shadow-red-500/20"
                  title="Stop (Esc)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || !isReady}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-emerald-500/90 text-white p-1.5 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-emerald-500/20 disabled:shadow-none"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              )}
          </div>
          <div className="mt-2 text-xs text-gray-600 text-center" style={{ fontFamily: 'var(--font-mono)' }}>
            Enter to send · Shift+Enter for new line · Esc to stop · {"\u2318"}K new chat
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyState() {
  const shortcuts = [
    { keys: "Enter", desc: "Send message" },
    { keys: "Shift+Enter", desc: "New line" },
    { keys: "Esc", desc: "Stop response" },
    { keys: "\u2318K", desc: "New chat" },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center border border-white/[0.06]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="absolute inset-0 rounded-2xl bg-emerald-500/5 blur-xl -z-10" />
      </div>
      <h2 className="text-lg font-semibold text-gray-200 mb-2 tracking-tight">
        Chat with Claude
      </h2>
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-6">
        Ask questions, write code, explore ideas. Powered by your Claude Max subscription.
      </p>

      {/* Keyboard shortcuts */}
      <div className="flex items-center gap-4">
        {shortcuts.map((s) => (
          <div key={s.keys} className="flex items-center gap-1.5 text-xs text-gray-600">
            <kbd
              className="px-1.5 py-0.5 rounded border border-white/[0.08] text-gray-400"
              style={{ background: "var(--surface-2)", fontFamily: "var(--font-mono)", fontSize: "11px" }}
            >
              {s.keys}
            </kbd>
            <span>{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// STATUS DOT
// ============================================

function StatusDot({ status }: { status: ConnectionStatus }) {
  const colors: Record<ConnectionStatus, string> = {
    disconnected: "bg-gray-500",
    connecting: "bg-amber-400 animate-subtle-pulse",
    connected: "bg-emerald-400",
    streaming: "bg-emerald-400 animate-subtle-pulse",
  };

  return (
    <span className="relative flex items-center justify-center">
      <span className={`w-1.5 h-1.5 rounded-full ${colors[status]}`} />
      {(status === "connected" || status === "streaming") && (
        <span className="absolute w-3 h-3 rounded-full bg-emerald-400/20" />
      )}
    </span>
  );
}

// ============================================
// MESSAGE BUBBLE
// ============================================

function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming?: boolean }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in-up`}>
      <div className={`${isUser ? "max-w-lg" : "max-w-full w-full"}`}>
        {/* Message content */}
        <div
          className={`rounded-2xl px-4 py-3 text-[15px] ${
            isUser
              ? "bg-emerald-500/10 text-emerald-50 border border-emerald-500/15 rounded-br-md"
              : "border border-white/[0.06] text-gray-200 rounded-bl-md"
          }`}
          style={!isUser ? { background: 'var(--surface-2)' } : undefined}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          ) : (
            <>
              {message.content && (
                <div className="markdown-content">
                  <ReactMarkdown
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const inline = !match && !String(children).includes("\n");
                        if (inline) {
                          return <code className={className} {...props}>{children}</code>;
                        }
                        const codeString = String(children).replace(/\n$/, "");
                        return (
                          <div className="relative group/code">
                            <CodeBlockCopyButton text={codeString} />
                            <SyntaxHighlighter
                              style={oneDark}
                              language={match ? match[1] : "text"}
                              PreTag="div"
                              customStyle={{ margin: '0.75rem 0', borderRadius: '0.5rem', fontSize: '13px', background: 'var(--surface-1)' }}
                            >
                              {codeString}
                            </SyntaxHighlighter>
                          </div>
                        );
                      },
                    }}
                  >{message.content}</ReactMarkdown>
                </div>
              )}
              {isStreaming && !message.content && (
                <TypingIndicator />
              )}
            </>
          )}

          {/* Tool uses */}
          {message.toolUses && message.toolUses.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.toolUses.map((tool) => (
                <ToolUseCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </div>

        {/* Metadata below the bubble */}
        {!isUser && message.cost !== undefined && (
          <div className="mt-1.5 px-1 flex items-center gap-2 text-xs text-gray-600" style={{ fontFamily: 'var(--font-mono)' }}>
            <span>${message.cost.toFixed(4)}</span>
            {message.duration && (
              <span>{(message.duration / 1000).toFixed(1)}s</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// TYPING INDICATOR
// ============================================

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="w-1.5 h-1.5 bg-emerald-400/60 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 bg-emerald-400/60 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 bg-emerald-400/60 rounded-full animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

// ============================================
// TOOL USE CARD
// ============================================

function CodeBlockCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="absolute right-2 top-2 z-10 opacity-0 group-hover/code:opacity-100 transition-opacity duration-150 p-1.5 rounded-md border border-white/[0.08] hover:bg-white/[0.08] text-gray-500 hover:text-gray-300"
      style={{ background: "var(--surface-2)" }}
      title="Copy code"
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ml-auto text-gray-600 hover:text-gray-300 transition-colors duration-150 p-0.5 rounded"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function isDiffContent(text: string): boolean {
  const lines = text.split("\n").slice(0, 20);
  let diffLineCount = 0;
  for (const line of lines) {
    if (line.startsWith("+") || line.startsWith("-") || line.startsWith("@@") || line.startsWith("diff ")) {
      diffLineCount++;
    }
  }
  return diffLineCount >= 3;
}

function DiffResult({ text }: { text: string }) {
  const display = text.length > 2000 ? text.slice(0, 2000) + "\n..." : text;
  return (
    <pre
      className="mt-1.5 rounded-md border border-white/[0.06] p-2.5 overflow-x-auto text-xs max-h-60 overflow-y-auto"
      style={{ background: 'var(--surface-1)', fontFamily: 'var(--font-mono)' }}
    >
      {display.split("\n").map((line, i) => {
        let color = "text-gray-400";
        if (line.startsWith("+++") || line.startsWith("---")) color = "text-gray-500 font-medium";
        else if (line.startsWith("+")) color = "text-emerald-400";
        else if (line.startsWith("-")) color = "text-red-400";
        else if (line.startsWith("@@")) color = "text-blue-400";
        else if (line.startsWith("diff ")) color = "text-gray-300 font-medium";
        return <div key={i} className={color}>{line || " "}</div>;
      })}
    </pre>
  );
}

function ToolUseCard({ tool }: { tool: ToolUse }) {
  const [expanded, setExpanded] = useState(false);

  const displayName = tool.name.replace(/_/g, " ").replace(/^mcp__\w+__/, "");
  const summary = getToolSummary(tool);
  const resultText = tool.result || "";
  const showDiff = resultText && isDiffContent(resultText);

  return (
    <div
      className={`rounded-lg border text-gray-400 overflow-hidden text-xs ${
        tool.isComplete ? "border-white/[0.06]" : "border-amber-500/15"
      }`}
      style={{ background: 'var(--surface-3)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors duration-150"
      >
        {tool.isComplete ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 flex-shrink-0">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-amber-400 animate-spin flex-shrink-0">
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        )}
        <span className="font-medium text-gray-300" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{displayName}</span>
        <span className="text-gray-600 truncate flex-1 text-left text-xs" style={{ fontFamily: 'var(--font-mono)' }}>{summary}</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-gray-600 transition-transform duration-200 flex-shrink-0 ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] px-3 py-2.5 space-y-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-500 text-xs uppercase tracking-wider">Input</span>
              <CopyButton text={JSON.stringify(tool.input, null, 2)} />
            </div>
            <pre
              className="mt-1.5 rounded-md border border-white/[0.06] p-2.5 overflow-x-auto text-xs max-h-40 overflow-y-auto text-gray-400"
              style={{ background: 'var(--surface-1)', fontFamily: 'var(--font-mono)' }}
            >
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>
          {tool.result && (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-500 text-xs uppercase tracking-wider">Result</span>
                <CopyButton text={tool.result} />
              </div>
              {showDiff ? (
                <DiffResult text={resultText} />
              ) : (
                <pre
                  className="mt-1.5 rounded-md border border-white/[0.06] p-2.5 overflow-x-auto text-xs max-h-60 overflow-y-auto text-gray-400"
                  style={{ background: 'var(--surface-1)', fontFamily: 'var(--font-mono)' }}
                >
                  {tool.result.length > 2000 ? tool.result.slice(0, 2000) + "\n..." : tool.result}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function shortenPath(path: string): string {
  const home = "/Users/" + (path.split("/")[2] || "");
  if (path.startsWith(home)) {
    return "~" + path.slice(home.length);
  }
  return path;
}

// ============================================
// DIRECTORY PICKER
// ============================================

function DirectoryPicker({
  currentPath,
  onSelect,
  onClose,
}: {
  currentPath: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [browsePath, setBrowsePath] = useState(currentPath || "");
  const [dirs, setDirs] = useState<{ name: string; path: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [customPath, setCustomPath] = useState(currentPath || "");

  useEffect(() => {
    loadDirs(browsePath);
  }, [browsePath]);

  async function loadDirs(path: string) {
    setLoading(true);
    try {
      const url = path
        ? `/api/directories?path=${encodeURIComponent(path)}`
        : `/api/directories`;
      const res = await fetch(url);
      const data = await res.json();
      setDirs(data.dirs || []);
      if (!path && data.path) {
        setBrowsePath(data.path);
        setCustomPath(data.path);
      }
    } catch {
      setDirs([]);
    }
    setLoading(false);
  }

  function goUp() {
    const parent = browsePath.split("/").slice(0, -1).join("/") || "/";
    setBrowsePath(parent);
    setCustomPath(parent);
  }

  return (
    <div className="border-b border-white/[0.06] shadow-lg" style={{ background: 'var(--surface-1)' }}>
      <div className="max-w-3xl mx-auto px-4 py-3">
        {/* Path input + Use button */}
        <div className="flex items-center gap-2 mb-2">
          <input
            type="text"
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSelect(customPath);
              }
            }}
            className="flex-1 text-xs border border-white/[0.08] rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:border-emerald-500/40 input-glow transition-all duration-200"
            style={{ background: 'var(--surface-2)', fontFamily: 'var(--font-mono)' }}
            placeholder="Enter path..."
          />
          <button
            onClick={() => onSelect(customPath)}
            className="text-xs bg-emerald-500/90 text-white px-3.5 py-2 rounded-lg hover:bg-emerald-500 transition-all duration-200 font-medium shadow-sm shadow-emerald-500/20"
          >
            Use
          </button>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 p-1.5 rounded-md hover:bg-white/[0.05] transition-all duration-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Breadcrumb + up button */}
        <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-500">
          <button onClick={goUp} className="hover:text-gray-300 p-0.5 transition-colors" title="Go up">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
          <span className="truncate" style={{ fontFamily: 'var(--font-mono)' }}>{shortenPath(browsePath)}</span>
        </div>

        {/* Directory list */}
        <div className="max-h-48 overflow-y-auto border border-white/[0.06] rounded-lg divide-y divide-white/[0.04]" style={{ background: 'var(--surface-2)' }}>
          {loading ? (
            <div className="px-3 py-3 text-xs text-gray-600">Loading...</div>
          ) : dirs.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-600">No subdirectories</div>
          ) : (
            dirs.map((dir) => (
              <div key={dir.path} className="flex items-center text-xs">
                <button
                  onClick={() => {
                    setBrowsePath(dir.path);
                    setCustomPath(dir.path);
                  }}
                  className="flex-1 text-left px-3 py-2 hover:bg-white/[0.03] transition-colors flex items-center gap-2 text-gray-300"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600 flex-shrink-0">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {dir.name}
                </button>
                <button
                  onClick={() => onSelect(dir.path)}
                  className="px-3 py-2 text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-500/5 transition-all duration-150 font-medium"
                >
                  Select
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatModel(model: string): string {
  const match = model.match(/claude-(\w+)-(\d+)-(\d+)/);
  if (match) {
    const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    return `${name} ${match[2]}.${match[3]}`;
  }
  return model;
}

function getToolSummary(tool: ToolUse): string {
  const input = tool.input;
  if (!input || typeof input !== "object") return "";

  if (tool.name === "Read" && input.file_path) return String(input.file_path);
  if (tool.name === "Write" && input.file_path) return String(input.file_path);
  if (tool.name === "Edit" && input.file_path) return String(input.file_path);
  if (tool.name === "Bash" && input.command) return String(input.command).slice(0, 80);
  if (tool.name === "Glob" && input.pattern) return String(input.pattern);
  if (tool.name === "Grep" && input.pattern) return String(input.pattern);
  if (tool.name === "WebFetch" && input.url) return String(input.url).slice(0, 80);
  if (tool.name === "WebSearch" && input.query) return String(input.query).slice(0, 80);
  if (tool.name === "Task" && input.description) return String(input.description);

  return "";
}

// ============================================
// TOKEN PROMPT
// ============================================

function TokenPrompt({ onSubmit }: { onSubmit: (token: string) => void }) {
  const [token, setToken] = useState("");

  return (
    <div className="flex flex-col items-center justify-center h-full px-4" style={{ background: 'var(--surface-0)' }}>
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center border border-white/[0.06] mx-auto mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-200 mb-1">Authentication Required</h2>
          <p className="text-sm text-gray-500">Enter your Bridgette access token to connect.</p>
        </div>
        <div>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && token.trim()) onSubmit(token.trim()); }}
            placeholder="Paste token here..."
            className="w-full text-sm border border-white/[0.08] rounded-xl px-4 py-3 text-gray-100 focus:outline-none focus:border-emerald-500/40 transition-all duration-200 placeholder:text-gray-600"
            style={{ background: 'var(--surface-2)', fontFamily: 'var(--font-mono)' }}
            autoFocus
          />
        </div>
        <button
          onClick={() => { if (token.trim()) onSubmit(token.trim()); }}
          disabled={!token.trim()}
          className="w-full text-sm bg-emerald-500/90 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm shadow-emerald-500/20"
        >
          Connect
        </button>
      </div>
    </div>
  );
}
