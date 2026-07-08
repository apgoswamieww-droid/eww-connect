"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getAuthHeaders, getToken } from "../lib/tokenManager";

type StoredUser = { id: string; name: string; email: string; role: string };

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "📊" },
  { label: "Chat", href: "/chat", icon: "💬" },
  { label: "Channels", href: "/channels", icon: "#" },
  { label: "Meetings", href: "/meetings", icon: "📅" },
  { label: "Files", href: "/files", icon: "📁" },
  { label: "Notifications", href: "/notifications", icon: "🔔" },
  { label: "Reminders", href: "/reminders", icon: "✅" },
  { label: "Users", href: "/users", icon: "👥" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3333", {
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.5)" }}
        />
      )}

      {/* Mobile hamburger */}
      <button
        className="fixed top-3 left-3 z-50 flex items-center justify-center rounded-xl border transition-colors md:hidden"
        style={{
          width: 40, height: 40,
          background: "#1c2333",
          borderColor: "rgba(45, 55, 71, 0.6)",
          color: "#f1f5f9",
          fontSize: 18,
        }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>

      {/* Sidebar */}
      <aside
        className="flex flex-col h-screen sticky top-0 z-50 transition-all duration-300 relative"
        style={{
          width: isMobile ? (sidebarOpen ? 260 : 0) : collapsed ? 68 : 240,
          minWidth: isMobile ? (sidebarOpen ? 260 : 0) : collapsed ? 68 : 240,
          background: "linear-gradient(180deg, #0f1119 0%, #131822 100%)",
          borderRight: "1px solid rgba(124, 58, 237, 0.1)",
          overflow: "visible",
          transform: isMobile ? (sidebarOpen ? "translateX(0)" : "translateX(-100%)") : "none",
        }}
      >
        {/* Desktop collapse toggle - positioned relative to sidebar */}
        <button
          className="hidden md:flex absolute -right-3 top-8 z-50 items-center justify-center w-6 h-6 rounded-full transition-all hover:scale-110"
          style={{
            background: "#1c2333",
            border: "1px solid rgba(124, 58, 237, 0.3)",
            color: "#a78bfa",
            fontSize: 10,
            cursor: "pointer",
          }}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? "▶" : "◀"}
        </button>
        {/* Brand section */}
        <div className="px-4 pt-5 pb-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(124, 58, 237, 0.08)" }}
        >
          <Link href="/dashboard" className="flex items-center gap-3 no-underline" onClick={closeSidebar}>
            <div className="flex items-center justify-center rounded-xl shrink-0"
              style={{
                width: collapsed ? 36 : 38,
                height: collapsed ? 36 : 38,
                background: "linear-gradient(135deg, #7c3aed, #ec4899)",
              }}
            >
              <span className="font-bold text-white" style={{ fontSize: collapsed ? 16 : 18 }}>E</span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-base font-bold text-white m-0 leading-tight tracking-tight">EWW</h1>
                <p className="text-xs m-0" style={{ color: "#a78bfa", letterSpacing: "0.05em" }}>Connect</p>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className="flex items-center gap-3 no-underline rounded-xl transition-all duration-150 relative group"
                style={{
                  padding: collapsed ? "10px" : "8px 12px",
                  background: active
                    ? "linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(124, 58, 237, 0.05))"
                    : "transparent",
                  color: active ? "#c4b5fd" : "#64748b",
                  border: active ? "1px solid rgba(124, 58, 237, 0.2)" : "1px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    e.currentTarget.style.color = "#94a3b8";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#64748b";
                  }
                }}
              >
                {/* Active indicator */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                    style={{ background: "linear-gradient(180deg, #7c3aed, #ec4899)" }}
                  />
                )}

                <span className="shrink-0" style={{ fontSize: collapsed ? 20 : 18, width: 22, textAlign: "center" }}>
                  {item.icon}
                </span>

                {!collapsed && (
                  <span className="text-sm font-medium truncate flex-1">{item.label}</span>
                )}

                {/* Notification badge */}
                {item.href === "/notifications" && unreadCount > 0 && (
                  <span className="badge"
                    style={{
                      background: "linear-gradient(135deg, #ec4899, #be185d)",
                      color: "#fff",
                      minWidth: collapsed ? 18 : 20,
                      height: collapsed ? 18 : 20,
                      padding: collapsed ? "0" : "0 6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 9999,
                      fontSize: collapsed ? 9 : 11,
                      fontWeight: 700,
                      animation: "notification-badge 0.3s ease-out",
                    }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="shrink-0 p-3"
          style={{ borderTop: "1px solid rgba(124, 58, 237, 0.08)" }}
        >
          {user && (
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="flex items-center justify-center rounded-full shrink-0"
                style={{
                  width: collapsed ? 32 : 34,
                  height: collapsed ? 32 : 34,
                  background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  fontSize: collapsed ? 12 : 14,
                  fontWeight: 600,
                  color: "#fff",
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200 truncate m-0">{user.name}</p>
                  <p className="text-xs m-0" style={{ color: "#a78bfa" }}>{user.role}</p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full mt-2 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            style={{
              padding: collapsed ? "8px" : "8px 12px",
              color: "#64748b",
              background: "transparent",
              border: "1px solid rgba(45, 55, 71, 0.5)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.05)";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.2)";
              e.currentTarget.style.color = "#fca5a5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "rgba(45, 55, 71, 0.5)";
              e.currentTarget.style.color = "#64748b";
            }}
          >
            <span style={{ fontSize: 14 }}>🚪</span>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
