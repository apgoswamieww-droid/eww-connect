"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
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
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="space-y-4">
          <div className="h-8 w-24 skeleton" />
          <div className="h-96 rounded-2xl skeleton" />
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-6 animate-fade-in">
      <div className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(28, 35, 51, 0.6)",
          border: "1px solid rgba(45, 55, 71, 0.4)",
        }}
      >
        <ChatClient userId={user.id} />
      </div>
    </main>
  );
}
