"use client";

import { useEffect, useState } from "react";
import NotificationsPanel from "../../components/NotificationsPanel";
import ChatClient from "./ChatClient";

type StoredUser = {
  id: string;
  name: string;
};

function readStoredUser(): StoredUser | null {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export default function ChatPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    setUser(readStoredUser());
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold text-white">Chat</h1>
        <p className="mt-3 text-slate-300">Loading...</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold text-white">Chat</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <ChatClient userId={user.id} />
        <NotificationsPanel userId={user.id} />
      </div>
    </main>
  );
}
