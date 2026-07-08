import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/coach/query
 * Live coaching query with model call
 * Body: { workspaceId, subjectDeveloperId, question }
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth context
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, subjectDeveloperId, question } = body;

    if (!workspaceId || !subjectDeveloperId || !question) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (question.length > 1000) {
      return NextResponse.json(
        { error: "Question too long (max 1000 chars)" },
        { status: 400 }
      );
    }

    // Import here to avoid circular deps
    const { createClient } = await import("@supabase/supabase-js");
    const { buildCoachContext, isValidCoachQuestion, getCoachSystemPrompt, createCoachQuestion, updateCoachResponse } = await import("@/lib/coach-panel");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // Validate question
    if (!isValidCoachQuestion(question)) {
      return NextResponse.json(
        { error: "Question not appropriate for coaching context" },
        { status: 400 }
      );
    }

    // Create question record (pending)
    const coachQuestion = await createCoachQuestion(
      supabase,
      workspaceId,
      authHeader, // user_id from auth
      subjectDeveloperId,
      question
    );

    // Build RLS-safe context
    const context = await buildCoachContext(
      supabase,
      workspaceId,
      subjectDeveloperId,
      "manager" // TODO: get from auth context
    );

    // Call Anthropic API
    const anthropic = await import("@anthropic-ai/sdk");
    const client = new anthropic.Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const startTime = Date.now();

    const message = await client.messages.create({
      model: "claude-opus-4-1-20250805",
      max_tokens: 1024,
      system: getCoachSystemPrompt(),
      messages: [
        {
          role: "user",
          content: `${context}\n\nQuestion: ${question}`,
        },
      ],
    });

    const latencyMs = Date.now() - startTime;
    const response = message.content[0].type === "text" ? message.content[0].text : "";

    // Update question with response
    const updatedQuestion = await updateCoachResponse(
      supabase,
      coachQuestion.id,
      response,
      "claude-opus-4-1-20250805",
      message.usage.input_tokens + message.usage.output_tokens,
      latencyMs
    );

    // Log to audit
    await supabase.from("coach_audit_log").insert({
      workspace_id: workspaceId,
      coach_question_id: coachQuestion.id,
      user_id: authHeader,
      subject_developer_id: subjectDeveloperId,
      action: "response_received",
      context_summary: `Query about developer performance (${message.usage.input_tokens} input tokens)`,
      model_used: "claude-opus-4-1-20250805",
    });

    return NextResponse.json({ question: updatedQuestion });
  } catch (error) {
    console.error("Coach query error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process coaching query",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/coach/query
 * Fetch coaching history
 * Query params: workspaceId, developerId
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    const developerId = request.nextUrl.searchParams.get("developerId");

    if (!workspaceId || !developerId) {
      return NextResponse.json(
        { error: "Missing workspaceId or developerId" },
        { status: 400 }
      );
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const { data, error } = await supabase
      .from("coach_questions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("subject_developer_id", developerId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch coaching history" },
        { status: 500 }
      );
    }

    return NextResponse.json({ questions: data || [] });
  } catch (error) {
    console.error("Fetch coaching history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
