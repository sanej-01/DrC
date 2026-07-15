# OpenRouter Integration — Migration Guide

Complete migration from Anthropic API to OpenRouter for LLM scoring and coaching.

---

## Overview

Dr. Codium has been updated to use OpenRouter API instead of Anthropic's direct API. This allows flexibility in model selection and provides access to multiple LLM providers through a single interface.

**Benefits**:
- Access to multiple LLM providers (OpenAI, Anthropic, etc.)
- Potential cost savings through provider comparison
- Fallback models if primary is unavailable
- Better rate limiting and routing

---

## What Changed

### Scoring Pipeline

**Before** (Anthropic API):
```
PR → Haiku triage (claude-3-haiku) → Sonnet scoring (claude-3-sonnet)
```

**After** (OpenRouter):
```
PR → GPT-3.5 triage → GPT-4 scoring
```

### Coach Panel

**Before**:
```
Question → Claude Opus (claude-opus-4-1-20250805)
```

**After**:
```
Question → GPT-4 (via OpenRouter)
```

### Implementation

**File Changes**:
1. `lib/score-router.ts` - Updated to use OpenRouter API
2. `app/api/coach/query.ts` - Updated to use OpenRouter API
3. `.env.example` - Changed from ANTHROPIC_API_KEY to OPENROUTER_API_KEY
4. `.env.production.example` - Updated environment template

---

## Environment Setup

### Get OpenRouter API Key

