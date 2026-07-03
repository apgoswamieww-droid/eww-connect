"use client";
import React, { useEffect, useState, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { getAuthHeaders, getToken, scheduleTokenRefresh } from "../lib/tokenManager";

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

type Message = {
  id: string;
  conversationId?: string | null;
  sender?: UserSummary;
  content: string;
};

export default function ChatClient({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "disconnected">(() =>
    getToken() ? "connecting" : "disconnected",
  );
  const socketRef = useRef<Socket | null>(null);
  const currentConvRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetch("/api/v1/chat/conversations", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => setConversations(Array.isArray(j.data) ? j.data : []))
      .catch(() => setConversations([]));
  }, [userId]);

  useEffect(() => {
    // Initialize token refresh on component mount
    scheduleTokenRefresh();
  }, []);

  useEffect(() => {
    const token = getToken();
    
    if (!token) {
      console.error("No authentication token found");
      return;
    }

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000", {
      auth: {
        token,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected");
      setSocketStatus("connected");
      if (userId) {
        socket.emit("join", { userId });
        // Rejoin conversation if one was active
        if (currentConvRef.current) {
          socket.emit("joinConversation", { conversationId: currentConvRef.current });
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setSocketStatus("disconnected");
    });

    socket.on("connect_error", (error: Error) => {
      console.error(`Socket connection error: ${error.message} (trying ${process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000"})`);
      setSocketStatus("disconnected");
    });

    socket.on("error", (error: string) => {
      console.error("Socket error:", error);
    });

    socket.on("chat:message", (msg: Message) => {
      // if the message belongs to the active conversation, append it
      if (currentConvRef.current && msg.conversationId === currentConvRef.current) {
        setMessages((prev) => [...prev, msg]);
      } else {
        // otherwise refresh conversations list to reflect latest preview
        fetch("/api/v1/chat/conversations", { headers: getAuthHeaders() })
          .then((r) => r.json())
          .then((j) => setConversations(Array.isArray(j.data) ? j.data : []))
          .catch(() => {});
      }
    });

    return () => {
      if (userId && socketRef.current) socketRef.current.emit("leave", { userId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]);

  // join/leave conversation room when activeConv changes
  useEffect(() => {
    const socket = socketRef.current;
    const prev = currentConvRef.current;
    if (prev && socket) {
      socket.emit("leaveConversation", { conversationId: prev });
      currentConvRef.current = null;
    }
    if (activeConv?.id && socket) {
      socket.emit("joinConversation", { conversationId: activeConv.id });
      currentConvRef.current = activeConv.id;
    }

    return () => {
      // cleanup handled when socket disconnects
    };
  }, [activeConv?.id]);

  useEffect(() => {
    if (!activeConv) return;
    fetch(`/api/v1/chat/messages?conversationId=${encodeURIComponent(activeConv.id)}`, { headers: getAuthHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load messages");
        return r;
      })
      .then((r) => r.json())
      .then((j) => setMessages(Array.isArray(j.data) ? j.data : []))
      .catch(() => setMessages([]));
  }, [activeConv]);

  async function send() {
    if (!activeConv || !text.trim()) return;
    const body = { conversationId: activeConv.id, content: text.trim() };
    const res = await fetch(`/api/v1/chat/messages`, {
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ padding: 8, background: socketStatus === "connected" ? "#d1fae5" : socketStatus === "connecting" ? "#fef3c7" : "#fee2e2", borderRadius: 4 }}>
        <span style={{ fontSize: 12, fontWeight: "bold" }}>
          Socket: {socketStatus === "connected" ? "✓ Connected" : socketStatus === "connecting" ? "⟳ Connecting..." : "✗ Disconnected"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <aside style={{ width: 280, borderRight: "1px solid #ddd", paddingRight: 12 }}>
          <h3>Conversations</h3>
          <ul>
            {conversations.map((c) => (
              <li key={c.id} style={{ cursor: "pointer", padding: 6, background: activeConv?.id === c.id ? "#f3f4f6" : "transparent" }} onClick={() => setActiveConv(c)}>
                <strong>{c.name ?? (c.isGroup ? "Group" : c.members?.find((m) => m.user?.id !== userId)?.user?.name ?? "Conversation")}</strong>
                <div style={{ fontSize: 12, color: "#666" }}>{c.messages?.[0]?.content ?? ""}</div>
              </li>
            ))}
          </ul>
        </aside>

        <div style={{ flex: 1 }}>
          <h3>Messages</h3>
          {!activeConv ? (
            <p>Select a conversation</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ maxHeight: 400, overflow: "auto", padding: 8, border: "1px solid #eee" }}>
                {messages.map((m) => (
                  <div key={m.id} style={{ marginBottom: 8 }}>
                    <strong>{m.sender?.name}</strong>: {m.content}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <input value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} placeholder="Type a message" />
                <button onClick={send}>Send</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
