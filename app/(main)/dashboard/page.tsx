"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthHeaders, initializeTokenRefresh } from "../../lib/tokenManager";

type StoredUser = {
  id: string;
  name: string;
  email: string;
};

type NotificationItem = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  isRead: boolean;
};

type ReminderItem = {
  id: string;
  title: string;
  message?: string | null;
  isCompleted: boolean;
};

const QUICK_ACTIONS = [
  { label: "New Chat", href: "/chat", icon: "💬", color: "from-purple-500 to-pink-500" },
  { label: "Schedule Meeting", href: "/meetings", icon: "📅", color: "from-cyan-500 to-blue-500" },
  { label: "Upload File", href: "/files", icon: "📁", color: "from-emerald-500 to-teal-500" },
  { label: "Create Reminder", href: "/reminders", icon: "✅", color: "from-amber-500 to-orange-500" },
];

function readStoredUser(): StoredUser | null {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(readStoredUser());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    initializeTokenRefresh();

    if (!user) {
      setLoading(false);
      return;
    }

    const headers = getAuthHeaders();
    Promise.all([
      fetch("/api/v1/notifications", { headers, cache: "no-store" }),
      fetch("/api/v1/reminders", { headers, cache: "no-store" }),
    ])
      .then(async ([nRes, rRes]) => {
        const nJson = await nRes.json().catch(() => ({ data: [] }));
        const rJson = await rRes.json().catch(() => ({ data: [] }));
        setNotifications(Array.isArray(nJson.data) ? nJson.data : []);
        setReminders(Array.isArray(rJson.data) ? rJson.data : []);
      })
      .finally(() => setLoading(false));
  }, [mounted, user]);

  if (!mounted || loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="space-y-6">
          <div className="h-8 w-48 skeleton" />
          <div className="h-4 w-72 skeleton" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1,2,3,4].map((i) => <div key={i} className="h-28 rounded-2xl skeleton" />)}
          </div>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const unreadNotifs = notifications.filter((n) => !n.isRead).length;
  const activeReminders = reminders.filter((r) => !r.isCompleted).length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-slate-400">Welcome back, <span className="text-slate-200 font-medium">{user.name}</span></p>
        </div>
        <Link
          href="/chat"
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5"
        >
          <span>💬</span>
          <span>Open Chat</span>
        </Link>
      </div>

      {/* Quick action cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 group"
            style={{
              background: "rgba(28, 35, 51, 0.6)",
              border: "1px solid rgba(45, 55, 71, 0.4)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(124, 58, 237, 0.3)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(124, 58, 237, 0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(45, 55, 71, 0.4)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl"
                style={{ background: `linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(236, 72, 153, 0.1))` }}
              >
                <span className="text-lg">{action.icon}</span>
              </div>
              <span className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{action.label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <div className="rounded-2xl p-5"
          style={{
            background: "linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(124, 58, 237, 0.02))",
            border: "1px solid rgba(124, 58, 237, 0.15)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#a78bfa" }}>Notifications</p>
              <p className="text-2xl font-bold text-white mt-1">{unreadNotifs}</p>
            </div>
            <span className="text-3xl opacity-50">🔔</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">{notifications.length} total</p>
        </div>

        <div className="rounded-2xl p-5"
          style={{
            background: "linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(236, 72, 153, 0.02))",
            border: "1px solid rgba(236, 72, 153, 0.15)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#f9a8d4" }}>Reminders</p>
              <p className="text-2xl font-bold text-white mt-1">{activeReminders}</p>
            </div>
            <span className="text-3xl opacity-50">✅</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">{reminders.length} total</p>
        </div>

        <div className="rounded-2xl p-5"
          style={{
            background: "linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(6, 182, 212, 0.02))",
            border: "1px solid rgba(6, 182, 212, 0.15)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#67e8f9" }}>Status</p>
              <p className="text-2xl font-bold text-white mt-1">Online</p>
            </div>
            <span className="text-3xl opacity-50">🟢</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Connected</p>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Notifications section */}
        <div className="rounded-2xl p-6"
          style={{
            background: "rgba(28, 35, 51, 0.6)",
            border: "1px solid rgba(45, 55, 71, 0.4)",
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>🔔</span> Recent Notifications
            </h2>
            <Link href="/notifications" className="text-xs font-medium transition-colors"
              style={{ color: "#a78bfa" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#c4b5fd"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#a78bfa"}
            >
              View all →
            </Link>
          </div>
          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">🔕</p>
              <p className="text-sm text-slate-500">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 5).map((notification) => (
                <div key={notification.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                  style={{
                    background: notification.isRead ? "transparent" : "rgba(124, 58, 237, 0.05)",
                  }}
                >
                  {!notification.isRead && (
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#7c3aed" }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 truncate">
                      <span className="font-medium">{notification.type}</span>
                    </p>
                    <p className="text-xs text-slate-500 truncate">{JSON.stringify(notification.payload)}</p>
                  </div>
                  {notification.isRead && (
                    <span className="text-xs text-slate-600">read</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reminders section */}
        <div className="rounded-2xl p-6"
          style={{
            background: "rgba(28, 35, 51, 0.6)",
            border: "1px solid rgba(45, 55, 71, 0.4)",
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>✅</span> Active Reminders
            </h2>
            <Link href="/reminders" className="text-xs font-medium transition-colors"
              style={{ color: "#a78bfa" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#c4b5fd"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#a78bfa"}
            >
              View all →
            </Link>
          </div>
          {reminders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">📝</p>
              <p className="text-sm text-slate-500">No reminders yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.filter((r) => !r.isCompleted).slice(0, 5).map((reminder) => (
                <div key={reminder.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <span className="text-sm">📌</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 truncate font-medium">{reminder.title}</p>
                    {reminder.message && (
                      <p className="text-xs text-slate-500 truncate">{reminder.message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
