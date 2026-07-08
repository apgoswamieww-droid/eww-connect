"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { scheduleTokenRefresh } from "../lib/tokenManager";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Read invite token from URL query params
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setInviteToken(token);
    }
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body: Record<string, string> = { name, email, password };
      if (inviteToken) body.inviteToken = inviteToken;

      const res = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      if (data.data?.token) {
        localStorage.setItem("token", data.data.token);
        scheduleTokenRefresh();
      }

      if (data.data?.user) {
        localStorage.setItem("user", JSON.stringify(data.data.user));
      }

      router.push("/dashboard");
    } catch {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0d1117 0%, #1a0a2e 50%, #0d1117 100%)" }}
    >
      {/* Decorative background elements */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }}
      />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, #ec4899 0%, transparent 70%)" }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.03]"
        style={{ background: "radial-gradient(circle, #a78bfa 0%, transparent 70%)" }}
      />

      <div className="w-full max-w-md animate-slide-up relative z-10">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
          >
            <span className="text-2xl font-bold text-white">E</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {inviteToken ? "Join your team" : "Create your account"}
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            {inviteToken ? "You've been invited — set up your profile" : "Join EWW Connect"}
          </p>
        </div>

        {/* Signup card */}
        <div className="rounded-2xl p-8"
          style={{
            background: "rgba(28, 35, 51, 0.9)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(124, 58, 237, 0.15)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          }}
        >
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
              style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#fca5a5" }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                minLength={2}
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                style={{
                  background: "rgba(13, 17, 23, 0.6)",
                  border: "1px solid rgba(45, 55, 71, 0.6)",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                style={{
                  background: "rgba(13, 17, 23, 0.6)",
                  border: "1px solid rgba(45, 55, 71, 0.6)",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(45, 55, 71, 0.6)"; e.target.style.boxShadow = "none"; }}
              />
              <p className="mt-1.5 text-xs text-slate-500">Minimum 8 characters</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "linear-gradient(135deg, #8b5cf6, #7c3aed)"; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "linear-gradient(135deg, #7c3aed, #6d28d9)"; }}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 pt-5 text-center"
            style={{ borderTop: "1px solid rgba(45, 55, 71, 0.5)" }}
          >
            <p className="text-sm text-slate-400">
              Already have an account?{" "}
              <Link href="/login" className="font-medium transition-colors"
                style={{ color: "#a78bfa" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#c4b5fd"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#a78bfa"}
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
