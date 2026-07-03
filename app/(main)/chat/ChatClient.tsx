"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { getAuthHeaders, getToken, scheduleTokenRefresh } from "../../lib/tokenManager";

type UserSummary = {
  id: string;
  name: string;
  email: string;
};

type ConversationMember = {
  user?: UserSummary;
};

type Conversation = {
  id: string;
  isGroup: boolean;
  name?: string | null;
  members?: ConversationMember[];
  messages?: { content: string }[];
};

type MessageReaction = {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  user?: { id: string; name: string };
};

type Message = {
  id: string;
  conversationId?: string | null;
  sender?: UserSummary & { id: string };
  content: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  reactions?: MessageReaction[];
};

type TypingUser = {
  userId: string;
  name: string;
};

const TYPING_DEBOUNCE = 1500;

export default function ChatClient({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "disconnected">(() =>
    getToken() ? "connecting" : "disconnected",
  );
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const [msgSearchQuery, setMsgSearchQuery] = useState("");
  const [msgSearchResults, setMsgSearchResults] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const currentConvRef = useRef<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userNameRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const raw = localStorage.getItem("user");
    if (raw) { try { userNameRef.current = JSON.parse(raw).name; } catch {} }
    fetch("/api/v1/chat/conversations", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => setConversations(Array.isArray(j.data) ? j.data : []))
      .catch(() => setConversations([]));
  }, [userId]);

  useEffect(() => {
    scheduleTokenRefresh();
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000", {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketStatus("connected");
      if (userId) {
        socket.emit("join", { userId });
        if (currentConvRef.current) {
          socket.emit("joinConversation", { conversationId: currentConvRef.current });
        }
      }
    });

    socket.on("disconnect", () => setSocketStatus("disconnected"));

    socket.on("connect_error", (error: Error) => {
      console.error(`Socket connection error: ${error.message}`);
      setSocketStatus("disconnected");
    });

    socket.on("error", (error: string) => console.error("Socket error:", error));

    socket.on("chat:message", (msg: Message) => {
      if (currentConvRef.current && msg.conversationId === currentConvRef.current) {
        setMessages((prev) => {
          const existing = prev.findIndex((m) => m.id === msg.id);
          if (existing >= 0) {
            const next = [...prev];
            next[existing] = msg;
            return next;
          }
          if (msg.deletedAt) return prev;
          return [...prev, msg];
        });
      } else {
        fetch("/api/v1/chat/conversations", { headers: getAuthHeaders() })
          .then((r) => r.json())
          .then((j) => setConversations(Array.isArray(j.data) ? j.data : []))
          .catch(() => {});
      }
    });

    socket.on("typing:start", (payload: TypingUser & { conversationId: string }) => {
      if (payload.conversationId === currentConvRef.current && payload.userId !== userId) {
        setTypingUsers((prev) => {
          if (prev.find((u) => u.userId === payload.userId)) return prev;
          return [...prev, { userId: payload.userId, name: payload.name }];
        });
      }
    });

    socket.on("typing:stop", (payload: { conversationId: string; userId: string }) => {
      if (payload.conversationId === currentConvRef.current) {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId));
      }
    });

    socket.on("user:online", (payload: { userId: string }) => {
      setOnlineUsers((prev) => new Set(prev).add(payload.userId));
    });

    socket.on("user:offline", (payload: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(payload.userId);
        return next;
      });
    });

    socket.on("reaction:added", (payload: { messageId: string; userId: string; emoji: string; user?: { id: string; name: string } }) => {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== payload.messageId) return m;
        const existing = m.reactions?.find((r) => r.userId === payload.userId && r.emoji === payload.emoji);
        if (existing) return m;
        return { ...m, reactions: [...(m.reactions ?? []), { id: `temp-${Date.now()}`, messageId: payload.messageId, userId: payload.userId, emoji: payload.emoji, user: payload.user }] };
      }));
    });

    socket.on("reaction:removed", (payload: { messageId: string; userId: string; emoji: string }) => {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== payload.messageId) return m;
        return { ...m, reactions: m.reactions?.filter((r) => !(r.userId === payload.userId && r.emoji === payload.emoji)) ?? [] };
      }));
    });

    return () => {
      if (userId && socketRef.current) socketRef.current.emit("leave", { userId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]);

  useEffect(() => {
    const socket = socketRef.current;
    const prev = currentConvRef.current;
    if (prev && socket) {
      socket.emit("leaveConversation", { conversationId: prev });
      currentConvRef.current = null;
    }
    setTypingUsers([]);
    if (activeConv?.id && socket) {
      socket.emit("joinConversation", { conversationId: activeConv.id });
      currentConvRef.current = activeConv.id;
    }
  }, [activeConv?.id]);

  useEffect(() => {
    if (!activeConv) return;
    setMessages([]);
    setHasMore(false);
    fetch(`/api/v1/chat/messages?conversationId=${encodeURIComponent(activeConv.id)}&limit=50`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => {
        setMessages(Array.isArray(j.data) ? j.data : []);
        setHasMore(j.hasMore ?? false);
      })
      .catch(() => setMessages([]));
  }, [activeConv]);

  async function loadMore() {
    if (!activeConv || messages.length === 0) return;
    const cursor = messages[0].id;
    const res = await fetch(`/api/v1/chat/messages?conversationId=${encodeURIComponent(activeConv.id)}&cursor=${cursor}&limit=50`, { headers: getAuthHeaders() });
    const j = await res.json();
    if (j.success && Array.isArray(j.data)) {
      setMessages((prev) => [...j.data, ...prev]);
      setHasMore(j.hasMore ?? false);
    }
  }

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      fetch(`/api/v1/users/search?q=${encodeURIComponent(searchQuery)}`, { headers: getAuthHeaders() })
        .then((r) => r.json())
        .then((j) => setSearchResults(j.success ? j.data : []))
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (msgSearchQuery.length < 2) { setMsgSearchResults([]); return; }
    const timer = setTimeout(() => {
      fetch(`/api/v1/chat/search?q=${encodeURIComponent(msgSearchQuery)}`, { headers: getAuthHeaders() })
        .then((r) => r.json())
        .then((j) => setMsgSearchResults(j.success ? j.data : []))
        .catch(() => setMsgSearchResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [msgSearchQuery]);

  function jumpToConversation(convId: string) {
    const conv = conversations.find((c) => c.id === convId);
    if (conv) {
      setActiveConv(conv);
      setMsgSearchQuery("");
      setMsgSearchResults([]);
    }
  }

  const emitTyping = useCallback((start: boolean) => {
    const socket = socketRef.current;
    const convId = currentConvRef.current;
    if (!socket || !convId) return;
    if (start) {
      socket.emit("typing:start", { conversationId: convId, userId, name: userNameRef.current });
    } else {
      socket.emit("typing:stop", { conversationId: convId, userId });
    }
  }, [userId]);

  function handleTextChange(value: string) {
    setText(value);
    if (!typingTimerRef.current) emitTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      emitTyping(false);
      typingTimerRef.current = null;
    }, TYPING_DEBOUNCE);
  }

  async function send() {
    if (!activeConv || !text.trim()) return;
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    emitTyping(false);
    const body = { conversationId: activeConv.id, content: text.trim() };
    const res = await fetch("/api/v1/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (j?.success && j.data) {
      setMessages((prev) => [...prev, j.data]);
      setText("");
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    const existing = messages.find((m) => m.id === messageId)?.reactions?.find((r) => r.userId === userId && r.emoji === emoji);
    if (existing) {
      await fetch(`/api/v1/chat/reactions?messageId=${messageId}&emoji=${encodeURIComponent(emoji)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    } else {
      await fetch("/api/v1/chat/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ messageId, emoji }),
      });
    }
  }

  async function handleEdit(messageId: string) {
    if (!editText.trim()) return;
    const res = await fetch(`/api/v1/chat/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ content: editText.trim() }),
    });
    const j = await res.json();
    if (j.success) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? j.data : m)));
      setEditingMsgId(null);
      setEditText("");
    }
  }

  async function handleDelete(messageId: string) {
    const res = await fetch(`/api/v1/chat/messages/${messageId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const j = await res.json();
    if (j.success) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: "[deleted]", deletedAt: new Date().toISOString() } : m)));
    }
  }

  async function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/v1/files/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });
      const j = await res.json();
      if (j.success) {
        const url = j.data.fileUrl;
        const marker = `[${file.name}](${url})`;
        setText((prev) => (prev ? `${prev}\n${marker}` : marker));
      }
    } catch {}
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function renderContent(content: string) {
    const fileRegex = /\[([^\]]+)\]\((\/[^\s)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    let idx = 0;
    while ((match = fileRegex.exec(content)) !== null) {
      if (match.index > last) parts.push(<span key={idx++}>{content.slice(last, match.index)}</span>);
      const fileName = match[1];
      const fileUrl = match[2];
      const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
      parts.push(
        <div key={idx++} style={{ marginTop: 4 }}>
          {isImage ? (
            <a href={fileUrl} target="_blank" rel="noreferrer">
              <img src={fileUrl} alt={fileName} style={{ maxWidth: 240, maxHeight: 160, borderRadius: 6, display: "block" }} />
            </a>
          ) : (
            <a href={fileUrl} target="_blank" rel="noreferrer" style={{ color: "#93c5fd", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
              {"\uD83D\uDCC4"} {fileName}
            </a>
          )}
        </div>,
      );
      last = match.index + match[0].length;
    }
    if (last < content.length) parts.push(<span key={idx++}>{content.slice(last)}</span>);
    return parts.length > 0 ? parts : content;
  }

  async function startConversation(otherUser: UserSummary) {
    const res = await fetch("/api/v1/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ participants: [otherUser.id] }),
    });
    const j = await res.json();
    if (j.success) {
      setConversations((prev) => [j.data, ...prev]);
      setActiveConv(j.data);
      setSearchQuery("");
      setSearchResults([]);
    }
  }

  function otherUserId(c: Conversation): string | undefined {
    return c.members?.find((m) => m.user?.id !== userId)?.user?.id;
  }

  function isOnline(c: Conversation): boolean {
    const id = otherUserId(c);
    return id ? onlineUsers.has(id) : false;
  }

  const typingLabel = typingUsers.length === 1
    ? `${typingUsers[0].name} is typing...`
    : typingUsers.length > 1
      ? `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing...`
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ padding: "4px 8px", background: socketStatus === "connected" ? "#d1fae5" : socketStatus === "connecting" ? "#fef3c7" : "#fee2e2", borderRadius: 4 }}>
        <span style={{ fontSize: 12, fontWeight: "bold" }}>
          Socket: {socketStatus === "connected" ? "\u2713 Connected" : socketStatus === "connecting" ? "\u27F3 Connecting..." : "\u2717 Disconnected"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <aside style={{ width: 280, borderRight: "1px solid #334155", paddingRight: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #475569", background: "#1e293b", color: "#f1f5f9", fontSize: 13, outline: "none" }}
            />
            {searchResults.length > 0 && (
              <div style={{ marginTop: 4, border: "1px solid #475569", borderRadius: 4, background: "#1e293b" }}>
                {searchResults.map((u) => (
                  <div key={u.id} onClick={() => startConversation(u)}
                    style={{ padding: "6px 8px", cursor: "pointer", fontSize: 13, color: "#e2e8f0", borderBottom: "1px solid #334155" }}>
                    <strong>{u.name}</strong>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{u.email}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 8 }}>
            <input
              value={msgSearchQuery}
              onChange={(e) => setMsgSearchQuery(e.target.value)}
              placeholder="Search messages..."
              style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #475569", background: "#1e293b", color: "#f1f5f9", fontSize: 13, outline: "none" }}
            />
            {msgSearchResults.length > 0 && (
              <div style={{ marginTop: 4, border: "1px solid #475569", borderRadius: 4, background: "#1e293b", maxHeight: 200, overflow: "auto" }}>
                {msgSearchResults.map((m) => (
                  <div key={m.id} onClick={() => jumpToConversation(m.conversationId ?? "")}
                    style={{ padding: "6px 8px", cursor: "pointer", fontSize: 12, color: "#e2e8f0", borderBottom: "1px solid #334155" }}>
                    <div style={{ color: "#93c5fd", fontSize: 11 }}>{m.sender?.name ?? "Unknown"}</div>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#94a3b8" }}>{m.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", margin: "0 0 8px 0" }}>Conversations</h3>
          {conversations.length === 0 && <p style={{ fontSize: 12, color: "#64748b" }}>No conversations yet. Search for a user above to start one.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {conversations.map((c) => (
              <div key={c.id}
                onClick={() => setActiveConv(c)}
                style={{ cursor: "pointer", padding: "6px 8px", borderRadius: 4, background: activeConv?.id === c.id ? "#1e40af" : "transparent", color: activeConv?.id === c.id ? "#fff" : "#cbd5e1", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <strong>{c.name ?? (c.isGroup ? "Group" : c.members?.find((m) => m.user?.id !== userId)?.user?.name ?? "Conversation")}</strong>
                  {!c.isGroup && isOnline(c) && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />}
                </div>
                <div style={{ fontSize: 11, color: activeConv?.id === c.id ? "#bfdbfe" : "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.messages?.[0]?.content ?? ""}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: 6 }}>
            {activeConv ? (activeConv.name ?? activeConv.members?.find((m) => m.user?.id !== userId)?.user?.name ?? "Chat") : "Messages"}
            {activeConv && !activeConv.isGroup && isOnline(activeConv) && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />}
          </h3>
          {!activeConv ? (
            <p style={{ color: "#64748b", fontSize: 13 }}>Select a conversation or search for a user</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ maxHeight: 360, overflow: "auto", padding: 8, border: "1px solid #334155", borderRadius: 6, background: "#0f172a" }}>
                {hasMore && (
                  <button onClick={loadMore} style={{ width: "100%", padding: "6px", fontSize: 12, color: "#93c5fd", background: "transparent", border: "1px dashed #334155", borderRadius: 4, cursor: "pointer", marginBottom: 8 }}>
                    Load older messages
                  </button>
                )}
                {messages.map((m) => {
                  const isMine = m.sender?.id === userId;
                  const isDeleted = !!m.deletedAt;
                  const isEditing = editingMsgId === m.id;
                  return (
                    <div key={m.id} style={{ marginBottom: 8, display: "flex", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "75%", background: isMine ? "#1e40af" : "#1e293b", borderRadius: 8, padding: "6px 10px" }}>
                        {!isMine && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                            <strong style={{ fontSize: 11, color: "#93c5fd" }}>{m.sender?.name}</strong>
                            {m.sender?.id && onlineUsers.has(m.sender.id) && (
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                            )}
                          </div>
                        )}
                        {isEditing ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            <input value={editText} onChange={(e) => setEditText(e.target.value)}
                              style={{ flex: 1, padding: "4px 6px", borderRadius: 4, border: "1px solid #475569", background: "#0f172a", color: "#f1f5f9", fontSize: 13, outline: "none" }} />
                            <button onClick={() => handleEdit(m.id)} style={{ padding: "4px 8px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>Save</button>
                            <button onClick={() => { setEditingMsgId(null); setEditText(""); }} style={{ padding: "4px 8px", background: "#475569", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>Cancel</button>
                          </div>
                        ) : (
                          <>
                            <span style={{ fontSize: 13, color: isDeleted ? "#64748b" : "#f1f5f9", fontStyle: isDeleted ? "italic" : "normal" }}>{isDeleted ? m.content : renderContent(m.content)}</span>
                            {m.editedAt && !isDeleted && <span style={{ fontSize: 10, color: "#64748b", marginLeft: 4 }}>(edited)</span>}
                          </>
                        )}
                        {!isDeleted && (
                          <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                            {m.reactions?.reduce<{ emoji: string; count: number; hasMine: boolean }[]>((acc, r) => {
                              const existing = acc.find((a) => a.emoji === r.emoji);
                              if (existing) { existing.count++; if (r.userId === userId) existing.hasMine = true; }
                              else acc.push({ emoji: r.emoji, count: 1, hasMine: r.userId === userId });
                              return acc;
                            }, []).map((r) => (
                              <button key={r.emoji} onClick={() => toggleReaction(m.id, r.emoji)}
                                style={{ padding: "1px 6px", fontSize: 12, borderRadius: 10, border: `1px solid ${r.hasMine ? "#3b82f6" : "#334155"}`, background: r.hasMine ? "#1e3a5f" : "transparent", cursor: "pointer", color: "#e2e8f0", display: "inline-flex", alignItems: "center", gap: 3 }}>
                                {r.emoji} {r.count}
                              </button>
                            ))}
                          </div>
                        )}
                        {isMine && !isDeleted && !isEditing && (
                          <div style={{ marginTop: 2, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button onClick={() => { setEditingMsgId(m.id); setEditText(m.content); }} style={{ padding: 0, background: "none", color: "#93c5fd", border: "none", cursor: "pointer", fontSize: 10 }}>Edit</button>
                            <button onClick={() => handleDelete(m.id)} style={{ padding: 0, background: "none", color: "#fca5a5", border: "none", cursor: "pointer", fontSize: 10 }}>Delete</button>
                          </div>
                        )}
                        {!isDeleted && (
                          <div style={{ marginTop: 2 }}>
                            <button onClick={() => toggleReaction(m.id, "\u2764\uFE0F")} style={{ padding: 0, background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#64748b", opacity: 0.6 }} title="React">{"\uD83D\uDE0A"}</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {typingLabel && (
                  <div style={{ fontSize: 11, color: "#94a3b8", padding: "4px 8px", fontStyle: "italic" }}>{typingLabel}</div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: "none" }}
                  onChange={handleAttach}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{ padding: "8px 10px", background: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: 6, cursor: "pointer", fontSize: 16, lineHeight: 1, opacity: uploading ? 0.5 : 1 }}
                  title="Attach file"
                >
                  {"\uD83D\uDCCE"}
                </button>
                <input
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid #475569", background: "#1e293b", color: "#f1f5f9", fontSize: 13, outline: "none" }}
                  placeholder="Type a message..."
                />
                <button onClick={send}
                  style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
