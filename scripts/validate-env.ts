#!/usr/bin/env node

/**
 * Validate that all required environment variables are set for deployment
 * Run: npx ts-node scripts/validate-env.ts
 */

const requiredVars = {
  public: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ],
  private: [
    'SUPABASE_SERVICE_ROLE_KEY',
    'GITHUB_APP_ID',
    'GITHUB_APP_PRIVATE_KEY',
    'GITHUB_WEBHOOK_SECRET',
    'GITHUB_OAUTH_CLIENT_ID',
    'GITHUB_OAUTH_CLIENT_SECRET',
    'ANTHROPIC_API_KEY',
    'CRON_SECRET',
  ],
  optional: [
    'WORKSPACE_DAILY_COST_CAP_CENTS',
    'SCORING_KILL_SWITCH',
    'GITHUB_OAUTH_REDIRECT_URI',
  ],
};

const missing: string[] = [];
const present: string[] = [];
const optionalMissing: string[] = [];

// Check all required variables
[...requiredVars.public, ...requiredVars.private].forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    present.push(varName);
  } else {
    missing.push(varName);
  }
});

// Check optional variables
requiredVars.optional.forEach((varName) => {
  const value = process.env[varName];
  if (!value) {
    optionalMissing.push(varName);
  }
});

// Print results
console.log('\n🔍 Environment Variable Validation\n');
console.log(`✓ Present: ${present.length}/${requiredVars.public.length + requiredVars.private.length}`);

if (missing.length === 0) {
  console.log('✓ All required variables are set\n');
} else {
  console.log(`✗ Missing: ${missing.length} required variables\n`);
  missing.forEach((v) => console.log(`  ❌ ${v}`));
  console.log();
}

if (optionalMissing.length > 0) {
  console.log(`⚠ Optional variables not set: ${optionalMissing.length}\n`);
  optionalMissing.forEach((v) => console.log(`  ⚠ ${v}`));
  console.log();
}

// Validate specific formats
const validations: Record<string, (value: string) => boolean> = {
  GITHUB_APP_PRIVATE_KEY: (v) => v.length > 100, // Should be base64 encoded
  GITHUB_WEBHOOK_SECRET: (v) => v.length >= 32, // At least 32 chars
  CRON_SECRET: (v) => v.length >= 32, // At least 32 chars
  ANTHROPIC_API_KEY: (v) => v.startsWith('sk-'), // Starts with sk-
};

const invalidFormats: string[] = [];
Object.entries(validations).forEach(([varName, validator]) => {
  const value = process.env[varName];
  if (value && !validator(value)) {
    invalidFormats.push(`${varName} (format mismatch)`);
  }
});

if (invalidFormats.length > 0) {
  console.log(`⚠ Invalid format detected:\n`);
  invalidFormats.forEach((v) => console.log(`  ⚠ ${v}`));
  console.log();
}

// Final status
if (missing.length === 0 && invalidFormats.length === 0) {
  console.log('✅ All validations passed - ready for deployment!\n');
  process.exit(0);
} else {
  console.log('❌ Validation failed - fix missing/invalid variables before deploying\n');
  process.exit(1);
}
