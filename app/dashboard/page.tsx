"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthHeaders, initializeTokenRefresh } from "../lib/tokenManager";

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
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-slate-300">Loading dashboard...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
        <p className="mt-3 text-slate-300">Please sign in to view your workspace.</p>
        <Link className="mt-6 inline-flex rounded bg-sky-600 px-4 py-2 text-white" href="/login">
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
          <p className="mt-1 text-slate-300">Welcome back, {user.name}.</p>
        </div>
        <Link className="rounded bg-sky-600 px-4 py-2 text-white" href={`/chat?userId=${encodeURIComponent(user.id)}`}>
          Open chat
        </Link>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-slate-700 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold text-white">Notifications</h2>
          {notifications.length === 0 ? (
            <p className="mt-3 text-slate-400">No notifications</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {notifications.map((notification) => (
                <li key={notification.id} className="rounded border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200">
                  <strong>{notification.type}</strong>: {JSON.stringify(notification.payload)}{" "}
                  {notification.isRead ? "(read)" : "(unread)"}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-slate-700 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold text-white">Reminders</h2>
          {reminders.length === 0 ? (
            <p className="mt-3 text-slate-400">No reminders</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {reminders.map((reminder) => (
                <li key={reminder.id} className="rounded border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200">
                  <strong>{reminder.title}</strong>
                  {reminder.message ? ` - ${reminder.message}` : ""} {reminder.isCompleted ? "(done)" : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
