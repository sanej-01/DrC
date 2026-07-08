"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Topbar from "@/components/Topbar";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Redirect to sign-in if not authenticated
    if (!loading && !user) {
      router.push("/auth/sign-in");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: "var(--bg)" }}
      >
        <div style={{ color: "var(--ink-2)" }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen">
      <Topbar />
      <main
        className="flex flex-1 overflow-hidden"
        style={{
          background: "var(--bg)",
        }}
      >
        {/* Placeholder for main content */}
        <div
          className="flex-1 flex flex-col items-center justify-center p-8"
          style={{
            color: "var(--ink-2)",
          }}
        >
          <h1 className="text-2xl font-semibold mb-2">Dr Codium</h1>
          <p className="text-sm mb-6">Phase 2.1 auth — signed in as {user.email}</p>
          <button
            onClick={() => router.push("/auth/sign-out")}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
            }}
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}
