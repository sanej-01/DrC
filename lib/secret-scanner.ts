/**
 * Secret Detection & Redaction
 * Phase 3.7: Scans PR diffs for secrets before enqueuing
 *
 * Detects:
 * - AWS Access Keys (AKIA...)
 * - GitHub Personal Access Tokens (ghp_...)
 * - Private Keys (BEGIN RSA/EC/OPENSSH PRIVATE KEY)
 * - API Keys (common patterns)
 * - Database Connection Strings
 * - Slack/Discord Webhooks
 * - Generic credentials in env vars
 *
 * Action:
 * - Log detected secrets to audit_log with alert
 * - Redact in-memory (never store raw)
 * - Alert security team
 * - Still process PR (don't block), but flag
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export interface SecretFinding {
  type: string; // 'aws_key', 'github_token', 'private_key', 'api_key', etc.
  severity: "critical" | "high" | "medium"; // critical=credentials, high=tokens, medium=possible keys
  pattern: string; // Human-readable pattern description
  count: number; // Number of occurrences found
}

/**
 * Secret patterns (non-exhaustive but covers common cases)
 * Organized by severity for triage
 */
const SECRET_PATTERNS = {
  // CRITICAL: Direct credentials
  aws_access_key: {
    regex: /AKIA[0-9A-Z]{16}/g,
    description: "AWS Access Key",
    severity: "critical" as const,
  },
  github_token: {
    regex: /ghp_[A-Za-z0-9_]{36,255}/g,
    description: "GitHub Personal Access Token",
    severity: "critical" as const,
  },
  github_oauth_token: {
    regex: /gho_[A-Za-z0-9_]{36,255}/g,
    description: "GitHub OAuth Token",
    severity: "critical" as const,
  },
  slack_webhook: {
    regex: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]{11}\/[A-Z0-9]{11}\/[A-Za-z0-9_]{24}/g,
    description: "Slack Webhook",
    severity: "critical" as const,
  },
  private_key_header: {
    regex: /(BEGIN RSA PRIVATE KEY|BEGIN EC PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY|BEGIN PRIVATE KEY|BEGIN PGP PRIVATE KEY BLOCK)/g,
    description: "Private Key Header",
    severity: "critical" as const,
  },

  // HIGH: API keys and tokens
  api_key_generic: {
    regex: /(["\']?[Aa][Pp][Ii][-_]?[Kk][Ee][Yy]["\']?[\s:=]+["\']?[A-Za-z0-9_\-]{20,}["\']?)/g,
    description: "API Key (generic pattern)",
    severity: "high" as const,
  },
  stripe_key: {
    regex: /(sk_live_[A-Za-z0-9]{20,}|rk_live_[A-Za-z0-9]{20,})/g,
    description: "Stripe API Key",
    severity: "high" as const,
  },
  sendgrid_key: {
    regex: /SG\.[A-Za-z0-9_-]{22,}/g,
    description: "SendGrid API Key",
    severity: "high" as const,
  },

  // MEDIUM: Connection strings and passwords
  database_connection: {
    regex: /(postgres|mysql|mongodb):\/\/[A-Za-z0-9._:@\/%-]+:[A-Za-z0-9._:@\/%-]+/g,
    description: "Database Connection String",
    severity: "medium" as const,
  },
  env_password: {
    regex: /([Pp]assword|[Pp]wd|[Ss]ecret)[\s:=]+["\']?[^\s"\']+["\']?/g,
    description: "Password in env var",
    severity: "medium" as const,
  },
};

/**
 * Scan diff for secrets
 * Returns findings (which types found and counts)
 */
export function scanDiffForSecrets(diff: string): SecretFinding[] {
  const findings: SecretFinding[] = [];

  // Track which patterns we've already found (to avoid duplicates in results)
  const foundPatterns = new Set<string>();

  for (const [patternKey, patternConfig] of Object.entries(SECRET_PATTERNS)) {
    const matches = diff.match(patternConfig.regex);

    if (matches && matches.length > 0 && !foundPatterns.has(patternKey)) {
      // Count unique matches (might have duplicates)
      const uniqueMatches = new Set(matches);

      findings.push({
        type: patternKey,
        severity: patternConfig.severity,
        pattern: patternConfig.description,
        count: uniqueMatches.size,
      });

      foundPatterns.add(patternKey);
    }
  }

  return findings;
}

/**
 * Redact secrets from diff
 * Replace matched secrets with [REDACTED]
 */
export function redactSecretsFromDiff(diff: string): string {
  let redacted = diff;

  for (const patternConfig of Object.values(SECRET_PATTERNS)) {
    redacted = redacted.replace(patternConfig.regex, "[REDACTED]");
  }

  return redacted;
}

/**
 * Log security alert for detected secrets
 */
export async function recordSecretAlert(
  workspaceId: string,
  prId: string,
  findings: SecretFinding[],
  prNumber: number,
  author: string
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Determine max severity
    const maxSeverity = findings.reduce<"critical" | "high" | "medium">((max, f) => {
      const severityOrder = { critical: 0, high: 1, medium: 2 };
      return severityOrder[f.severity] < severityOrder[max] ? f.severity : max;
    }, "medium");

    // Create summary message
    const summary = findings.map((f) => `${f.pattern} (${f.count})`).join(", ");
    const message = `Secret(s) detected in PR #${prNumber}: ${summary}. Diff has been redacted.`;

    // Log to audit with security flag
    await supabase.from("audit_log").insert({
      workspace_id: workspaceId,
      action: "secret_detected",
      subject_type: "pr",
      subject_id: prId,
      details: {
        pr_number: prNumber,
        author: author,
        findings: findings,
        max_severity: maxSeverity,
        message: message,
      },
    });

    // If CRITICAL severity, could trigger additional alerts
    if (maxSeverity === "critical") {
      // TODO: Send alert to security team (Slack, email, etc.)
      console.error(`⚠️  CRITICAL SECRET DETECTED in PR #${prNumber}: ${summary}`);
    }
  } catch (error) {
    console.error("Error recording secret alert:", error);
    // Don't throw — alert failure shouldn't block PR processing
  }
}

/**
 * Check if diff contains secrets (boolean)
 */
export function hasMostCriticalSecrets(diff: string): boolean {
  const findings = scanDiffForSecrets(diff);
  // Return true if any CRITICAL severity found
  return findings.some((f) => f.severity === "critical");
}

/**
 * Get security report for a PR
 */
export async function getSecurityReport(prId: string): Promise<{
  has_secrets: boolean;
  findings: SecretFinding[];
  timestamp: string;
}> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: alert } = await supabase
      .from("audit_log")
      .select("details")
      .eq("subject_id", prId)
      .eq("action", "secret_detected")
      .maybeSingle();

    if (alert?.details) {
      return {
        has_secrets: true,
        findings: alert.details.findings || [],
        timestamp: new Date().toISOString(),
      };
    }

    return {
      has_secrets: false,
      findings: [],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching security report:", error);
    return {
      has_secrets: false,
      findings: [],
      timestamp: new Date().toISOString(),
    };
  }
}
