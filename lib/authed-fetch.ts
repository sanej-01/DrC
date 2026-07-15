import { supabase } from "./supabase";

/**
 * fetch() wrapper that attaches the current Supabase session's access
 * token as a Bearer Authorization header. Use this for any call to an
 * API route protected by withAuth/withManagerAuth/withAdminAuth
 * (lib/api-middleware.ts) or a route that does its own Bearer check.
 */
export async function authedFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(input, { ...init, headers });
}
