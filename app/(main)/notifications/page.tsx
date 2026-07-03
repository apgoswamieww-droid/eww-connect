"use client";

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

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000", {
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
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-slate-300">Loading notifications...</p>
      </main>
    );
  }



  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Notifications</h1>
          {unreadCount > 0 && <p className="text-sm text-slate-400 mt-1">{unreadCount} unread</p>}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="rounded bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600">
            Mark all read
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900 p-8 text-center">
          <p className="text-4xl mb-3">🔔</p>
          <p className="text-slate-400">No notifications yet</p>
        </div>
      ) : (
        <div className="mt-6 space-y-1">
          {items.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border px-4 py-3 flex items-start justify-between gap-4 ${
                n.isRead
                  ? "border-slate-800 bg-slate-900/50"
                  : "border-sky-800 bg-slate-900"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />}
                  <span className={`text-sm font-medium ${n.isRead ? "text-slate-300" : "text-white"}`}>
                    {n.type}
                  </span>
                  <span className="text-xs text-slate-500 ml-auto">{formatDate(n.createdAt)}</span>
                </div>
                <p className={`text-sm mt-1 ${n.isRead ? "text-slate-400" : "text-slate-300"}`}>
                  {JSON.stringify(n.payload)}
                </p>
              </div>
              {!n.isRead && (
                <button
                  onClick={() => markRead(n.id)}
                  className="shrink-0 text-xs rounded bg-slate-700 px-2.5 py-1 text-slate-200 hover:bg-slate-600"
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
