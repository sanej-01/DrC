"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="w-full max-w-md rounded-lg border p-8"
        style={{
          background: "var(--surface)",
          borderColor: "var(--line)",
          boxShadow: "var(--shadow)",
        }}
      >
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm text-white"
            style={{ background: "var(--sage)" }}
          >
            Dx
          </div>
          <h1 className="text-lg font-semibold">Dr Codium</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--ink)" }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--surface-2)",
              }}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--ink)" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--surface-2)",
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              className="px-4 py-3 rounded-lg text-sm"
              style={{
                background: "var(--rose-soft)",
                color: "var(--bad)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-lg font-medium text-sm text-white transition-all disabled:opacity-50"
            style={{ background: "var(--sage)" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {/* Demo link */}
        <div className="mt-6 text-center text-xs" style={{ color: "var(--ink-3)" }}>
          <p>Demo credentials available in docs</p>
        </div>
      </div>
    </div>
  );
}
