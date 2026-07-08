"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { getAuthHeaders } from "../../lib/tokenManager";

type StoredUser = { id: string; name: string; email: string; role: string };

export default function ProfilePage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        const u = JSON.parse(raw) as StoredUser;
        setUser(u);
        setName(u.name);
      } catch {}
    }
    setMounted(true);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/v1/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ name: name.trim() }),
    });
    const j = await res.json();
    if (j.success) {
      const updated = { ...user!, name: name.trim() };
      localStorage.setItem("user", JSON.stringify(updated));
      setUser(updated);
      setMessage("Profile updated");
    } else {
      setMessage(j.error || "Failed to update");
    }
    setSaving(false);
  }

  if (!mounted) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="space-y-4">
          <div className="h-8 w-24 skeleton" />
          <div className="h-64 rounded-2xl skeleton" />
        </div>
      </main>
    );
  }

  if (!user) return null;

  const roleColors: Record<string, string> = {
    ADMIN: "bg-violet-900/30 text-violet-300 border border-violet-700/30",
    MANAGER: "bg-pink-900/30 text-pink-300 border border-pink-700/30",
    EMPLOYEE: "bg-slate-800/50 text-slate-300 border border-slate-700/30",
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 animate-fade-in">
      {/* Profile header */}
      <div className="mb-8">
        <div className="flex items-center gap-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl text-2xl font-bold text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Profile</h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage your account settings</p>
          </div>
        </div>
      </div>

      {/* Profile card */}
      <div className="rounded-2xl p-8"
        style={{
          background: "rgba(28, 35, 51, 0.6)",
          border: "1px solid rgba(45, 55, 71, 0.4)",
        }}
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
              style={{
                background: "rgba(13, 17, 23, 0.6)",
                border: "1px solid rgba(45, 55, 71, 0.6)",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
              onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input
              value={user.email}
              disabled
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none cursor-not-allowed"
              style={{
                background: "rgba(13, 17, 23, 0.3)",
                border: "1px solid rgba(45, 55, 71, 0.3)",
                color: "#64748b",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Role</label>
            <div className="flex items-center gap-2">
              <span className={`badge ${roleColors[user.role] || roleColors.EMPLOYEE}`}>
                {user.role}
              </span>
            </div>
          </div>

          {message && (
            <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${
              message === "Profile updated"
                ? "bg-emerald-900/20 border border-emerald-700/30 text-emerald-300"
                : "bg-red-900/20 border border-red-700/30 text-red-300"
            }`}>
              <span>{message === "Profile updated" ? "✅" : "⚠️"}</span>
              <span>{message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full py-2.5"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>
    </main>
  );
}
