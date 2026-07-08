"use client";
/* eslint-disable react-hooks/set-state-in-effect */
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
  const [showSearch, setShowSearch] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<UserSummary[]>([]);
  const [groupName, setGroupName] = useState("");

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

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3333", {
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
        .then((j) => { if (j.success) setSearchResults(j.data); else setSearchResults([]); })
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (msgSearchQuery.length < 2) { setMsgSearchResults([]); return; }
    const timer = setTimeout(() => {
      fetch(`/api/v1/chat/search?q=${encodeURIComponent(msgSearchQuery)}`, { headers: getAuthHeaders() })
        .then((r) => r.json())
        .then((j) => { if (j.success) setMsgSearchResults(j.data); else setMsgSearchResults([]); })
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
      setShowSearch(false);
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
        <div key={idx++} className="mt-1">
          {isImage ? (
            <a href={fileUrl} target="_blank" rel="noreferrer">
              <img src={fileUrl} alt={fileName} style={{ maxWidth: 240, maxHeight: 160, borderRadius: 8 }} className="rounded-lg" />
            </a>
          ) : (
            <a href={fileUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-purple-300 text-xs hover:text-purple-200 transition-colors">
              📄 {fileName}
            </a>
          )}
        </div>,
      );
      last = match.index + match[0].length;
    }
    if (last < content.length) parts.push(<span key={idx++}>{content.slice(last)}</span>);
    return parts.length > 0 ? parts : content;
  }

  async function startConversation(users: UserSummary[], name?: string) {
    const participantIds = users.map((u) => u.id);
    const res = await fetch("/api/v1/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ participants: participantIds, name }),
    });
    const j = await res.json();
    if (j.success) {
      setConversations((prev) => [j.data, ...prev]);
      setActiveConv(j.data);
      setSearchQuery("");
      setSearchResults([]);
      setSelectedUsers([]);
      setGroupName("");
      setShowUserSearch(false);
    }
  }

  function otherUserIds(c: Conversation): string[] {
    return c.members?.filter((m) => m.user?.id !== userId).map((m) => m.user?.id).filter(Boolean) as string[] || [];
  }

  function otherUserName(c: Conversation): string {
    if (c.isGroup) {
      const names = c.members?.filter((m) => m.user?.id !== userId).map((m) => m.user?.name).filter(Boolean) || [];
      return names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3} more` : "");
    }
    return c.members?.find((m) => m.user?.id !== userId)?.user?.name ?? "Conversation";
  }

  function isOnline(c: Conversation): boolean {
    const ids = otherUserIds(c);
    return ids.some((id) => onlineUsers.has(id));
  }

  const typingLabel = typingUsers.length === 1
    ? `${typingUsers[0].name} is typing...`
    : typingUsers.length > 1
      ? `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing...`
      : null;

  return (
    <div className="flex flex-col relative" style={{ height: "calc(100vh - 200px)", minHeight: 500 }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(45, 55, 71, 0.4)" }}
      >
        <div className="flex items-center gap-3">
          {/* Mobile back button */}
          {activeConv && (
            <button
              onClick={() => setActiveConv(null)}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-xl transition-colors hover:bg-white/5 text-slate-400 hover:text-white"
            >
              ←
            </button>
          )}
          <div>
            <h2 className="text-base font-semibold text-white">
              {activeConv
                ? (activeConv.name ?? (activeConv.isGroup ? "Group" : otherUserName(activeConv)))
                : "Messages"}
            </h2>
            {activeConv && activeConv.isGroup && (
              <p className="text-xs text-slate-500 mt-0.5">
                {activeConv.members?.length ?? 0} members · {otherUserName(activeConv)}
              </p>
            )}
            {activeConv && !activeConv.isGroup && isOnline(activeConv) && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
            )}
            {activeConv && !activeConv.isGroup && !isOnline(activeConv) && (
              <span className="text-xs text-slate-500 mt-0.5 block">Offline</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Socket status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
            style={{
              background: socketStatus === "connected" ? "rgba(16, 185, 129, 0.1)" : socketStatus === "connecting" ? "rgba(245, 158, 11, 0.1)" : "rgba(239, 68, 68, 0.1)",
            }}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              socketStatus === "connected" ? "bg-emerald-400" : socketStatus === "connecting" ? "bg-amber-400 animate-pulse" : "bg-red-400"
            }`} />
            <span className="text-xs font-medium"
              style={{
                color: socketStatus === "connected" ? "#6ee7b7" : socketStatus === "connecting" ? "#fcd34d" : "#fca5a5",
              }}
            >{socketStatus === "connected" ? "Live" : socketStatus === "connecting" ? "Connecting" : "Offline"}</span>
          </div>

          {/* Search buttons */}
          <button onClick={() => { setShowUserSearch(!showUserSearch); setShowSearch(false); setSelectedUsers([]); setGroupName(""); }}
            className="btn-ghost text-xs flex items-center gap-1.5 px-2.5 py-1.5"
            title="Start a new conversation"
          >🔍 New Chat</button>
          <button onClick={() => { setShowSearch(!showSearch); setShowUserSearch(false); }}
            className="btn-ghost text-xs flex items-center gap-1.5 px-2.5 py-1.5"
            title="Search messages"
          >🔎 Search</button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Conversations sidebar - hidden on mobile when a conversation is active */}
        <div className={`w-64 shrink-0 flex flex-col overflow-hidden ${
          activeConv ? "hidden md:flex" : "flex"
        }`}
          style={{ borderRight: "1px solid rgba(45, 55, 71, 0.3)" }}
        >
          <div className="overflow-y-auto flex-1 p-2 space-y-0.5">
            {conversations.length === 0 ? (
              <div className="p-3 text-xs text-slate-500 text-center">No conversations yet. Search for a user above to start one.</div>
            ) : (
              conversations.map((c) => (
                <div key={c.id}
                  onClick={() => setActiveConv(c)}
                  className="px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150"
                  style={{
                    background: activeConv?.id === c.id ? "rgba(124, 58, 237, 0.12)" : "transparent",
                    border: activeConv?.id === c.id ? "1px solid rgba(124, 58, 237, 0.2)" : "1px solid transparent",
                  }}
                  onMouseEnter={(e) => { if (activeConv?.id !== c.id) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; } }}
                  onMouseLeave={(e) => { if (activeConv?.id !== c.id) { e.currentTarget.style.background = "transparent"; } }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                      <div className={`flex items-center justify-center rounded-full text-xs font-bold text-white ${
                        c.isGroup ? "w-9 h-9" : "w-8 h-8"
                      }`}
                        style={{ background: activeConv?.id === c.id ? "linear-gradient(135deg, #7c3aed, #ec4899)" : (c.isGroup ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #374151, #4b5563)") }}
                      >
                        {c.isGroup ? "#" : (c.members?.find((m) => m.user?.id !== userId)?.user?.name ?? "?").charAt(0).toUpperCase()}
                      </div>
                      {!c.isGroup && (
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${
                          isOnline(c) ? "bg-emerald-400 border-emerald-900" : "bg-slate-500 border-slate-800"
                        }`} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-medium truncate ${activeConv?.id === c.id ? "text-white" : "text-slate-300"}`}>
                          {c.name ?? (c.isGroup ? `Group (${c.members?.length ?? 0})` : otherUserName(c))}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {c.isGroup && otherUserName(c) !== "Conversation" ? (
                          <span className="text-violet-400">{otherUserName(c)}</span>
                        ) : (
                          c.messages?.[0]?.content ?? ""
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main chat area */}
        <div className={`flex-1 flex flex-col min-w-0 ${!activeConv ? "hidden md:flex" : "flex"}`}>
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-4xl mb-3">💬</p>
                <p className="text-slate-500 text-sm">Select a conversation to start chatting</p>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
                {hasMore && (
                  <div className="text-center py-2">
                    <button onClick={loadMore} className="text-xs text-purple-400 hover:text-purple-300 transition-colors bg-transparent border border-purple-900/30 rounded-lg px-4 py-1.5 cursor-pointer">
                      Load older messages
                    </button>
                  </div>
                )}

                {messages.map((m) => {
                  const isMine = m.sender?.id === userId;
                  const isDeleted = !!m.deletedAt;
                  const isEditing = editingMsgId === m.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"} group mb-1`}
                    >
                      <div className="max-w-[70%]"
                        style={{ minWidth: 120 }}
                      >
                        {!isMine && !isDeleted && (
                          <p className="text-xs font-semibold mb-0.5 px-1" style={{ color: isMine ? "#a78bfa" : "#94a3b8" }}>
                            {m.sender?.name}
                          </p>
                        )}
                        <div className={`rounded-2xl px-4 py-2.5 transition-all duration-150 relative ${
                          isMine
                            ? "rounded-br-md"
                            : "rounded-bl-md"
                        }`}
                          style={{
                            background: isMine
                              ? "linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(124, 58, 237, 0.1))"
                              : "rgba(45, 55, 71, 0.3)",
                            border: isMine
                              ? "1px solid rgba(124, 58, 237, 0.15)"
                              : "1px solid rgba(45, 55, 71, 0.2)",
                          }}
                        >
                          {isEditing ? (
                            <div className="flex gap-2">
                              <input value={editText} onChange={(e) => setEditText(e.target.value)}
                                className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
                                style={{ background: "rgba(13, 17, 23, 0.8)", border: "1px solid rgba(124, 58, 237, 0.3)", color: "#f1f5f9" }}
                                autoFocus
                              />
                              <button onClick={() => handleEdit(m.id)} className="btn-primary text-xs px-3 py-1">Save</button>
                              <button onClick={() => { setEditingMsgId(null); setEditText(""); }} className="btn-secondary text-xs px-3 py-1">Cancel</button>
                            </div>
                          ) : (
                            <>
                              <p className={`text-sm leading-relaxed ${isDeleted ? "text-slate-500 italic" : "text-slate-100"}`}>
                                {isDeleted ? m.content : renderContent(m.content)}
                              </p>
                              {m.editedAt && !isDeleted && (
                                <span className="text-[10px] text-slate-500 ml-1">(edited)</span>
                              )}
                            </>
                          )}

                          {/* Reactions */}
                          {!isDeleted && !isEditing && m.reactions && m.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {m.reactions.reduce<{ emoji: string; count: number; hasMine: boolean }[]>((acc, r) => {
                                const existing = acc.find((a) => a.emoji === r.emoji);
                                if (existing) { existing.count++; if (r.userId === userId) existing.hasMine = true; }
                                else acc.push({ emoji: r.emoji, count: 1, hasMine: r.userId === userId });
                                return acc;
                              }, []).map((r) => (
                                <button key={r.emoji} onClick={() => toggleReaction(m.id, r.emoji)}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all cursor-pointer"
                                  style={{
                                    background: r.hasMine ? "rgba(124, 58, 237, 0.2)" : "rgba(255,255,255,0.05)",
                                    border: `1px solid ${r.hasMine ? "rgba(124, 58, 237, 0.3)" : "rgba(255,255,255,0.1)"}`,
                                    color: "#e2e8f0",
                                  }}
                                >
                                  {r.emoji} <span className="font-medium">{r.count}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        {isMine && !isDeleted && !isEditing && (
                          <div className="flex gap-1 justify-end px-2 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingMsgId(m.id); setEditText(m.content); }}
                              className="text-[10px] text-slate-500 hover:text-purple-400 transition-colors bg-transparent border-none cursor-pointer px-1"
                            >Edit</button>
                            <button onClick={() => handleDelete(m.id)}
                              className="text-[10px] text-slate-500 hover:text-red-400 transition-colors bg-transparent border-none cursor-pointer px-1"
                            >Delete</button>
                          </div>
                        )}

                        {/* Quick reaction button */}
                        {!isDeleted && !isEditing && (
                          <div className={`px-2 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isMine ? "text-right" : "text-left"}`}>
                            <button onClick={() => toggleReaction(m.id, "👍")}
                              className="text-xs text-slate-500 hover:text-purple-400 transition-colors bg-transparent border-none cursor-pointer"
                              title="React"
                            >😊</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {typingLabel && (
                  <div className="flex items-center gap-2 px-2 py-1">
                    <div className="flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-xs text-slate-500 italic">{typingLabel}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="shrink-0 px-4 py-3"
                style={{ borderTop: "1px solid rgba(45, 55, 71, 0.3)" }}
              >
                <div className="flex items-end gap-2 rounded-2xl p-2"
                  style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.5)" }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleAttach}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                    style={{ background: "rgba(255,255,255,0.03)", color: "#94a3b8", border: "none" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#c4b5fd"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#94a3b8"; }}
                    title="Attach file"
                  >
                    {uploading ? "⏳" : "📎"}
                  </button>
                  <input
                    value={text}
                    onChange={(e) => handleTextChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-slate-500 px-2 py-1.5"
                    placeholder="Type a message..."
                  />
                  <button onClick={send}
                    className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-all cursor-pointer border-none"
                    style={{
                      background: text.trim() ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "rgba(45, 55, 71, 0.3)",
                      color: text.trim() ? "#fff" : "#64748b",
                    }}
                    onMouseEnter={(e) => { if (text.trim()) { e.currentTarget.style.background = "linear-gradient(135deg, #8b5cf6, #7c3aed)"; } }}
                    onMouseLeave={(e) => { if (text.trim()) { e.currentTarget.style.background = "linear-gradient(135deg, #7c3aed, #6d28d9)"; } }}
                    disabled={!text.trim()}
                  >
                    ➤
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* User search panel — supports multi-select for group creation */}
      {showUserSearch && (
        <div className="absolute top-16 right-4 w-80 z-40 rounded-2xl p-4 animate-slide-up shadow-elevated"
          style={{
            background: "rgba(28, 35, 51, 0.98)",
            border: "1px solid rgba(124, 58, 237, 0.2)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">
              {selectedUsers.length > 0 ? `Create Group (${selectedUsers.length + 1} members)` : "New Conversation"}
            </p>
            <button
              onClick={() => { setShowUserSearch(false); setSelectedUsers([]); setGroupName(""); }}
              className="text-slate-500 hover:text-slate-300 text-lg leading-none bg-transparent border-none cursor-pointer"
            >✕</button>
          </div>

          {/* Selected user chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {selectedUsers.map((u) => (
                <span key={u.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                  style={{ background: "rgba(124, 58, 237, 0.2)", border: "1px solid rgba(124, 58, 237, 0.3)" }}
                >
                  {u.name}
                  <button
                    onClick={() => setSelectedUsers((prev) => prev.filter((s) => s.id !== u.id))}
                    className="ml-0.5 text-slate-400 hover:text-white bg-transparent border-none cursor-pointer text-xs"
                  >✕</button>
                </span>
              ))}
            </div>
          )}

          {/* Group name input (shown when 2+ users selected) */}
          {selectedUsers.length >= 2 && (
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (optional)"
              className="w-full px-3 py-2 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all mb-2"
              style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(124, 58, 237, 0.3)" }}
            />
          )}

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full px-3 py-2 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all mb-2"
            style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.6)" }}
            onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; }}
            autoFocus
          />

          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {searchResults.filter((u) => u.id !== userId).map((u) => {
              const isSelected = selectedUsers.some((s) => s.id === u.id);
              return (
                <div key={u.id}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedUsers((prev) => prev.filter((s) => s.id !== u.id));
                    } else {
                      setSelectedUsers((prev) => [...prev, u]);
                    }
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
                  style={{ background: isSelected ? "rgba(124, 58, 237, 0.12)" : "rgba(255,255,255,0.02)" }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(124, 58, 237, 0.1)"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white shrink-0"
                    style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
                  >{u.name.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-medium truncate">{u.name}</p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                  {isSelected && (
                    <span className="text-purple-400 text-sm">✓</span>
                  )}
                </div>
              );
            })}
          </div>

          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-2">No users found</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(45, 55, 71, 0.3)" }}>
            {selectedUsers.length === 0 ? (
              <p className="text-xs text-slate-500">Select users to start a conversation</p>
            ) : selectedUsers.length === 1 ? (
              <button
                onClick={() => startConversation(selectedUsers)}
                className="flex-1 py-2 rounded-xl text-white font-semibold text-sm transition-all bg-transparent border-none cursor-pointer"
                style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, #8b5cf6, #7c3aed)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, #7c3aed, #6d28d9)"; }}
              >
                Start 1-on-1 Chat
              </button>
            ) : (
              <button
                onClick={() => startConversation(selectedUsers, groupName || undefined)}
                className="flex-1 py-2 rounded-xl text-white font-semibold text-sm transition-all bg-transparent border-none cursor-pointer"
                style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, #8b5cf6, #7c3aed)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, #7c3aed, #6d28d9)"; }}
              >
                Create Group{groupName ? ` "${groupName}"` : ""}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Message search panel */}
      {showSearch && (
        <div className="absolute top-16 right-4 w-80 z-40 rounded-2xl p-4 animate-slide-up shadow-elevated"
          style={{
            background: "rgba(28, 35, 51, 0.98)",
            border: "1px solid rgba(124, 58, 237, 0.2)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          }}
        >
          <p className="text-sm font-semibold text-white mb-3">Search Messages</p>
          <input
            value={msgSearchQuery}
            onChange={(e) => setMsgSearchQuery(e.target.value)}
            placeholder="Search across conversations..."
            className="w-full px-3 py-2 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all mb-2"
            style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.6)" }}
            onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; }}
            autoFocus
          />
          <div className="max-h-60 overflow-y-auto space-y-1">
            {msgSearchResults.map((m) => (
              <div key={m.id} onClick={() => jumpToConversation(m.conversationId ?? "")}
                className="px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
                style={{ background: "rgba(255,255,255,0.02)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(124, 58, 237, 0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
              >
                <p className="text-xs font-medium text-purple-300">{m.sender?.name ?? "Unknown"}</p>
                <p className="text-xs text-slate-400 truncate mt-0.5">{m.content}</p>
              </div>
            ))}
            {msgSearchQuery.length >= 2 && msgSearchResults.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-2">No messages found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
