"use client";

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

function rsvpLabel(status: string): string {
  if (status === "ACCEPTED") return "Accepted";
  if (status === "DECLINED") return "Declined";
  return "Pending";
}

function rsvpColor(status: string): string {
  if (status === "ACCEPTED") return "bg-green-900/40 text-green-200";
  if (status === "DECLINED") return "bg-red-900/40 text-red-200";
  return "bg-amber-900/40 text-amber-200";
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
        <p className="text-slate-300">Loading meetings...</p>
      </main>
    );
  }



  const upcoming = meetings.filter((m) => !isPast(m.endTime));
  const past = meetings.filter((m) => isPast(m.endTime));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-white">Meetings</h1>
        <button onClick={() => setShowCreate(true)} className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">
          + Schedule
        </button>
      </div>

      {meetings.length === 0 ? (
        <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900 p-8 text-center">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-slate-400 mb-4">No meetings scheduled</p>
          <button onClick={() => setShowCreate(true)} className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">
            Schedule your first meeting
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-slate-200 mb-3">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map((meeting) => (
                  <div key={meeting.id} className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-white">{meeting.title}</h3>
                        {meeting.description && <p className="text-sm text-slate-400 mt-1">{meeting.description}</p>}
                        <p className="text-sm text-slate-300 mt-2">{formatDate(meeting.startTime)}</p>
                        <p className="text-sm text-slate-400">{formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}</p>
                        <p className="text-xs text-slate-500 mt-1">Created by {meeting.createdBy.name}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {myRsvp(meeting) ? (
                          <span className={`text-xs px-2 py-0.5 rounded ${rsvpColor(myRsvp(meeting)!)}`}>
                            {rsvpLabel(myRsvp(meeting)!)}
                          </span>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => handleRsvp(meeting.id, "ACCEPTED")} className="text-xs rounded bg-green-700 px-2.5 py-1 text-white hover:bg-green-600">Accept</button>
                            <button onClick={() => handleRsvp(meeting.id, "DECLINED")} className="text-xs rounded bg-red-700 px-2.5 py-1 text-white hover:bg-red-600">Decline</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {meeting.participants.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {meeting.participants.map((p) => (
                          <span key={p.id} className={`text-xs px-2 py-0.5 rounded ${rsvpColor(p.rsvpStatus)}`}>
                            {p.user.name} ({rsvpLabel(p.rsvpStatus)})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-slate-200 mb-3">Past</h2>
              <div className="space-y-2 opacity-60">
                {past.map((meeting) => (
                  <div key={meeting.id} className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-white">{meeting.title}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(meeting.startTime)}</p>
                      </div>
                      {myRsvp(meeting) && (
                        <span className={`text-xs px-2 py-0.5 rounded ${rsvpColor(myRsvp(meeting)!)}`}>
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

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Schedule Meeting</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Title</label>
                <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Sprint Planning" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Description</label>
                <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={2}
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Optional description" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Date</label>
                <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Start</label>
                  <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} required
                    className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">End</label>
                  <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} required
                    className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="rounded bg-slate-700 px-4 py-2 text-white hover:bg-slate-600">Cancel</button>
                <button type="submit"
                  className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
