"use client";
/* eslint-disable react-hooks/set-state-in-effect */

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

  async function handleComplete(id: string) {
    const res = await fetch(`/api/v1/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ isCompleted: true }),
    });
    const j = await res.json();
    if (j.success) setItems((prev) => prev.map((r) => (r.id === id ? j.data : r)));
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
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="space-y-4">
          <div className="h-8 w-28 skeleton" />
          <div className="h-64 rounded-2xl skeleton" />
        </div>
      </main>
    );
  }

  const active = items.filter((r) => !r.isCompleted);
  const completed = items.filter((r) => r.isCompleted);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span>✅</span> Reminders
            {active.length > 0 && (
              <span className="badge badge-purple text-sm">{active.length} active</span>
            )}
          </h1>
        </div>
        <button onClick={() => { resetForm(); setShowCreate(true); }}
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5">
          <span>➕</span> New reminder
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl p-12 text-center"
          style={{
            background: "rgba(28, 35, 51, 0.6)",
            border: "1px solid rgba(45, 55, 71, 0.4)",
          }}
        >
          <p className="text-5xl mb-4">📝</p>
          <p className="text-slate-400 mb-2">No reminders yet</p>
          <button onClick={() => { resetForm(); setShowCreate(true); }} className="btn-primary mt-2">
            Create your first reminder
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active */}
          {active.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4">Active</h2>
              <div className="space-y-2">
                {active.map((r) => (
                  <div key={r.id} className="rounded-2xl p-5 transition-all duration-200"
                    style={{
                      background: "rgba(28, 35, 51, 0.6)",
                      border: isOverdue(r.dueAt)
                        ? "1px solid rgba(239, 68, 68, 0.2)"
                        : "1px solid rgba(45, 55, 71, 0.4)",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = isOverdue(r.dueAt) ? "rgba(239, 68, 68, 0.3)" : "rgba(124, 58, 237, 0.3)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = isOverdue(r.dueAt) ? "rgba(239, 68, 68, 0.2)" : "rgba(45, 55, 71, 0.4)"; }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 flex items-start gap-3">
                        <button
                          onClick={() => handleComplete(r.id)}
                          className="mt-0.5 w-5 h-5 rounded-lg border-2 shrink-0 flex items-center justify-center transition-all hover:border-purple-400"
                          style={{ borderColor: isOverdue(r.dueAt) ? "rgba(239, 68, 68, 0.5)" : "rgba(45, 55, 71, 0.6)" }}
                        >
                          <span className="opacity-0 group-hover:opacity-100">✓</span>
                        </button>
                        <div>
                          <p className="text-sm font-semibold text-white">{r.title}</p>
                          {r.message && <p className="text-sm text-slate-400 mt-0.5">{r.message}</p>}
                          <p className={`text-xs mt-1.5 flex items-center gap-1 ${
                            isOverdue(r.dueAt) ? "text-red-400" : "text-slate-500"
                          }`}>
                            {isOverdue(r.dueAt) ? "⚠️" : "📌"} {formatDate(r.dueAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => startEdit(r)} className="btn-ghost text-xs px-2.5 py-1.5">Edit</button>
                        <button onClick={() => handleDelete(r.id)} className="btn-ghost text-xs px-2.5 py-1.5 hover:!text-red-400">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <span>✔</span> Completed
                <span className="badge text-xs" style={{ background: "rgba(45, 55, 71, 0.5)", color: "#64748b" }}>{completed.length}</span>
              </h2>
              <div className="space-y-1.5 opacity-60">
                {completed.map((r) => (
                  <div key={r.id} className="rounded-xl px-5 py-3"
                    style={{
                      background: "rgba(28, 35, 51, 0.3)",
                      border: "1px solid rgba(45, 55, 71, 0.2)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-lg flex items-center justify-center text-xs"
                        style={{ background: "rgba(16, 185, 129, 0.15)", color: "#6ee7b7" }}
                      >✓</span>
                      <span className="text-sm text-slate-500 line-through flex-1">{r.title}</span>
                      <button onClick={() => handleDelete(r.id)}
                        className="btn-ghost text-xs hover:!text-red-400"
                      >Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create/Edit modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.7)" }}
        >
          <div className="w-full max-w-md rounded-2xl p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(28, 35, 51, 0.98)",
              border: "1px solid rgba(124, 58, 237, 0.2)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">{editId ? "Edit" : "New"} Reminder</h3>
              <button onClick={resetForm}
                className="flex items-center justify-center w-8 h-8 rounded-xl transition-colors hover:bg-white/5 text-slate-400 hover:text-white"
              >✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Title</label>
                <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                  placeholder="Review pull request"
                  style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.6)" }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Message</label>
                <textarea value={formMessage} onChange={(e) => setFormMessage(e.target.value)} rows={2}
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                  placeholder="Optional details"
                  style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.6)" }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Due date</label>
                <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none transition-all"
                  style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.6)", colorScheme: "dark" }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={resetForm} className="btn-secondary px-5 py-2.5">Cancel</button>
                <button type="submit" className="btn-primary px-5 py-2.5">
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
