"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { scheduleTokenRefresh } from "../lib/tokenManager";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
        credentials: "include", // Include cookies
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      // Store token in localStorage
      if (data.data?.token) {
        localStorage.setItem("token", data.data.token);
        // Schedule automatic token refresh
        scheduleTokenRefresh();
      }

      // Store user info
      if (data.data?.user) {
        localStorage.setItem("user", JSON.stringify(data.data.user));
      }

      // Redirect to dashboard
      router.push("/dashboard");
    } catch {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-950/80 p-8 shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
        <p className="text-slate-300 mb-6">Join EWW Connect</p>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-900/30 border border-red-500 text-red-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
              minLength={2}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <p className="mt-1 text-xs text-slate-400">Minimum 8 characters</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 text-white font-medium transition"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-6 text-center text-slate-400 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-sky-400 hover:text-sky-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