1. Visit https://openrouter.io
2. Sign up or log in
3. Navigate to Keys (https://openrouter.io/keys)
4. Create a new API key
5. Copy the key (starts with `sk-or-v1-...`)

### Configure Environment

**Local Development**:
```bash
# Update .env.local
OPENROUTER_API_KEY=sk-or-v1-your_key_here
```

**Vercel Deployment**:
1. Go to Project Settings → Environment Variables
2. Remove: `ANTHROPIC_API_KEY`
3. Add: `OPENROUTER_API_KEY` = `sk-or-v1-...`
4. Set scope: Production + Preview
5. Redeploy

### Validate Setup

```bash
npm run validate:env
# Output: ✅ All validations passed - ready for deployment!
```

---

## Model Selection

Current configuration uses:

| Task | Model | Provider | Cost |
|------|-------|----------|------|
| Triage | gpt-3.5-turbo | OpenAI | Low |
| Scoring | gpt-4 | OpenAI | Medium |
| Coaching | gpt-4 | OpenAI | Medium |

### Changing Models

Edit `lib/score-router.ts`:

```typescript
// Triage (cheap, fast)
const TRIAGE_MODEL = "openai/gpt-3.5-turbo"; // or any OpenRouter model

// Scoring (capable)
const SCORING_MODEL = "openai/gpt-4"; // or "anthropic/claude-opus", etc.
```

Edit `app/api/coach/query.ts`:

```typescript
// Coaching (high quality)
const COACH_MODEL = "openai/gpt-4"; // or "anthropic/claude-opus", etc.
```

### Available Models via OpenRouter

Popular options:
- `openai/gpt-4` - Most capable
- `openai/gpt-3.5-turbo` - Fast, cheap
- `anthropic/claude-opus` - High quality (if Anthropic still preferred)
- `anthropic/claude-sonnet` - Balanced
- `meta-llama/llama-2-70b` - Open source alternative
- `mistral/mistral-7b` - Fast open source

See full list: https://openrouter.io/models

---

## API Differences

### Scoring Request (OpenRouter)

```typescript
const response = await fetch("https://openrouter.io/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    "HTTP-Referer": "https://dr-codium.com",
    "X-Title": "Dr Codium",
  },
  body: JSON.stringify({
    model: "openai/gpt-4",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1000,
  }),
});

const data = await response.json();
// Access tokens: data.usage.prompt_tokens, data.usage.completion_tokens
// Access response: data.choices[0].message.content
```

### Error Handling

```typescript
if (!response.ok) {
  const error = await response.text();
  throw new Error(`OpenRouter failed: ${response.status} - ${error}`);
}
```

### Rate Limiting

OpenRouter applies rate limits per API key. If hitting limits:
- Reduce max_tokens
- Increase retry backoff
- Cache common questions in Coach Panel
- Batch scoring during off-peak hours

---

## Pricing Comparison

### Per-PR Scoring Cost (Estimate)

**Anthropic Direct** (previous):
- Haiku triage: ~$0.01
- Sonnet scoring: ~$0.05
- **Total: ~$0.06 per PR**

**OpenRouter GPT** (current):
- GPT-3.5 triage: ~$0.005
- GPT-4 scoring: ~$0.03
- **Total: ~$0.035 per PR**

**Potential Savings**: ~40% per PR

### Coach Panel Query

**Anthropic Direct**: ~$0.10-0.20 per query (Opus)
**OpenRouter GPT-4**: ~$0.05-0.10 per query
**Potential Savings**: ~50% per query

---

## Troubleshooting

### "OpenRouter API key required"

**Error**: `OPENROUTER_API_KEY` not set

**Solution**:
1. Check `.env.local` or Vercel env vars
2. Ensure key starts with `sk-or-v1-`
3. Verify key is valid: https://openrouter.io/keys

### "Model not found"

**Error**: `404 - Model not found`

**Solution**:
- Check model name in code (e.g., `openai/gpt-4`)
- Verify model available: https://openrouter.io/models
- Model may require specific header or registration

### "Rate limit exceeded"

**Error**: `429 - Too many requests`

**Solutions**:
1. Reduce request volume
2. Implement exponential backoff retry
3. Upgrade OpenRouter plan
4. Switch to cheaper model for triage

### "Invalid API key"

**Error**: `401 - Unauthorized`

**Solution**:
1. Regenerate API key: https://openrouter.io/keys
2. Update Vercel env var with new key
3. Wait 5 minutes for changes to propagate

---

## Rollback Plan

If OpenRouter fails or becomes unreliable, fallback to Anthropic:

### Step 1: Update score-router.ts

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Restore original triagePR and scorePR functions
```

### Step 2: Update coach/query.ts

```typescript
const anthropic = await import("@anthropic-ai/sdk");
const client = new anthropic.Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Restore original Anthropic call
```

### Step 3: Update environment

```bash
# Add back to Vercel
ANTHROPIC_API_KEY=sk-ant-v4-...

# Remove
OPENROUTER_API_KEY
```

### Step 4: Redeploy

```bash
git push origin main
# Vercel auto-deploys
```

---

## Monitoring

### OpenRouter Usage

Monitor API usage at: https://openrouter.io

**Dashboard Shows**:
- Requests per day
- Cost per model
- Response times
- Error rates

### Track Scoring Costs

Check database `scoring_audit` table:

```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as num_scores,
  SUM(estimated_cost_cents) as total_cost_cents,
  AVG(estimated_cost_cents) as avg_cost_cents
FROM scoring_audit
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Alert Thresholds

**Set up alerts for**:
- Daily cost > $100 (1000+ PRs)
- Error rate > 5%
- Response time > 5 seconds
- Rate limit violations

---

## Migration Checklist

**Before Launch**:
- [ ] OpenRouter account created
- [ ] API key generated and saved
- [ ] Environment variables configured (local + Vercel)
- [ ] Test scoring on demo PR
- [ ] Test coaching query
- [ ] Validate env script passes
- [ ] Cost estimate reviewed
- [ ] Fallback plan documented

**After Launch**:
- [ ] Monitor error rates (should be <1%)
- [ ] Verify cost savings vs. Anthropic
- [ ] Monitor response times (target: <5s)
- [ ] Check rate limit headroom
- [ ] Weekly cost review

---

## FAQ

**Q: Why switch from Anthropic?**
A: OpenRouter provides flexibility, potential cost savings, and access to multiple models through a single API.

**Q: Will scoring accuracy change?**
A: GPT-4 is slightly different from Claude Sonnet, but comparable quality. You can always switch back to Anthropic models via OpenRouter.

**Q: What if OpenRouter has downtime?**
A: Have Anthropic API key ready for quick fallback (see Rollback Plan above).

**Q: Can we use different models for different tasks?**
A: Yes! Each function (triage, scoring, coaching) can use different models. Mix and match for cost optimization.

**Q: How do we handle API key rotation?**
A: OpenRouter supports key rotation. Generate new key, update Vercel env, redeploy.

**Q: What about multi-tenant cost attribution?**
A: All costs tracked per workspace in `scoring_cost` table. Each workspace has its own daily cap (`WORKSPACE_DAILY_COST_CAP_CENTS`).

---

## Resources

- **OpenRouter Docs**: https://openrouter.io/docs
- **OpenRouter Models**: https://openrouter.io/models
- **OpenRouter API**: https://openrouter.io/api/v1/chat/completions
- **Model Pricing**: https://openrouter.io/models (sort by price)
- **Support**: https://openrouter.io/help

---

## Support

For issues:
1. Check OpenRouter status: https://status.openrouter.io
2. Review error message in logs
3. Consult troubleshooting section above
4. Contact OpenRouter support: https://openrouter.io/help
