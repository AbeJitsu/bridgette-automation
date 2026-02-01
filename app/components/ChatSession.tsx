"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";

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
  const [autoEval, setAutoEval] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("bridgette-auto-eval") === "true";
    }
    return false;
  });
  const [autoEvalBranch, setAutoEvalBranch] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingMessageRef = useRef<ChatMessage | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat`);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      setStatus("connected");
      reconnectAttemptRef.current = 0;
      // Sync auto-eval state with server
      const savedAutoEval = localStorage.getItem("bridgette-auto-eval") === "true";
      if (savedAutoEval) {
        ws.send(JSON.stringify({ type: "set_auto_eval", enabled: true }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerEvent(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;
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
      setAutoEvalBranch(data.branch || null);
      return;
    }

    if (type === "auto_eval_state") {
      setAutoEval(!!data.enabled);
      return;
    }

    if (type === "result") {
      setStatus("connected");
      streamingMessageRef.current = null;
      if (data.session_id) setSessionId(data.session_id);
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

  // Escape key to stop streaming
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && status === "streaming") {
        stopExecution();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, stopExecution]);

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

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-0)' }}>
      {/* Status bar */}
      <div
        className="flex items-center gap-2.5 px-4 py-1.5 border-b border-white/[0.06] text-xs"
        style={{ background: 'var(--surface-1)' }}
      >
        <StatusDot status={status} />
        <span className="text-gray-400" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
          {status === "disconnected" && `Reconnecting in ${Math.min(Math.pow(2, reconnectAttemptRef.current), 15)}s...`}
          {status === "connecting" && "Connecting..."}
          {status === "connected" && (currentModel ? formatModel(currentModel) : "Ready")}
          {status === "streaming" && "Responding..."}
        </span>

        {/* Working directory */}
        <button
          onClick={() => setShowDirPicker(!showDirPicker)}
          className="ml-1 flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-all duration-200 text-[11px] px-2.5 py-1 rounded-md border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]"
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
            className="text-gray-400 text-[11px] font-medium border border-white/[0.06] rounded-md px-2 py-1 hover:border-white/[0.12] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer transition-all duration-200"
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
              const next = !autoEval;
              setAutoEval(next);
              localStorage.setItem("bridgette-auto-eval", String(next));
              wsRef.current?.send(JSON.stringify({ type: "set_auto_eval", enabled: next }));
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 border ${
              autoEval
                ? "bg-blue-500/10 text-blue-300 border-blue-500/30 shadow-sm shadow-blue-500/10"
                : "text-gray-500 border-white/[0.06] hover:text-gray-300 hover:border-white/[0.12] hover:bg-white/[0.03]"
            }`}
            title={autoEval ? "Auto-eval enabled (15 min idle)" : "Auto-eval disabled"}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            Auto
          </button>

          {/* Branch indicator */}
          {autoEvalBranch && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20" style={{ fontFamily: 'var(--font-mono)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              {autoEvalBranch}
            </span>
          )}

          {/* Thinking toggle */}
          <button
            onClick={() => setThinking(!thinking)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 border ${
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
            <span className="text-gray-600 text-[10px]" style={{ fontFamily: 'var(--font-mono)' }}>
              {sessionId.slice(0, 8)}
            </span>
          )}

          {/* Session history */}
          <div className="relative">
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
                className="absolute right-0 top-full mt-1 w-72 max-h-80 overflow-y-auto rounded-xl border border-white/[0.08] shadow-2xl z-50"
                style={{ background: 'var(--surface-2)' }}
              >
                <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>
                    Recent Sessions
                  </span>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {/* Current session */}
                {sessionId && messages.length > 0 && !sessions.some((s) => s.sessionId === sessionId) && (
                  <div className="px-3 py-2.5 border-b border-white/[0.04] bg-emerald-500/5">
                    <div className="text-[13px] text-gray-300 truncate leading-snug">
                      {messages.find((m) => m.role === "user")?.content.slice(0, 100) || "Current session"}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-emerald-400" style={{ fontFamily: 'var(--font-mono)' }}>active</span>
                      <span className="text-[10px] text-gray-600" style={{ fontFamily: 'var(--font-mono)' }}>{sessionId.slice(0, 8)}</span>
                    </div>
                  </div>
                )}
                {sessions.length === 0 && !sessionId ? (
                  <div className="px-3 py-4 text-xs text-gray-600 text-center">No previous sessions</div>
                ) : (
                  sessions.map((s) => (
                    <button
                      key={s.sessionId}
                      onClick={() => resumeSession(s)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0 ${
                        s.sessionId === sessionId ? "bg-emerald-500/5" : ""
                      }`}
                    >
                      <div className="text-[13px] text-gray-300 truncate leading-snug">{s.firstMessage}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {s.sessionId === sessionId && (
                          <span className="text-[10px] text-emerald-400" style={{ fontFamily: 'var(--font-mono)' }}>active</span>
                        )}
                        <span className="text-[10px] text-gray-600" style={{ fontFamily: 'var(--font-mono)' }}>
                          {s.sessionId.slice(0, 8)}
                        </span>
                        <span className="text-[10px] text-gray-600">
                          {formatRelativeTime(s.timestamp)}
                        </span>
                        {s.model && (
                          <span className="text-[10px] text-gray-600" style={{ fontFamily: 'var(--font-mono)' }}>
                            {formatModel(s.model)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

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
        <DirectoryPicker
          currentPath={cwd}
          onSelect={changeCwd}
          onClose={() => setShowDirPicker(false)}
        />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-emerald-500/90 text-white p-1.5 hover:bg-emerald-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-emerald-500/20 disabled:shadow-none"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              )}
          </div>
          <div className="mt-2 text-[10px] text-gray-600 text-center" style={{ fontFamily: 'var(--font-mono)' }}>
            Enter to send · Shift+Enter for new line · Esc to stop
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
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center border border-white/[0.06]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {/* Subtle glow behind icon */}
        <div className="absolute inset-0 rounded-2xl bg-emerald-500/5 blur-xl -z-10" />
      </div>
      <h2 className="text-lg font-semibold text-gray-200 mb-2 tracking-tight">
        Chat with Claude
      </h2>
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
        Ask questions, write code, explore ideas. Powered by your Claude Max subscription.
      </p>
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
                  <ReactMarkdown>{message.content}</ReactMarkdown>
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
          <div className="mt-1.5 px-1 flex items-center gap-2 text-[10px] text-gray-600" style={{ fontFamily: 'var(--font-mono)' }}>
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

function ToolUseCard({ tool }: { tool: ToolUse }) {
  const [expanded, setExpanded] = useState(false);

  const displayName = tool.name.replace(/_/g, " ").replace(/^mcp__\w+__/, "");
  const summary = getToolSummary(tool);

  return (
    <div
      className="rounded-lg border border-white/[0.06] text-gray-400 overflow-hidden text-xs"
      style={{ background: 'var(--surface-3)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors duration-150"
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tool.isComplete ? "bg-emerald-400" : "bg-amber-400 animate-subtle-pulse"}`} />
        <span className="font-medium text-gray-300" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{displayName}</span>
        <span className="text-gray-600 truncate flex-1 text-left text-[11px]" style={{ fontFamily: 'var(--font-mono)' }}>{summary}</span>
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
            <span className="font-medium text-gray-500 text-[10px] uppercase tracking-wider">Input</span>
            <pre
              className="mt-1.5 rounded-md border border-white/[0.06] p-2.5 overflow-x-auto text-[11px] max-h-40 overflow-y-auto text-gray-400"
              style={{ background: 'var(--surface-1)', fontFamily: 'var(--font-mono)' }}
            >
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>
          {tool.result && (
            <div>
              <span className="font-medium text-gray-500 text-[10px] uppercase tracking-wider">Result</span>
              <pre
                className="mt-1.5 rounded-md border border-white/[0.06] p-2.5 overflow-x-auto text-[11px] max-h-60 overflow-y-auto text-gray-400"
                style={{ background: 'var(--surface-1)', fontFamily: 'var(--font-mono)' }}
              >
                {tool.result.length > 2000 ? tool.result.slice(0, 2000) + "\n..." : tool.result}
              </pre>
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

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
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
