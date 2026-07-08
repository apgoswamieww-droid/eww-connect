"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getAuthHeaders, getToken } from "../../lib/tokenManager";

type StoredUser = { id: string; name: string; email: string };

type NotificationItem = {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) { try { setUser(JSON.parse(raw)); } catch {} }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !user) { setLoading(false); return; }
    fetch("/api/v1/notifications", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => setItems(Array.isArray(j.data) ? j.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mounted, user]);

  useEffect(() => {
    if (!user) return;
    const token = getToken();
    if (!token) return;

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3333", {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socket.on("connect", () => { if (user) socket.emit("join", { userId: user.id }); });
    socket.on("notification:created", (n: NotificationItem) => {
      if (n.userId === user.id) setItems((prev) => [n, ...prev]);
    });
    socket.on("notification:updated", (n: NotificationItem) => {
      if (n.userId === user.id) setItems((prev) => prev.map((it) => (it.id === n.id ? n : it)));
    });
    return () => { if (user) socket.emit("leave", { userId: user.id }); socket.disconnect(); };
  }, [user]);

  async function markRead(id: string) {
    await fetch("/api/v1/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ id }),
    });
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, isRead: true } : it)));
  }

  async function markAllRead() {
    await Promise.all(
      items.filter((n) => !n.isRead).map((n) =>
        fetch("/api/v1/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ id: n.id }),
        }),
      ),
    );
    setItems((prev) => prev.map((it) => ({ ...it, isRead: true })));
  }

  const unreadCount = items.filter((n) => !n.isRead).length;

  if (!mounted || loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="space-y-4">
          <div className="h-8 w-32 skeleton" />
          <div className="h-64 rounded-2xl skeleton" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span>🔔</span> Notifications
            {unreadCount > 0 && (
              <span className="badge text-sm font-bold px-3 py-0.5"
                style={{ background: "linear-gradient(135deg, #ec4899, #be185d)", color: "#fff" }}
              >
                {unreadCount} new
              </span>
            )}
          </h1>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary inline-flex items-center gap-2 px-4 py-2">
            <span>✓</span> Mark all read
          </button>
        )}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="rounded-2xl p-12 text-center"
          style={{
            background: "rgba(28, 35, 51, 0.6)",
            border: "1px solid rgba(45, 55, 71, 0.4)",
          }}
        >
          <p className="text-5xl mb-4">🔔</p>
          <p className="text-slate-400">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl px-5 py-4 flex items-start justify-between gap-4 transition-all duration-200"
              style={{
                background: n.isRead
                  ? "rgba(28, 35, 51, 0.4)"
                  : "rgba(124, 58, 237, 0.05)",
                border: n.isRead
                  ? "1px solid rgba(45, 55, 71, 0.3)"
                  : "1px solid rgba(124, 58, 237, 0.15)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = n.isRead ? "rgba(255,255,255,0.02)" : "rgba(124, 58, 237, 0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = n.isRead ? "rgba(28, 35, 51, 0.4)" : "rgba(124, 58, 237, 0.05)"; }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  {!n.isRead && (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse"
                      style={{ background: "#ec4899" }}
                    />
                  )}
                  <span className={`text-sm font-semibold ${n.isRead ? "text-slate-400" : "text-white"}`}>
                    {n.type}
                  </span>
                  <span className="text-xs text-slate-500 ml-auto">{formatDate(n.createdAt)}</span>
                </div>
                <p className={`text-sm mt-1.5 ml-5 ${n.isRead ? "text-slate-500" : "text-slate-300"}`}>
                  {JSON.stringify(n.payload)}
                </p>
              </div>
              {!n.isRead && (
                <button
                  onClick={() => markRead(n.id)}
                  className="btn-ghost text-xs shrink-0"
                >
                  Dismiss
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
