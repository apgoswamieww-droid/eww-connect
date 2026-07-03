"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getAuthHeaders, getToken } from "../lib/tokenManager";

type StoredUser = { id: string; name: string; email: string };

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "\u2302" },
  { label: "Chat", href: "/chat", icon: "\uD83D\uDCAC" },
  { label: "Channels", href: "/channels", icon: "#" },
  { label: "Files", href: "/files", icon: "\uD83D\uDCC1" },
  { label: "Meetings", href: "/meetings", icon: "\uD83D\uDCC5" },
  { label: "Notifications", href: "/notifications", icon: "\uD83D\uDD14" },
  { label: "Reminders", href: "/reminders", icon: "\u2705" },
  { label: "Users", href: "/users", icon: "\uD83D\uDC65" },
  { label: "Profile", href: "/profile", icon: "\uD83D\uDC64" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      try { setUser(JSON.parse(raw)); } catch {}
    }
  }, []);

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 768);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) return;
    let uid = "";
    try { uid = JSON.parse(storedUser).id; } catch { return; }

    fetch("/api/v1/notifications", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data)) {
          setUnreadCount(j.data.filter((n: { isRead: boolean }) => !n.isRead).length);
        }
      })
      .catch(() => {});

    const token = getToken();
    if (!token) return;
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000", {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join", { userId: uid });
    });

    socket.on("notification:created", () => {
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  const sidebarStyle: React.CSSProperties = {
    width: 220,
    minWidth: 220,
    height: "100vh",
    background: "#0f172a",
    borderRight: "1px solid #1e293b",
    display: "flex",
    flexDirection: "column",
    position: isMobile ? "fixed" : "sticky",
    top: 0,
    left: 0,
    zIndex: 50,
    transform: isMobile ? (sidebarOpen ? "translateX(0)" : "translateX(-100%)") : "none",
    transition: "transform 0.2s ease",
  };

  const hamburgerStyle: React.CSSProperties = {
    display: isMobile ? "flex" : "none",
    position: "fixed",
    top: 12,
    left: 12,
    zIndex: 60,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    cursor: "pointer",
    color: "#f1f5f9",
    fontSize: 18,
  };

  return (
    <>
      {isMobile && sidebarOpen && (
        <div
          onClick={closeSidebar}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(0,0,0,0.5)",
          }}
        />
      )}
      <button
        style={hamburgerStyle}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? "\u2715" : "\u2630"}
      </button>
      <aside style={sidebarStyle}>
        <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid #1e293b" }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
            EWW Connect
          </h1>
          {user && (
            <p style={{ fontSize: 11, color: "#64748b", margin: "4px 0 0" }}>
              {user.name}
            </p>
          )}
        </div>

        <nav style={{ flex: 1, padding: "8px 8px", display: "flex", flexDirection: "column", gap: 2, overflow: "auto" }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#fff" : "#94a3b8",
                  background: isActive ? "#1e40af" : "transparent",
                  textDecoration: "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#1e293b"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ width: 20, textAlign: "center", fontSize: 16 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.href === "/notifications" && unreadCount > 0 && (
                  <span style={{
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 10,
                    padding: "1px 7px",
                    lineHeight: "18px",
                  }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: "12px 8px", borderTop: "1px solid #1e293b" }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 6,
              fontSize: 13,
              color: "#fca5a5",
              background: "transparent",
              border: "1px solid #334155",
              cursor: "pointer",
              textAlign: "left",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#1e293b"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
