import { NextRequest, NextResponse } from "next/server";
import { withManagerAuth } from "@/lib/api-middleware";

/**
 * Project (repo) management for a workspace. A workspace supports up to
 * 5 connected projects; the first is required, the rest optional.
 * Everything is written against the live repos schema
 * (id TEXT PK, workspace_id, repo_id, owner, name, full_name,
 * description, url, is_active) — the older repos/link route targets
 * columns that don't exist live.
 *
 * GET    ?workspace_id=...            → list active projects (primary first)
 * POST   { full_name: "owner/repo" }  → validate against GitHub and connect
 * DELETE ?workspace_id=...&repo_id=…  → disconnect (soft, keeps history)
 */

const MAX_PROJECTS = 5;

export async function GET(request: NextRequest) {
  return withManagerAuth(request, async (req, { workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const { data: repos, error } = await supabase
      .from("repos")
      .select("id, owner, name, full_name, description, url, created_at")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(MAX_PROJECTS);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch projects" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      projects: repos || [],
      max_projects: MAX_PROJECTS,
    });
  });
}

export async function POST(request: NextRequest) {
  return withManagerAuth(request, async (req, { workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    let fullName = "";
    try {
      const body = await req.json();
      fullName = String(body.full_name || "").trim();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const match = fullName.match(/^([\w.-]+)\/([\w.-]+)$/);
    if (!match) {
      return NextResponse.json(
        { error: "Expected repository as owner/name, e.g. sanej-01/jotDown" },
        { status: 400 }
      );
    }
    const [, owner, name] = match;

    // Enforce the 5-project cap (active repos only)
    const { data: existing } = await supabase
      .from("repos")
      .select("id, full_name, is_active")
      .eq("workspace_id", workspaceId);

    const active = (existing || []).filter((r) => r.is_active);
    if (active.length >= MAX_PROJECTS) {
      return NextResponse.json(
        { error: `Limit reached: a workspace supports up to ${MAX_PROJECTS} projects` },
        { status: 400 }
      );
    }

    const duplicate = (existing || []).find(
      (r) => r.full_name.toLowerCase() === `${owner}/${name}`.toLowerCase()
    );
    if (duplicate?.is_active) {
      return NextResponse.json(
        { error: `${duplicate.full_name} is already connected` },
        { status: 400 }
      );
    }

    // Validate against GitHub with the workspace token and pull the
    // canonical metadata (name casing, description, URL).
    const { data: tokenRecord } = await supabase
      .from("github_oauth_tokens")
      .select("access_token")
      .eq("workspace_id", workspaceId)
      .limit(1)
      .maybeSingle();

    if (!tokenRecord?.access_token) {
      return NextResponse.json(
        { error: "No GitHub token configured for this workspace" },
        { status: 400 }
      );
    }

    const { Octokit } = await import("octokit");
    const octokit = new Octokit({ auth: tokenRecord.access_token });

    let ghRepo;
    try {
      const { data } = await octokit.rest.repos.get({ owner, repo: name });
      ghRepo = data;
    } catch {
      return NextResponse.json(
        { error: `Could not access ${owner}/${name} on GitHub — check the name and token permissions` },
        { status: 400 }
      );
    }

    let project;
    if (duplicate) {
      // Reconnect a previously disconnected repo, keeping its PR history
      const { data, error } = await supabase
        .from("repos")
        .update({
          is_active: true,
          owner: ghRepo.owner.login,
          name: ghRepo.name,
          full_name: ghRepo.full_name,
          description: ghRepo.description,
          url: ghRepo.html_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", duplicate.id)
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: "Failed to reconnect project" }, { status: 500 });
      }
      project = data;
    } else {
      const { data, error } = await supabase
        .from("repos")
        .insert({
          id: `repo-${crypto.randomUUID()}`,
          workspace_id: workspaceId,
          repo_id: `gh-${ghRepo.id}`,
          owner: ghRepo.owner.login,
          name: ghRepo.name,
          full_name: ghRepo.full_name,
          description: ghRepo.description,
          url: ghRepo.html_url,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) {
        console.error("Error connecting project:", error);
        return NextResponse.json({ error: "Failed to connect project" }, { status: 500 });
      }
      project = data;
    }

    await supabase.from("audit_log").insert({
      workspace_id: workspaceId,
      action: "project_connected",
      subject_type: "repo",
      subject_id: project.id,
      details: { full_name: project.full_name },
    });

    return NextResponse.json({ project }, { status: 201 });
  });
}

export async function DELETE(request: NextRequest) {
  return withManagerAuth(request, async (req, { workspaceId }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const repoId = req.nextUrl.searchParams.get("repo_id");
    if (!repoId) {
      return NextResponse.json({ error: "repo_id required" }, { status: 400 });
    }

    // The first-connected project is required; only optional ones
    // (2nd-5th) can be disconnected.
    const { data: active } = await supabase
      .from("repos")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (!active || active.length <= 1) {
      return NextResponse.json(
        { error: "A workspace needs at least one connected project" },
        { status: 400 }
      );
    }
    if (active[0].id === repoId) {
      return NextResponse.json(
        { error: "The primary project cannot be disconnected" },
        { status: 400 }
      );
    }

    // Soft-disconnect: PR history and scores are kept
    const { error } = await supabase
      .from("repos")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", repoId)
      .eq("workspace_id", workspaceId);

    if (error) {
      return NextResponse.json({ error: "Failed to disconnect project" }, { status: 500 });
    }

    await supabase.from("audit_log").insert({
      workspace_id: workspaceId,
      action: "project_disconnected",
      subject_type: "repo",
      subject_id: repoId,
      details: {},
    });

    return NextResponse.json({ status: "disconnected" });
  });
}
