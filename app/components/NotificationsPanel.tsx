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

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000", {
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

  return (
    <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 6 }}>
      <h4>Notifications</h4>
      {items.length === 0 ? (
        <p>No notifications</p>
      ) : (
        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
          {items.map((n) => (
            <li key={n.id} style={{ display: "flex", justifyContent: "space-between", padding: 6, background: n.isRead ? "#fafafa" : "#fff" }}>
              <div>
                <strong>{n.type}</strong> — {JSON.stringify(n.payload)} {n.isRead ? "(read)" : ""}
              </div>
              {!n.isRead && <button onClick={() => markRead(n.id)}>Mark read</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
