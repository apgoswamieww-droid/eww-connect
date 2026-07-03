"use client";

import { useEffect, useState } from "react";
import { getAuthHeaders } from "../../lib/tokenManager";

type StoredUser = { id: string; name: string; email: string };

type ReminderItem = {
  id: string;
  title: string;
  message: string | null;
  dueAt: string | null;
  isCompleted: boolean;
  createdAt: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "No due date";
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / 86400000);
  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (diff < 0) return `${label} (overdue)`;
  if (days === 0) return `${label} (today)`;
  if (days === 1) return `${label} (tomorrow)`;
  return label;
}

function isOverdue(iso: string | null): boolean {
  return !!iso && new Date(iso) < new Date();
}

export default function RemindersPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [items, setItems] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formDate, setFormDate] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) { try { setUser(JSON.parse(raw)); } catch {} }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !user) { setLoading(false); return; }
    fetch("/api/v1/reminders", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => setItems(Array.isArray(j.data) ? j.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mounted, user]);

  function resetForm() {
    setFormTitle(""); setFormMessage(""); setFormDate(""); setEditId(null); setShowCreate(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) return;
    const body: Record<string, string | undefined> = { title: formTitle.trim() };
    if (formMessage.trim()) body.message = formMessage.trim();
    if (formDate) body.dueAt = new Date(`${formDate}T12:00:00`).toISOString();

    try {
      if (editId) {
        const res = await fetch(`/api/v1/reminders/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(body),
        });
        const j = await res.json();
        if (j.success) setItems((prev) => prev.map((r) => (r.id === editId ? j.data : r)));
      } else {
        const res = await fetch("/api/v1/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(body),
        });
        const j = await res.json();
        if (j.success) setItems((prev) => [j.data, ...prev]);
      }
      resetForm();
    } catch {}
  }

  async function toggleComplete(item: ReminderItem) {
    if (!item.isCompleted) {
      const res = await fetch(`/api/v1/reminders/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ title: item.title }),
      });
      const j = await res.json();
      if (j.success) {
        // The PATCH currently doesn't support isCompleted, use the route's PATCH handler
        // Actually the PATCH only updates title/message/dueAt. Let me use a different approach.
      }
    }
    // Use the existing PATCH on /api/v1/reminders for completion
    const res = await fetch("/api/v1/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ id: item.id }),
    });
    const j = await res.json();
    if (j.success) setItems((prev) => prev.map((r) => (r.id === item.id ? j.data : r)));
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/v1/reminders/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    const j = await res.json();
    if (j.success) setItems((prev) => prev.filter((r) => r.id !== id));
  }

  function startEdit(item: ReminderItem) {
    setEditId(item.id);
    setFormTitle(item.title);
    setFormMessage(item.message ?? "");
    setFormDate(item.dueAt ? item.dueAt.slice(0, 10) : "");
    setShowCreate(true);
  }

  if (!mounted || loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-slate-300">Loading reminders...</p>
      </main>
    );
  }



  const active = items.filter((r) => !r.isCompleted);
  const completed = items.filter((r) => r.isCompleted);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-white">Reminders</h1>
        <button onClick={() => { resetForm(); setShowCreate(true); }}
          className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">
          + New reminder
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900 p-8 text-center">
          <p className="text-4xl mb-3">📝</p>
          <p className="text-slate-400 mb-4">No reminders yet</p>
          <button onClick={() => { resetForm(); setShowCreate(true); }}
            className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">
            Create your first reminder
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {active.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-slate-200 mb-3">Active ({active.length})</h2>
              <div className="space-y-2">
                {active.map((r) => (
                  <div key={r.id} className={`rounded-lg border px-4 py-3 ${
                    isOverdue(r.dueAt) ? "border-red-800 bg-red-900/20" : "border-slate-700 bg-slate-900"
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleComplete(r)}
                            className="w-4 h-4 rounded border-2 border-slate-500 hover:border-sky-400 shrink-0 mt-0.5" />
                          <span className="text-sm font-medium text-white">{r.title}</span>
                        </div>
                        {r.message && <p className="text-sm text-slate-400 mt-1 ml-6">{r.message}</p>}
                        <p className={`text-xs mt-1 ml-6 ${isOverdue(r.dueAt) ? "text-red-400" : "text-slate-500"}`}>
                          {formatDate(r.dueAt)}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => startEdit(r)}
                          className="text-xs rounded bg-slate-700 px-2 py-1 text-slate-200 hover:bg-slate-600">Edit</button>
                        <button onClick={() => handleDelete(r.id)}
                          className="text-xs rounded bg-red-800 px-2 py-1 text-red-200 hover:bg-red-700">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-slate-200 mb-3">Completed ({completed.length})</h2>
              <div className="space-y-1 opacity-60">
                {completed.map((r) => (
                  <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded border-2 border-slate-600 bg-slate-600 shrink-0 mt-0.5 flex items-center justify-center text-xs text-white">✓</span>
                      <span className="text-sm text-slate-400 line-through">{r.title}</span>
                      <button onClick={() => handleDelete(r.id)}
                        className="ml-auto text-xs text-slate-500 hover:text-red-400">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{editId ? "Edit" : "New"} Reminder</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Title</label>
                <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Review pull request" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Message</label>
                <textarea value={formMessage} onChange={(e) => setFormMessage(e.target.value)} rows={2}
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Optional details" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Due date</label>
                <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={resetForm}
                  className="rounded bg-slate-700 px-4 py-2 text-white hover:bg-slate-600">Cancel</button>
                <button type="submit"
                  className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">
                  {editId ? "Save" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
