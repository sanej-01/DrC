"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect to sign-in if not authenticated
    if (!loading && !user) {
      router.push("/auth/sign-in");
      return;
    }

    if (!user) return;

    // Look up the user's workspace membership and route to the
    // dashboard for their role
    const redirectToDashboard = async () => {
      const { data: membership, error: memberError } = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (memberError || !membership) {
        setError("No workspace membership found for your account.");
        return;
      }

      const { workspace_id, role } = membership;

      if (role === "manager" || role === "admin") {
        router.push(`/manager/team?workspace_id=${workspace_id}`);
      } else {
        router.push(`/dashboard?workspace_id=${workspace_id}`);
      }
    };

    redirectToDashboard();
  }, [user, loading, router]);

  if (error) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ background: "var(--bg)" }}
      >
        <div className="text-center">
          <p style={{ color: "var(--ink-2)" }}>{error}</p>
          <button
            onClick={() => router.push("/auth/sign-out")}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center h-full"
      style={{ background: "var(--bg)" }}
    >
      <div style={{ color: "var(--ink-2)" }}>Loading...</div>
    </div>
  );
}
