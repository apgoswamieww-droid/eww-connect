"use client";

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

  if (!mounted) return <div style={{ padding: 24, color: "#94a3b8" }}>Loading...</div>;

  if (!user) return null;

  return (
    <div style={{ maxWidth: 480, padding: "24px 32px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", margin: "0 0 24px" }}>Profile</h1>

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #334155", background: "#1e293b", color: "#f1f5f9", fontSize: 14, outline: "none" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>Email</label>
          <input
            value={user.email}
            disabled
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#64748b", fontSize: 14, outline: "none" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>Role</label>
          <div style={{
            padding: "8px 10px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#94a3b8", fontSize: 14,
            display: "inline-block",
          }}>
            <span style={{
              padding: "2px 8px", borderRadius: 10, fontSize: 12,
              background: user.role === "ADMIN" ? "#1e3a5f" : user.role === "MANAGER" ? "#3b1f6e" : "#1e293b",
              color: user.role === "ADMIN" ? "#93c5fd" : user.role === "MANAGER" ? "#c4b5fd" : "#94a3b8",
            }}>
              {user.role}
            </span>
          </div>
        </div>

        {message && (
          <div style={{ padding: "8px 12px", borderRadius: 6, fontSize: 13, background: message === "Profile updated" ? "#064e3b" : "#7f1d1d", color: message === "Profile updated" ? "#6ee7b7" : "#fca5a5" }}>
            {message}
          </div>
        )}

        <button type="submit" disabled={saving}
          style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
