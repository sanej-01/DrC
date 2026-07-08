import { NextRequest, NextResponse } from "next/server";
import { getGitHubOAuthURL } from "@/lib/github-oauth";
import crypto from "crypto";

/**
 * POST /api/auth/github/start
 * Initiates GitHub OAuth flow
 * Phase 2.3: Generates state, redirects to GitHub
 */
export async function POST(request: NextRequest) {
  try {
    // Generate CSRF state token
    const state = crypto.randomBytes(32).toString("hex");

    // In a production app, store state in a secure, httpOnly cookie or session
    // For now, we'll return it to the client to include in the callback
    const response = NextResponse.json({
      oauth_url: getGitHubOAuthURL(state),
      state, // Return to client so it can be stored in localStorage/session
    });

    // Set a secure cookie with the state (httpOnly, secure, same-site)
    response.cookies.set({
      name: "github_oauth_state",
      value: state,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error("GitHub OAuth start error:", error);
    return NextResponse.json(
      { error: "Failed to start GitHub OAuth" },
      { status: 500 }
    );
  }
}
