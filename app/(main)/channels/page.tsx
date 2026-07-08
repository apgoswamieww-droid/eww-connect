"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { getAuthHeaders } from "../../lib/tokenManager";

type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Channel = {
  id: string;
  teamId: string;
  name: string;
  type: "PUBLIC" | "PRIVATE";
  createdAt: string;
};

type Team = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  channels: Channel[];
};

type ChannelMember = {
  id: string;
  userId: string;
  role: "MEMBER" | "OWNER";
  user: { id: string; name: string; email: string };
};

type PinnedMessage = {
  id: string;
  channelId: string;
  messageId: string;
  pinnedAt: string;
  message: {
    id: string;
    content: string;
    createdAt: string;
    sender: { id: string; name: string };
    reactions: { id: string; userId: string; emoji: string; user: { id: string; name: string } }[];
  };
};

export default function ChannelsPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [pinInput, setPinInput] = useState("");
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinError, setPinError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {}
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) { setLoading(false); return; }
    fetch("/api/v1/channels/teams", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setTeams(j.data);
          if (j.data.length > 0) setSelectedTeamId(j.data[0].id);
        }
      })
      .catch(() => setError("Failed to load teams"))
      .finally(() => setLoading(false));
  }, [mounted, user]);

  useEffect(() => {
    if (!selectedChannel) { setChannelMembers([]); setPinnedMessages([]); return; }
    fetch(`/api/v1/channels/members?channelId=${selectedChannel.id}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => { if (j.success) setChannelMembers(j.data); })
      .catch(() => {});
    fetch(`/api/v1/channels/pinned?channelId=${selectedChannel.id}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => { if (j.success) setPinnedMessages(j.data); })
      .catch(() => {});
  }, [selectedChannel]);

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      const res = await fetch("/api/v1/channels/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name: newTeamName.trim(), description: newTeamDesc.trim() || undefined }),
      });
      const j = await res.json();
      if (j.success) {
        setTeams((prev) => [...prev, j.data]);
        setShowCreateTeam(false);
        setNewTeamName("");
        setNewTeamDesc("");
      }
    } catch {}
  }

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!newChannelName.trim() || !selectedTeamId) return;
    try {
      const res = await fetch("/api/v1/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ teamId: selectedTeamId, name: newChannelName.trim(), type: newChannelType }),
      });
      const j = await res.json();
      if (j.success) {
        setTeams((prev) =>
          prev.map((t) =>
            t.id === selectedTeamId ? { ...t, channels: [...(t.channels ?? []), j.data] } : t,
          ),
        );
        setShowCreateChannel(false);
        setNewChannelName("");
      }
    } catch {}
  }

  async function handlePinMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedChannel || !pinInput.trim()) return;
    setPinError("");
    try {
      const res = await fetch("/api/v1/channels/pinned", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ channelId: selectedChannel.id, messageId: pinInput.trim() }),
      });
      const j = await res.json();
      if (j.success) {
        setPinnedMessages((prev) => [j.data, ...prev]);
        setShowPinInput(false);
        setPinInput("");
      } else {
        setPinError(j.error || "Failed to pin message");
      }
    } catch {}
  }

  async function handleUnpin(messageId: string) {
    if (!selectedChannel) return;
    await fetch(`/api/v1/channels/pinned?channelId=${selectedChannel.id}&messageId=${messageId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    setPinnedMessages((prev) => prev.filter((p) => p.messageId !== messageId));
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  if (!mounted || loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="space-y-4">
          <div className="h-8 w-28 skeleton" />
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="h-64 rounded-2xl skeleton" />
            <div className="h-64 rounded-2xl skeleton" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 animate-fade-in">
      <h1 className="text-3xl font-bold text-white mb-6">Channels</h1>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
          style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#fca5a5" }}
        >
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {teams.length === 0 && !error ? (
        <div className="rounded-2xl p-12 text-center"
          style={{
            background: "rgba(28, 35, 51, 0.6)",
            border: "1px solid rgba(45, 55, 71, 0.4)",
          }}
        >
          <p className="text-4xl mb-4">🏗️</p>
          <p className="text-slate-400 mb-4">No teams yet. Create your first team to get started.</p>
          <button onClick={() => setShowCreateTeam(true)} className="btn-primary">
            Create Team
          </button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <div className="rounded-2xl p-4"
            style={{
              background: "rgba(28, 35, 51, 0.6)",
              border: "1px solid rgba(45, 55, 71, 0.4)",
            }}
          >
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-base font-semibold text-white">Teams</h2>
              <button onClick={() => setShowCreateTeam(true)}
                className="flex items-center justify-center w-7 h-7 rounded-lg text-sm transition-colors"
                style={{ background: "rgba(124, 58, 237, 0.15)", color: "#a78bfa" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(124, 58, 237, 0.25)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(124, 58, 237, 0.15)"; }}
              >+</button>
            </div>

            <div className="space-y-1">
              {teams.map((team) => (
                <div key={team.id}>
                  <button
                    onClick={() => { setSelectedTeamId(team.id); setSelectedChannel(null); }}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                    style={{
                      background: selectedTeamId === team.id
                        ? "linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(124, 58, 237, 0.05))"
                        : "transparent",
                      color: selectedTeamId === team.id ? "#c4b5fd" : "#94a3b8",
                      border: selectedTeamId === team.id ? "1px solid rgba(124, 58, 237, 0.2)" : "1px solid transparent",
                    }}
                    onMouseEnter={(e) => { if (selectedTeamId !== team.id) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#e2e8f0"; } }}
                    onMouseLeave={(e) => { if (selectedTeamId !== team.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; } }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span style={{ fontSize: 16 }}>{selectedTeamId === team.id ? "📂" : "📁"}</span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate">{team.name}</span>
                        {team.description && (
                          <span className="block text-xs opacity-60 truncate mt-0.5">{team.description}</span>
                        )}
                      </div>
                    </div>
                  </button>

                  {selectedTeamId === team.id && (
                    <div className="ml-4 mt-1 space-y-0.5 pl-2"
                      style={{ borderLeft: "1px solid rgba(124, 58, 237, 0.15)" }}
                    >
                      {(team.channels ?? []).map((ch) => (
                        <button
                          key={ch.id}
                          onClick={() => setSelectedChannel(ch)}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
                          style={{
                            background: selectedChannel?.id === ch.id ? "rgba(124, 58, 237, 0.1)" : "transparent",
                            color: selectedChannel?.id === ch.id ? "#e2e8f0" : "#64748b",
                          }}
                          onMouseEnter={(e) => { if (selectedChannel?.id !== ch.id) { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.color = "#94a3b8"; } }}
                          onMouseLeave={(e) => { if (selectedChannel?.id !== ch.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; } }}
                        >
                          <span className="mr-1.5">{ch.type === "PRIVATE" ? "🔒" : "#"}</span>
                          {ch.name}
                        </button>
                      ))}
                      <button
                        onClick={() => { setSelectedTeamId(team.id); setShowCreateChannel(true); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        + Add channel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            {selectedChannel ? (
              <div className="rounded-2xl p-6 animate-slide-up"
                style={{
                  background: "rgba(28, 35, 51, 0.6)",
                  border: "1px solid rgba(45, 55, 71, 0.4)",
                }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl text-lg"
                    style={{ background: "linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(236, 72, 153, 0.1))" }}
                  >
                    {selectedChannel.type === "PRIVATE" ? "🔒" : "#"}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">{selectedChannel.name}</h2>
                    <p className={`text-xs badge mt-0.5 ${selectedChannel.type === "PRIVATE" ? "badge-purple" : "badge-green"}`}>
                      {selectedChannel.type === "PRIVATE" ? "Private" : "Public"} channel
                    </p>
                  </div>
                </div>

                {/* Pinned Messages */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <span>📌</span> Pinned Messages ({pinnedMessages.length})
                    </h3>
                    <button
                      onClick={() => { setShowPinInput(!showPinInput); setPinError(""); setPinInput(""); }}
                      className="btn-ghost text-xs px-2.5 py-1"
                    >
                      {showPinInput ? "Cancel" : "+ Pin"}
                    </button>
                  </div>

                  {showPinInput && (
                    <form onSubmit={handlePinMessage} className="mb-3 flex gap-2">
                      <input
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        placeholder="Enter message ID to pin..."
                        className="flex-1 px-3 py-1.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                        style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.6)" }}
                        onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; }}
                        onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; }}
                      />
                      <button type="submit" className="btn-primary text-xs px-3 py-1.5">Pin</button>
                    </form>
                  )}

                  {pinError && (
                    <p className="text-xs text-red-400 mb-2">{pinError}</p>
                  )}

                  {pinnedMessages.length > 0 ? (
                    <div className="space-y-2">
                      {pinnedMessages.map((p) => (
                        <div key={p.id}
                          className="rounded-xl px-4 py-3 transition-all duration-150 group"
                          style={{
                            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.05), rgba(245, 158, 11, 0.02))",
                            border: "1px solid rgba(245, 158, 11, 0.12)",
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs">📌</span>
                                <span className="text-xs font-medium text-amber-300">{p.message.sender.name}</span>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(p.pinnedAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-sm text-slate-200 mt-1">{p.message.content}</p>
                            </div>
                            <button
                              onClick={() => handleUnpin(p.messageId)}
                              className="shrink-0 text-[10px] text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 bg-transparent border-none cursor-pointer px-1"
                            >
                              Unpin
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-4">No pinned messages yet</p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <span>👥</span> Members ({channelMembers.length})
                  </h3>
                  {channelMembers.length > 0 ? (
                    <div className="space-y-1.5">
                      {channelMembers.map((m) => (
                        <div key={m.id}
                          className="flex items-center justify-between rounded-xl px-4 py-2.5 transition-colors"
                          style={{ background: "rgba(255,255,255,0.02)" }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white"
                              style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
                            >{m.user.name.charAt(0).toUpperCase()}</div>
                            <div>
                              <p className="text-sm text-white">{m.user.name}</p>
                              <p className="text-xs text-slate-500">{m.user.email}</p>
                            </div>
                          </div>
                          <span className={`badge ${m.role === "OWNER" ? "badge-amber" : "badge-purple"}`}>
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-6">No members in this channel.</p>
                  )}
                </div>
              </div>
            ) : selectedTeam ? (
              <div className="rounded-2xl p-12 text-center"
                style={{
                  background: "rgba(28, 35, 51, 0.6)",
                  border: "1px solid rgba(45, 55, 71, 0.4)",
                }}
              >
                <p className="text-4xl mb-3">💬</p>
                <p className="text-slate-400">Select a channel from the sidebar</p>
              </div>
            ) : (
              <div className="rounded-2xl p-12 text-center"
                style={{
                  background: "rgba(28, 35, 51, 0.6)",
                  border: "1px solid rgba(45, 55, 71, 0.4)",
                }}
              >
                <p className="text-4xl mb-3">🏗️</p>
                <p className="text-slate-400">Select a team to view channels</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateTeam && (
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
              <h3 className="text-lg font-semibold text-white">Create Team</h3>
              <button onClick={() => setShowCreateTeam(false)}
                className="flex items-center justify-center w-8 h-8 rounded-xl transition-colors hover:bg-white/5 text-slate-400 hover:text-white"
              >✕</button>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Team Name</label>
                <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                  placeholder="Engineering"
                  required
                  style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.6)" }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                <input value={newTeamDesc} onChange={(e) => setNewTeamDesc(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                  placeholder="Team description (optional)"
                  style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.6)" }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowCreateTeam(false)} className="btn-secondary px-5 py-2.5">Cancel</button>
                <button type="submit" className="btn-primary px-5 py-2.5">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreateChannel && (
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
              <h3 className="text-lg font-semibold text-white">Create Channel</h3>
              <button onClick={() => setShowCreateChannel(false)}
                className="flex items-center justify-center w-8 h-8 rounded-xl transition-colors hover:bg-white/5 text-slate-400 hover:text-white"
              >✕</button>
            </div>
            <form onSubmit={handleCreateChannel} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Channel Name</label>
                <input value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                  placeholder="general"
                  required
                  style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.6)" }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Type</label>
                <select value={newChannelType} onChange={(e) => setNewChannelType(e.target.value as "PUBLIC" | "PRIVATE")}
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none transition-all cursor-pointer"
                  style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.6)" }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
                >
                  <option value="PUBLIC">Public (all team members auto-join)</option>
                  <option value="PRIVATE">Private (invite only)</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowCreateChannel(false)} className="btn-secondary px-5 py-2.5">Cancel</button>
                <button type="submit" className="btn-primary px-5 py-2.5">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
