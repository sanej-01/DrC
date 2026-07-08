"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function SignOutPage() {
  const router = useRouter();
  const { signOut } = useAuth();

  useEffect(() => {
    const handleSignOut = async () => {
      try {
        await signOut();
        router.push("/auth/sign-in");
      } catch (error) {
        console.error("Sign out error:", error);
        router.push("/auth/sign-in");
      }
    };

    handleSignOut();
  }, [signOut, router]);

  return (
    <div
      className="flex items-center justify-center h-screen"
      style={{ background: "var(--bg)", color: "var(--ink-2)" }}
    >
      <div>Signing out...</div>
    </div>
  );
}
