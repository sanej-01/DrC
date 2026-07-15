"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/lib/auth-context";

/**
 * /auth/invite?token=XXX
 * Developer invite acceptance page
 * Phase 2.5: Developers accept invite to join workspace
 */
export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-gray-600">Loading...</p>
        </div>
      }
    >
      <InvitePageInner />
    </Suspense>
  );
}

function InvitePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Redirect to sign-in if not authenticated
    if (!loading && !user) {
      router.push(`/auth/sign-in?redirect_to=${encodeURIComponent(window.location.href)}`);
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to sign-in...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-4">Invalid Invite</h1>
          <p className="text-gray-600 mb-4">No invite token provided.</p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  const handleAcceptInvite = async () => {
    try {
      setIsAccepting(true);
      setError(null);

      // Get auth token from browser
      const response = await fetch("/api/auth/invites/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("supabase.auth.token")}`,
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to accept invite");
        return;
      }

      setSuccess(true);

      // Redirect to workspace after short delay
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Join Workspace</h1>

        {success ? (
          <div className="text-center">
            <p className="text-green-600 font-semibold mb-2">✓ Successfully joined!</p>
            <p className="text-gray-600 mb-4">Redirecting to workspace...</p>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-6">
              You're invited to join a workspace. Click below to accept the invitation.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleAcceptInvite}
              disabled={isAccepting}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAccepting ? "Accepting..." : "Accept Invitation"}
            </button>

            <a
              href="/"
              className="block text-center mt-4 text-blue-600 hover:underline text-sm"
            >
              Back to home
            </a>
          </>
        )}
      </div>
    </div>
  );
}
