"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
    } else {
      setAuthed(true);
    }
  }, [router]);

  if (!authed) return null;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-w-0 pl-[52px] md:pl-0">{children}</main>
    </div>
  );
}
