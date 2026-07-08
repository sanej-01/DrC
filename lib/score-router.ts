/**
 * PR Scoring Router
 * Phase 4.2: Model routing with cost optimization
 *
 * Strategy:
 * 1. Haiku triage: Quick assessment (cheap, fast)
 * 2. If should_score: Sonnet full scoring (more capable)
 * 3. Log model_version, tokens, latency, cost
 * 4. Fetch diff in-memory only (never stored)
 */

import Anthropic from "@anthropic-ai/sdk";
import { buildScoringPrompt, buildTriagePrompt, validateScoringResult, ScoringResult } from "./scoring-prompt";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ScoringAuditEntry {
  triage_model: string;
  scoring_model: string;
  triage_tokens_input: number;
  triage_tokens_output: number;
  scoring_tokens_input: number;
  scoring_tokens_output: number;
  triage_latency_ms: number;
  scoring_latency_ms: number;
  total_latency_ms: number;
  estimated_cost_cents: number;
  triage_result: any;
  result_hash: string;
}

/**
 * Haiku triage: Quick assessment if PR needs full scoring
 * Models: claude-3-haiku-20240307
 */
async function triagePR(
  prNumber: number,
  title: string,
  author: string,
  files_changed: number,
  additions: number,
  deletions: number
): Promise<{
  should_score: boolean;
  reason: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
}> {
  const prompt = buildTriagePrompt(prNumber, title, author, files_changed, additions, deletions);
  const startTime = Date.now();

  const response = await client.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const latency = Date.now() - startTime;
  const tokens_in = response.usage.input_tokens;
  const tokens_out = response.usage.output_tokens;

  // Parse response
  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Expected text response from triage");
  }

  try {
    // Try to extract JSON
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in triage response");
    }

    const result = JSON.parse(jsonMatch[0]);
    return {
      should_score: result.should_score !== false,
      reason: result.reason || "No reason provided",
      tokens_in,
      tokens_out,
      latency_ms: latency,
    };
  } catch (parseError) {
    console.warn("Failed to parse triage response:", content.text);
    // Default to scoring if triage parsing fails
    return {
      should_score: true,
      reason: "Triage parsing failed, defaulting to score",
      tokens_in,
      tokens_out,
      latency_ms: latency,
    };
  }
}

/**
 * Sonnet full scoring: Comprehensive assessment
 * Models: claude-3-sonnet-20240229
 */
async function scorePR(
  prNumber: number,
  title: string,
  author: string,
  files_changed: number,
  additions: number,
  deletions: number,
  diff: string
): Promise<{
  result: ScoringResult;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
}> {
  const prompt = buildScoringPrompt(prNumber, title, author, files_changed, additions, deletions, diff);
  const startTime = Date.now();

  const response = await client.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const latency = Date.now() - startTime;
  const tokens_in = response.usage.input_tokens;
  const tokens_out = response.usage.output_tokens;

  // Parse response
  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Expected text response from scoring");
  }

  try {
    // Try to extract JSON
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in scoring response");
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate schema
    if (!validateScoringResult(result)) {
      throw new Error("Scoring result does not match schema");
    }

    return {
      result,
      tokens_in,
      tokens_out,
      latency_ms: latency,
    };
  } catch (parseError) {
    console.error("Failed to parse scoring response:", content.text);
    throw new Error(`Scoring parsing failed: ${parseError instanceof Error ? parseError.message : "Unknown error"}`);
  }
}

/**
 * Route PR through triage → scoring pipeline
 */
export async function routeAndScorePR(
  prNumber: number,
  title: string,
  author: string,
  files_changed: number,
  additions: number,
  deletions: number,
  diff: string
): Promise<{
  result: ScoringResult;
  audit: ScoringAuditEntry;
}> {
  const overallStart = Date.now();

  // Step 1: Triage (Haiku)
  const triage = await triagePR(prNumber, title, author, files_changed, additions, deletions);

  let scoring = null;
  let scoring_tokens_in = 0;
  let scoring_tokens_out = 0;
  let scoring_latency = 0;

  // Step 2: Full scoring (Sonnet) if needed
  if (triage.should_score && files_changed > 0) {
    const scoringResult = await scorePR(prNumber, title, author, files_changed, additions, deletions, diff);
    scoring = scoringResult.result;
    scoring_tokens_in = scoringResult.tokens_in;
    scoring_tokens_out = scoringResult.tokens_out;
    scoring_latency = scoringResult.latency_ms;
  } else {
    // Skip full scoring, use default scores
    scoring = {
      code_quality: 50,
      bug_risk: 50,
      architecture: 50,
      test_coverage: 50,
      overall_assessment: "Skipped scoring: " + triage.reason,
      feedback: [],
    };
  }

  const totalLatency = Date.now() - overallStart;

  // Calculate cost estimate (rough)
  // Haiku: ~$0.25 per 1M tokens, Sonnet: ~$3 per 1M tokens
  const haikuCost = ((triage.tokens_in + triage.tokens_out) / 1000000) * 0.25 * 100; // Convert to cents
  const sonnetCost = ((scoring_tokens_in + scoring_tokens_out) / 1000000) * 3 * 100; // Convert to cents
  const totalCost = Math.ceil(haikuCost + sonnetCost);

  // Generate result hash for idempotency
  const resultHash = generateResultHash(scoring);

  return {
    result: scoring,
    audit: {
      triage_model: "claude-3-haiku-20240307",
      scoring_model: "claude-3-sonnet-20240229",
      triage_tokens_input: triage.tokens_in,
      triage_tokens_output: triage.tokens_out,
      scoring_tokens_input: scoring_tokens_in,
      scoring_tokens_output: scoring_tokens_out,
      triage_latency_ms: triage.latency_ms,
      scoring_latency_ms: scoring_latency,
      total_latency_ms: totalLatency,
      estimated_cost_cents: totalCost,
      triage_result: {
        should_score: triage.should_score,
        reason: triage.reason,
      },
      result_hash: resultHash,
    },
  };
}

/**
 * Generate hash of scoring result for idempotency check
 */
function generateResultHash(result: ScoringResult): string {
  const crypto = require("crypto");
  const data = JSON.stringify({
    scores: {
      code_quality: result.code_quality,
      bug_risk: result.bug_risk,
      architecture: result.architecture,
      test_coverage: result.test_coverage,
    },
  });
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 16);
}
