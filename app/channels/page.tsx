"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthHeaders } from "../lib/tokenManager";

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

export default function ChannelsPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
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
    if (!selectedChannel) { setChannelMembers([]); return; }
    fetch(`/api/v1/channels/members?channelId=${selectedChannel.id}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => { if (j.success) setChannelMembers(j.data); })
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
            t.id === selectedTeamId ? { ...t, channels: [...t.channels, j.data] } : t,
          ),
        );
        setShowCreateChannel(false);
        setNewChannelName("");
      }
    } catch {}
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  if (!mounted || loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-slate-300">Loading channels...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold text-white">Channels</h1>
        <p className="mt-3 text-slate-300">Please sign in to view channels.</p>
        <Link className="mt-6 inline-flex rounded bg-sky-600 px-4 py-2 text-white" href="/login">
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold text-white">Channels</h1>

      {error && (
        <div className="mt-4 rounded bg-red-900/30 border border-red-500 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {teams.length === 0 && !error ? (
        <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900 p-8 text-center">
          <p className="text-slate-400 mb-4">No teams yet. Create your first team to get started.</p>
          <button
            onClick={() => setShowCreateTeam(true)}
            className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700"
          >
            Create Team
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Teams</h2>
              <button
                onClick={() => setShowCreateTeam(true)}
                className="text-sm rounded bg-sky-600 px-3 py-1 text-white hover:bg-sky-700"
              >
                + New
              </button>
            </div>

            <div className="space-y-2">
              {teams.map((team) => (
                <div key={team.id}>
                  <button
                    onClick={() => { setSelectedTeamId(team.id); setSelectedChannel(null); }}
                    className={`w-full text-left px-3 py-2 rounded text-sm font-medium ${
                      selectedTeamId === team.id
                        ? "bg-sky-600 text-white"
                        : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    }`}
                  >
                    {team.name}
                    {team.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{team.description}</p>
                    )}
                  </button>

                  {selectedTeamId === team.id && (
                    <div className="ml-3 mt-1 space-y-0.5">
                      {team.channels.map((ch) => (
                        <button
                          key={ch.id}
                          onClick={() => setSelectedChannel(ch)}
                          className={`w-full text-left px-3 py-1.5 rounded text-sm ${
                            selectedChannel?.id === ch.id
                              ? "bg-sky-700 text-white"
                              : "text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          <span className="mr-1">{ch.type === "PRIVATE" ? "\uD83D\uDD12" : "#"}</span>
                          {ch.name}
                        </button>
                      ))}
                      <button
                        onClick={() => { setSelectedTeamId(team.id); setShowCreateChannel(true); }}
                        className="w-full text-left px-3 py-1.5 rounded text-sm text-slate-400 hover:text-white hover:bg-slate-700"
                      >
                        + Add channel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>

          <div>
            {selectedChannel ? (
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      <span className="mr-2">{selectedChannel.type === "PRIVATE" ? "\uD83D\uDD12" : "#"}</span>
                      {selectedChannel.name}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {selectedChannel.type === "PRIVATE" ? "Private" : "Public"} channel
                    </p>
                  </div>
                </div>

                {channelMembers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">
                      Members ({channelMembers.length})
                    </h3>
                    <div className="space-y-2">
                      {channelMembers.map((m) => (
                        <div key={m.id} className="flex items-center justify-between rounded bg-slate-800 px-3 py-2">
                          <div>
                            <p className="text-sm text-white">{m.user.name}</p>
                            <p className="text-xs text-slate-400">{m.user.email}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            m.role === "OWNER" ? "bg-amber-900/50 text-amber-200" : "bg-slate-700 text-slate-300"
                          }`}>
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {channelMembers.length === 0 && (
                  <p className="text-slate-400 text-sm">No members in this channel.</p>
                )}
              </div>
            ) : selectedTeam ? (
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center">
                <p className="text-slate-400">Select a channel from the sidebar</p>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center">
                <p className="text-slate-400">Select a team to view channels</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreateTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Create Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Team Name</label>
                <input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Engineering"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Description</label>
                <input
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Team description (optional)"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowCreateTeam(false)} className="rounded bg-slate-700 px-4 py-2 text-white hover:bg-slate-600">
                  Cancel
                </button>
                <button type="submit" className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Create Channel</h3>
            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Channel Name</label>
                <input
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="general"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Type</label>
                <select
                  value={newChannelType}
                  onChange={(e) => setNewChannelType(e.target.value as "PUBLIC" | "PRIVATE")}
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="PUBLIC">Public (all team members auto-join)</option>
                  <option value="PRIVATE">Private (invite only)</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowCreateChannel(false)} className="rounded bg-slate-700 px-4 py-2 text-white hover:bg-slate-600">
                  Cancel
                </button>
                <button type="submit" className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
