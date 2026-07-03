"use client";

import { useEffect, useState } from "react";
import { getAuthHeaders } from "../../lib/tokenManager";

type StoredUser = { id: string; name: string; email: string; role: string };
type OrgUser = { id: string; name: string; email: string; role: string; createdAt: string };

export default function UsersPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) { try { setUser(JSON.parse(raw)); } catch {} }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) { setLoading(false); return; }
    fetch("/api/v1/users", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => { if (j.success) setUsers(j.data); else setError(j.error); })
      .catch(() => setError("Failed to load users"))
      .finally(() => setLoading(false));
  }, [mounted, user]);

  async function updateRole(userId: string, role: string) {
    const res = await fetch(`/api/v1/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ role }),
    });
    const j = await res.json();
    if (j.success) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    }
  }

  if (!mounted || loading) return <div style={{ padding: 24, color: "#94a3b8" }}>Loading users...</div>;


  return (
    <div style={{ padding: "24px 32px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", margin: "0 0 4px" }}>Users</h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>Manage organization members and their roles</p>

      {error && <div style={{ padding: "8px 12px", background: "#7f1d1d", color: "#fca5a5", borderRadius: 6, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div style={{ border: "1px solid #1e293b", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#0f172a" }}>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid #1e293b" }}>
                <td style={tdStyle}>{u.name}</td>
                <td style={{ ...tdStyle, color: "#94a3b8" }}>{u.email}</td>
                <td style={tdStyle}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 10, fontSize: 12,
                    background: u.role === "ADMIN" ? "#1e3a5f" : u.role === "MANAGER" ? "#3b1f6e" : "#1e293b",
                    color: u.role === "ADMIN" ? "#93c5fd" : u.role === "MANAGER" ? "#c4b5fd" : "#94a3b8",
                  }}>
                    {u.role}
                  </span>
                </td>
                <td style={tdStyle}>
                  {user.role === "ADMIN" && u.id !== user.id && (
                    <select
                      value={u.role}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #334155", background: "#1e293b", color: "#f1f5f9", fontSize: 12, outline: "none", cursor: "pointer" }}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER">Manager</option>
                      <option value="EMPLOYEE">Employee</option>
                    </select>
                  )}
                  {u.id === user.id && <span style={{ fontSize: 12, color: "#64748b" }}>You</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#94a3b8", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.05em" };
const tdStyle: React.CSSProperties = { padding: "10px 14px", fontSize: 13, color: "#e2e8f0" };
