"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { getAuthHeaders } from "../../lib/tokenManager";

type StoredUser = { id: string; name: string; email: string };

type Participant = {
  id: string;
  userId: string;
  rsvpStatus: "PENDING" | "ACCEPTED" | "DECLINED";
  user: { id: string; name: string; email: string };
};

type Meeting = {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  channelId: string | null;
  createdById: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  participants: Participant[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function rsvpStyle(status: string): string {
  switch (status) {
    case "ACCEPTED": return "badge-green";
    case "DECLINED": return "badge-red";
    default: return "badge-amber";
  }
}

function rsvpLabel(status: string): string {
  if (status === "ACCEPTED") return "Accepted";
  if (status === "DECLINED") return "Declined";
  return "Pending";
}

function isPast(iso: string): boolean {
  return new Date(iso) < new Date();
}

export default function MeetingsPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) { try { setUser(JSON.parse(raw)); } catch {} }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !user) { setLoading(false); return; }
    fetch("/api/v1/meetings", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => { if (j.success) setMeetings(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mounted, user]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const startTime = new Date(`${formDate}T${formStart}`).toISOString();
    const endTime = new Date(`${formDate}T${formEnd}`).toISOString();
    try {
      const res = await fetch("/api/v1/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ title: formTitle, description: formDesc || undefined, startTime, endTime }),
      });
      const j = await res.json();
      if (j.success) {
        setMeetings((prev) => [...prev, j.data].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
        setShowCreate(false);
        setFormTitle(""); setFormDesc(""); setFormDate(""); setFormStart(""); setFormEnd("");
      }
    } catch {}
  }

  async function handleRsvp(meetingId: string, status: "ACCEPTED" | "DECLINED") {
    try {
      const res = await fetch("/api/v1/meetings/rsvp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ meetingId, status }),
      });
      const j = await res.json();
      if (j.success) {
        setMeetings((prev) =>
          prev.map((m) =>
            m.id === meetingId
              ? { ...m, participants: m.participants.map((p) => (p.userId === user?.id ? { ...p, rsvpStatus: status } : p)) }
              : m,
          ),
        );
      }
    } catch {}
  }

  function myRsvp(meeting: Meeting): string | null {
    return meeting.participants.find((p) => p.userId === user?.id)?.rsvpStatus ?? null;
  }

  if (!mounted || loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="space-y-4">
          <div className="h-8 w-28 skeleton" />
          <div className="h-4 w-48 skeleton" />
          <div className="h-48 rounded-2xl skeleton" />
        </div>
      </main>
    );
  }

  const upcoming = meetings.filter((m) => !isPast(m.endTime));
  const past = meetings.filter((m) => isPast(m.endTime));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Meetings</h1>
          <p className="text-sm text-slate-400 mt-1">{upcoming.length} upcoming, {past.length} past</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5">
          <span>📅</span>
          <span>Schedule</span>
        </button>
      </div>

      {meetings.length === 0 ? (
        <div className="rounded-2xl p-12 text-center"
          style={{
            background: "rgba(28, 35, 51, 0.6)",
            border: "1px solid rgba(45, 55, 71, 0.4)",
          }}
        >
          <p className="text-5xl mb-4">📅</p>
          <p className="text-slate-400 mb-2">No meetings scheduled</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mt-2">
            Schedule your first meeting
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>🔮</span> Upcoming
                <span className="badge badge-purple text-xs ml-2">{upcoming.length}</span>
              </h2>
              <div className="space-y-3">
                {upcoming.map((meeting) => (
                  <div key={meeting.id} className="rounded-2xl p-5 transition-all duration-200"
                    style={{
                      background: "rgba(28, 35, 51, 0.6)",
                      border: "1px solid rgba(124, 58, 237, 0.15)",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(124, 58, 237, 0.3)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(124, 58, 237, 0.1)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(124, 58, 237, 0.15)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-1 h-10 rounded-full shrink-0" style={{ background: "linear-gradient(180deg, #7c3aed, #ec4899)" }} />
                          <div>
                            <h3 className="text-lg font-semibold text-white">{meeting.title}</h3>
                            {meeting.description && <p className="text-sm text-slate-400 mt-0.5">{meeting.description}</p>}
                          </div>
                        </div>
                        <div className="mt-3 ml-4 space-y-1">
                          <p className="text-sm text-slate-300 flex items-center gap-2">
                            <span>📅</span> {formatDate(meeting.startTime)}
                          </p>
                          <p className="text-sm text-slate-400 flex items-center gap-2">
                            <span>⏰</span> {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-2">
                            <span>👤</span> Created by {meeting.createdBy.name}
                          </p>
                        </div>

                        {meeting.participants.length > 0 && (
                          <div className="mt-4 ml-4 flex flex-wrap gap-2">
                            {meeting.participants.map((p) => (
                              <span key={p.id} className={`badge ${rsvpStyle(p.rsvpStatus)}`}>
                                {p.user.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {myRsvp(meeting) ? (
                          <span className={`badge ${rsvpStyle(myRsvp(meeting)!)}`}>
                            {rsvpLabel(myRsvp(meeting)!)}
                          </span>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => handleRsvp(meeting.id, "ACCEPTED")}
                              className="rounded-xl text-xs font-semibold px-4 py-2 transition-all"
                              style={{ background: "rgba(16, 185, 129, 0.15)", color: "#6ee7b7", border: "1px solid rgba(16, 185, 129, 0.2)" }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(16, 185, 129, 0.25)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(16, 185, 129, 0.15)"; }}
                            >
                              Accept
                            </button>
                            <button onClick={() => handleRsvp(meeting.id, "DECLINED")}
                              className="rounded-xl text-xs font-semibold px-4 py-2 transition-all"
                              style={{ background: "rgba(239, 68, 68, 0.15)", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.2)" }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)"; }}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Past */}
          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>📋</span> Past
                <span className="badge text-xs ml-2" style={{ background: "rgba(45, 55, 71, 0.5)", color: "#64748b" }}>{past.length}</span>
              </h2>
              <div className="space-y-2 opacity-60">
                {past.map((meeting) => (
                  <div key={meeting.id} className="rounded-xl p-4"
                    style={{
                      background: "rgba(28, 35, 51, 0.4)",
                      border: "1px solid rgba(45, 55, 71, 0.3)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium text-slate-300">{meeting.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{formatDate(meeting.startTime)}</p>
                      </div>
                      {myRsvp(meeting) && (
                        <span className={`badge ${rsvpStyle(myRsvp(meeting)!)}`}>
                          {rsvpLabel(myRsvp(meeting)!)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.7)" }}
        >
          <div className="w-full max-w-lg rounded-2xl p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(28, 35, 51, 0.98)",
              border: "1px solid rgba(124, 58, 237, 0.2)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Schedule Meeting</h3>
              <button onClick={() => setShowCreate(false)}
                className="flex items-center justify-center w-8 h-8 rounded-xl transition-colors hover:bg-white/5 text-slate-400 hover:text-white"
              >✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Title</label>
                <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                  placeholder="Sprint Planning"
                  style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.6)" }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={2}
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                  placeholder="Optional description"
                  style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.6)" }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Date</label>
                <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none transition-all"
                  style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.6)", colorScheme: "dark" }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Start</label>
                  <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} required
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none transition-all"
                    style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.6)", colorScheme: "dark" }}
                    onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">End</label>
                  <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} required
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none transition-all"
                    style={{ background: "rgba(13, 17, 23, 0.6)", border: "1px solid rgba(45, 55, 71, 0.6)", colorScheme: "dark" }}
                    onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary px-5 py-2.5">Cancel</button>
                <button type="submit" className="btn-primary px-5 py-2.5">Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
