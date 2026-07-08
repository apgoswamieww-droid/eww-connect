"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { getAuthHeaders } from "../../lib/tokenManager";

type StoredUser = { id: string; name: string; email: string; role: string };
type OrgUser = { id: string; name: string; email: string; role: string; createdAt: string };
type InviteData = {
  id: string;
  email: string;
  status: string;
  isExpired?: boolean;
  expiresAt: string;
  createdAt: string;
  createdBy: { id: string; name: string };
};

function roleBadgeStyle(role: string) {
  switch (role) {
    case "ADMIN": return "bg-violet-900/30 text-violet-300 border border-violet-700/30";
    case "MANAGER": return "bg-pink-900/30 text-pink-300 border border-pink-700/30";
    default: return "bg-slate-800/50 text-slate-300 border border-slate-700/30";
  }
}

export default function UsersPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [invites, setInvites] = useState<InviteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) { try { setUser(JSON.parse(raw)); } catch {} }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) { setLoading(false); return; }

    const headers = getAuthHeaders();
    Promise.all([
      fetch("/api/v1/users", { headers }).then((r) => r.json()),
      fetch("/api/v1/invites", { headers })
        .then((r) => r.json())
        .catch(() => ({ success: false })),
    ])
      .then(([usersData, invitesData]) => {
        if (usersData.success) setUsers(usersData.data);
        else setError(usersData.error);
        if (invitesData.success) setInvites(invitesData.data);
      })
      .catch(() => setError("Failed to load data"))
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

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteSuccess("");
    setInviteLoading(true);

    try {
      const res = await fetch("/api/v1/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();

      if (!data.success) {
        setInviteError(data.error || "Failed to send invite");
      } else {
        setInviteSuccess(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
        setShowInviteForm(false);
        // Refresh invites
        const headers = getAuthHeaders();
        const res2 = await fetch("/api/v1/invites", { headers });
        const j2 = await res2.json();
        if (j2.success) setInvites(j2.data);
      }
    } catch {
      setInviteError("Failed to send invite");
    }
    setInviteLoading(false);
  }

  const isAdmin = user?.role === "ADMIN";

  if (!mounted || loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="space-y-4">
          <div className="h-8 w-24 skeleton" />
          <div className="h-4 w-48 skeleton" />
          <div className="h-64 rounded-2xl skeleton" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Users</h1>
          <p className="text-sm text-slate-400 mt-1">Manage organization members and their roles</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInviteForm(true)}
            className="btn-primary text-sm px-4 py-2 rounded-xl"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, #8b5cf6, #7c3aed)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, #7c3aed, #6d28d9)"; }}
          >
            + Invite User
          </button>
        )}
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
          style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#fca5a5" }}
        >
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowInviteForm(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 animate-scale-in"
            style={{
              background: "rgba(28, 35, 51, 0.95)",
              border: "1px solid rgba(124, 58, 237, 0.2)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
              backdropFilter: "blur(20px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Invite a user</h2>
              <button
                onClick={() => { setShowInviteForm(false); setInviteError(""); setInviteSuccess(""); }}
                className="text-slate-500 hover:text-slate-300 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {inviteSuccess && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
                style={{ background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.2)", color: "#86efac" }}
              >
                <span>✓</span>
                <span>{inviteSuccess}</span>
              </div>
            )}

            {inviteError && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
                style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#fca5a5" }}
              >
                <span>⚠️</span>
                <span>{inviteError}</span>
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  required
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                  style={{
                    background: "rgba(13, 17, 23, 0.6)",
                    border: "1px solid rgba(45, 55, 71, 0.6)",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowInviteForm(false); setInviteError(""); setInviteSuccess(""); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 transition-all"
                  style={{ background: "rgba(45, 55, 71, 0.4)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  }}
                >
                  {inviteLoading ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Table */}
      <div className="rounded-2xl overflow-hidden mb-6"
        style={{
          background: "rgba(28, 35, 51, 0.6)",
          border: "1px solid rgba(45, 55, 71, 0.4)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: "rgba(13, 17, 23, 0.4)" }}>
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Name</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Email</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Role</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}
                  className="transition-colors hover:bg-white/[0.02]"
                  style={{ borderTop: "1px solid rgba(45, 55, 71, 0.2)" }}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
                      >
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-slate-200">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-400">{u.email}</td>
                  <td className="px-5 py-4">
                    <span className={`badge ${roleBadgeStyle(u.role)}`}>{u.role}</span>
                  </td>
                  <td className="px-5 py-4">
                    {isAdmin && u.id !== user?.id && (
                      <select
                        value={u.role}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                        className="text-sm rounded-xl px-3 py-1.5 outline-none transition-all cursor-pointer"
                        style={{
                          background: "rgba(13, 17, 23, 0.6)",
                          border: "1px solid rgba(45, 55, 71, 0.5)",
                          color: "#e2e8f0",
                        }}
                        onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; }}
                        onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.5)"; }}
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGER">Manager</option>
                        <option value="EMPLOYEE">Employee</option>
                      </select>
                    )}
                    {u.id === user?.id && (
                      <span className="text-xs text-slate-500 px-2">You</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">👥</p>
            <p className="text-sm text-slate-500">No users found</p>
          </div>
        )}
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(28, 35, 51, 0.6)",
            border: "1px solid rgba(45, 55, 71, 0.4)",
          }}
        >
          <div className="px-5 py-3.5" style={{ background: "rgba(13, 17, 23, 0.4)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Pending Invitations
            </h3>
          </div>
          <div className="divide-y" style={{ borderTop: "1px solid rgba(45, 55, 71, 0.2)" }}>
            {invites.map((invite) => {
              const isPending = invite.status === "PENDING" && !invite.isExpired;
              return (
                <div key={invite.id} className="px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0"
                      style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
                    >
                      ✉
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{invite.email}</p>
                      <p className="text-xs text-slate-500">
                        Invited by {invite.createdBy.name} ·{" "}
                        {invite.isExpired || invite.status === "EXPIRED" ? (
                          <span className="text-red-400">Expired</span>
                        ) : invite.status === "ACCEPTED" ? (
                          <span className="text-green-400">Accepted</span>
                        ) : (
                          <>
                            Pending · Expires {new Date(invite.expiresAt).toLocaleDateString()}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  {isPending && (
                    <button
                      onClick={async () => {
                        const res = await fetch(`/api/v1/invites/${invite.id}`, {
                          method: "DELETE",
                          headers: getAuthHeaders(),
                        });
                        const j = await res.json();
                        if (j.success) {
                          setInvites((prev) => prev.filter((i) => i.id !== invite.id));
                        }
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all shrink-0"
                      style={{
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                        color: "#fca5a5",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"; }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
