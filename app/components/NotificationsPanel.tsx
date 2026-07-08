"use client";
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getAuthHeaders, getToken } from "../lib/tokenManager";

type NotificationItem = {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt?: string;
};

export default function NotificationsPanel({ userId }: { userId: string }) {
  const [items, setItems] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!userId) return;
    fetch("/api/v1/notifications", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => setItems(Array.isArray(j.data) ? j.data : []))
      .catch(() => setItems([]));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const token = getToken();
    if (!token) return;

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3333", {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socket.on("connect", () => {
      if (userId) socket.emit("join", { userId });
    });

    socket.on("notification:created", (n: NotificationItem) => {
      if (n.userId === userId) {
        setItems((prev) => [n, ...prev]);
      }
    });

    socket.on("notification:updated", (n: NotificationItem) => {
      if (n.userId === userId) {
        setItems((prev) => prev.map((it) => (it.id === n.id ? n : it)));
      }
    });

    return () => { if (userId) socket.emit("leave", { userId }); socket.disconnect(); };
  }, [userId]);

  async function markRead(id: string) {
    await fetch(`/api/v1/notifications`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ id }),
    });
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, isRead: true } : it)));
  }

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <div className="rounded-2xl"
      style={{
        background: "rgba(28, 35, 51, 0.6)",
        border: "1px solid rgba(45, 55, 71, 0.4)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(45, 55, 71, 0.3)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🔔</span>
          <h4 className="text-sm font-semibold text-white m-0">Notifications</h4>
          {unreadCount > 0 && (
            <span className="badge text-xs font-bold px-2 py-0"
              style={{ background: "linear-gradient(135deg, #ec4899, #be185d)", color: "#fff", fontSize: 10 }}
            >
              {unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-2xl mb-2">🔕</p>
          <p className="text-xs text-slate-500">No notifications</p>
        </div>
      ) : (
        <div className="divide-y max-h-80 overflow-y-auto"
          style={{ borderColor: "rgba(45, 55, 71, 0.2)" }}
        >
          {items.slice(0, 10).map((n) => (
            <div key={n.id}
              className="px-4 py-3 flex items-start justify-between gap-3 transition-colors"
              style={{
                background: n.isRead ? "transparent" : "rgba(124, 58, 237, 0.04)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(124, 58, 237, 0.08)"; }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = n.isRead ? "transparent" : "rgba(124, 58, 237, 0.04)";
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#ec4899" }} />
                  )}
                  <span className={`text-xs font-semibold ${n.isRead ? "text-slate-400" : "text-slate-200"}`}>
                    {n.type}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 truncate">
                  {JSON.stringify(n.payload)}
                </p>
              </div>
              {!n.isRead && (
                <button
                  onClick={() => markRead(n.id)}
                  className="text-xs px-2 py-1 rounded-lg font-medium transition-all shrink-0 bg-transparent border-none cursor-pointer"
                  style={{
                    background: "rgba(124, 58, 237, 0.1)",
                    color: "#a78bfa",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(124, 58, 237, 0.2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(124, 58, 237, 0.1)"; }}
                >
                  Dismiss
                </button>
              )}
            </div>
          ))}
          {items.length > 10 && (
            <div className="px-4 py-2 text-center">
              <span className="text-xs text-slate-500">+{items.length - 10} more</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
