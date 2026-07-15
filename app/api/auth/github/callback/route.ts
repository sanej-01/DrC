import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  exchangeCodeForToken,
  getGitHubUser,
} from "@/lib/github-oauth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * GET /api/auth/github/callback
 * GitHub OAuth callback handler
 * Phase 2.3: Receives code, exchanges for token, links GitHub account
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Check for OAuth errors
    if (error) {
      const errorDesc = searchParams.get("error_description");
      console.error(`GitHub OAuth error: ${error} - ${errorDesc}`);

      return NextResponse.redirect(
        `${request.nextUrl.origin}/auth/sign-in?error=github_auth_failed`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/auth/sign-in?error=missing_code`
      );
    }

    // Validate state (CSRF protection)
    // In a full implementation, state would be stored in session/cookie
    // For now, just verify it's not empty
    if (!state) {
      console.warn("Missing CSRF state in GitHub callback");
      return NextResponse.redirect(
        `${request.nextUrl.origin}/auth/sign-in?error=invalid_state`
      );
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code);

    // Get GitHub user info
    const githubUser = await getGitHubUser(tokenData.access_token);

    // Get Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get current user's auth ID from the request
    // In a real implementation, this would come from the session/JWT
    // For now, we need to get it from somewhere — typically stored in state cookie
    // TODO: Implement proper state/session management for this callback
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/auth/sign-in?error=not_authenticated`
      );
    }

    // Verify JWT and extract user ID
    const token = authHeader.substring(7);
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user || !user.id) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/auth/sign-in?error=not_authenticated`
      );
    }

    // Get or create user record
    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (userError && userError.code !== "PGRST116") {
      throw userError;
    }

    let userId = userRecord?.id;
    if (!userId) {
      // Create user record
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          auth_id: user.id,
          email: user.email || "",
          github_handle: githubUser.login,
          display_name: githubUser.name,
          avatar_url: githubUser.avatar_url,
        })
        .select("id")
        .single();

      if (createError) throw createError;
      userId = newUser.id;
    }

    // Store or update GitHub OAuth token
    const { error: tokenError } = await supabase
      .from("github_oauth_tokens")
      .upsert(
        {
          user_id: userId,
          github_id: githubUser.id,
          github_handle: githubUser.login,
          access_token: tokenData.access_token,
          token_type: tokenData.token_type,
          scope: tokenData.scope,
        },
        { onConflict: "user_id" }
      );

    if (tokenError) {
      console.error("Error storing GitHub token:", tokenError);
      throw tokenError;
    }

    // Log OAuth linking to audit
    await supabase.from("audit_log").insert({
      action: "github_oauth_linked",
      subject_type: "user",
      subject_id: userId,
      details: {
        github_handle: githubUser.login,
        github_id: githubUser.id,
      },
    });

    // Redirect to home or next step
    return NextResponse.redirect(`${request.nextUrl.origin}/?github_linked=true`);
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    return NextResponse.redirect(
      `${request.nextUrl.origin}/auth/sign-in?error=callback_failed`
    );
  }
}
