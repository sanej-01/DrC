# Scale Testing & Performance Guide — Phase 10.2

Load testing, performance profiling, and optimization for Dr. Codium MVP.

---

## Overview

Scale testing validates that Dr. Codium can handle concurrent users, high PR volume, and peak usage patterns without degradation.

**Test Scenarios**: 6 load profiles
**Duration**: 1 week
**Success Criteria**: p99 <2s at 500 concurrent users

---

## Performance Baselines

### Target Metrics

| Metric | Target | Current |
|--------|--------|---------|
| API Response Time (p50) | <500ms | - |
| API Response Time (p95) | <1s | - |
| API Response Time (p99) | <2s | - |
| Dashboard Load Time | <3s | - |
| Database Query Latency (p95) | <100ms | - |
| Error Rate | <0.5% | - |
| Cron Job Duration | <30s | - |

---

## Test Scenarios

### Scenario 1: Baseline (Normal Usage)

**Profile**: 50 concurrent users, 30-minute duration

**User Actions**:
- 30% view dashboard
- 20% view growth path
- 15% vote on coaching
- 10% ask coach question
- 25% idle/wait

**Success Criteria**:
- p50 <500ms
- p99 <1s
- Error rate <0.1%

**Command**:
```bash
npm run test:load:baseline
# or: k6 run load-tests/baseline.js
```

---

### Scenario 2: Steady Load (Morning Peak)

**Profile**: 200 concurrent users, 60-minute duration

**User Actions**:
- 40% view dashboard (peak refresh)
- 20% view team garden (managers)
- 15% ask coach questions
- 25% other

**Success Criteria**:
- p50 <750ms
- p95 <1.5s
- p99 <2s
- Error rate <0.5%

**Command**:
```bash
npm run test:load:steady
```

---

### Scenario 3: Heavy Load (Spike)

**Profile**: 500 concurrent users, 30-minute duration

**User Actions**:
- 50% dashboard views
- 20% data refresh
- 20% coach questions
- 10% other

**Success Criteria**:
- p50 <1s
- p95 <2s
- p99 <3s
- Error rate <1%

**Command**:
```bash
npm run test:load:heavy
```

---

### Scenario 4: PR Ingestion Spike

**Profile**: 100 concurrent PRs merged in 5-minute window

**Actions**:
- Trigger 100 webhooks (simulated)
- Monitor scoring queue
- Verify all PRs eventually score

**Success Criteria**:
- All PRs queued within 1 minute
- Scoring completes within 5 minutes
- No duplicate scoring
- Database transaction handling correct

**Command**:
```bash
npm run test:load:pr-spike
```

---

### Scenario 5: Cron Job Performance

**Profile**: Weekly cron job execution with 1000 developers

**Actions**:
- Trigger PR polling for all developers
- Measure aggregation time
- Monitor database load

**Success Criteria**:
- Polling completes in <30 seconds
- Database CPU <60%
- Memory usage <500MB
- No query timeouts

**Command**:
```bash
npm run test:load:cron
```

---

### Scenario 6: Database Stress

**Profile**: 1000 concurrent database queries

**Actions**:
- Parallel aggregation queries
- RLS policy enforcement
- Index utilization

**Success Criteria**:
- Query response time (p95) <200ms
- Connection pool stable
- No connection timeouts
- No query deadlocks

**Command**:
```bash
npm run test:load:db-stress
```

---

## Load Testing Tools

### k6 (Primary)

```bash
npm install -D k6

# Run single scenario
k6 run load-tests/baseline.js

# Run with output to InfluxDB
k6 run --out influxdb=http://localhost:8086/myk6db load-tests/baseline.js
```

### Load Test Script Example

**`load-tests/baseline.js`**:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp-up
    { duration: '5m', target: 50 },   // Stay at 50
    { duration: '2m', target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function() {
  // Dashboard view
  let res = http.get('http://localhost:3000/app/dashboard');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(2);

  // Growth path view
  res = http.get('http://localhost:3000/app/dashboard/growth-path');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(2);

  // Coach panel query
  res = http.post('http://localhost:3000/api/coach/query', {
    question: 'How can I improve my code quality?',
  });
  check(res, { 'coach response 200': (r) => r.status === 200 });
  sleep(3);
}
```

---

## Performance Profiling

### Browser Profiling

**Steps**:
1. Start dev server: `npm run dev`
2. Open DevTools (F12)
3. Performance tab → Record
4. Execute user actions
5. Stop recording
6. Analyze flame graph

**Key Metrics**:
- Scripting time (should be <50ms)
- Rendering time (should be <16ms for 60fps)
- Layout shifts (should be minimal)

### API Profiling

**Vercel Analytics**:
1. Deploy to production
2. Vercel Dashboard → Analytics
3. View serverless function duration
4. Identify slow endpoints

**Example slow endpoints to investigate**:
- `/api/coach/query` (LLM calls)
- `/api/manager/team/[id]/individual-stats`
- `/api/scoring/status`

### Database Profiling

**Supabase Query Insights**:
1. Supabase Dashboard → SQL Editor
2. Enable query performance logs
3. Run load test
4. Analyze slow queries

**Common slow queries**:
```sql
-- Missing index on workspace_id
SELECT * FROM pull_requests WHERE workspace_id = $1;

-- N+1 query (coaching cards without join)
SELECT * FROM coaching_cards WHERE pr_id IN (...);

-- Aggregation without partitioning
SELECT SUM(score) FROM pr_scores GROUP BY workspace_id;
```

---

## Optimization Checklist

### Frontend

- [ ] Code splitting enabled
  - Verify: `npm run build` shows chunk analysis
  - Goal: Main bundle <200KB

- [ ] Image optimization
  - Use `next/image` component
  - WebP format where possible
  - Lazy loading on growth path charts

- [ ] CSS optimization
  - Tailwind purge enabled
  - CSS <100KB gzipped
  - No unused styles

- [ ] React optimization
  - Memoization on heavy components
  - Lazy loading for modals
  - useCallback on event handlers

### API

- [ ] Caching enabled
  - Redis cache for aggregates
  - 5-minute TTL on coaching cards
  - Cache invalidation on score updates

- [ ] Query optimization
  - Indexed queries on `workspace_id`, `user_id`
  - Composite indexes on common filters
  - Query explain plans reviewed

- [ ] Rate limiting
  - Coach panel: 10 requests/minute per user
  - API: 100 requests/minute per IP
  - Webhook: 1000 requests/minute per app

### Database

- [ ] Connection pooling
  - Supabase pooling mode enabled
  - Pool size: 10-20 connections

- [ ] Query optimization
  - SELECT only needed columns
  - Use EXPLAIN ANALYZE
  - Avoid SELECT *

- [ ] Indexes verified
  ```sql
  CREATE INDEX idx_pull_requests_workspace_id ON pull_requests(workspace_id);
  CREATE INDEX idx_pr_scores_pr_id ON pr_scores(pr_id);
  CREATE INDEX idx_coaching_cards_workspace_id ON coaching_cards(workspace_id);
  ```

### Infrastructure

- [ ] Vercel scaling
  - Auto-scaling enabled
  - Memory allocation: 1024MB (sufficient)
  - Concurrency: Default (handles 1000+)

- [ ] Database scaling
  - Upgrade from free tier if needed
  - Monitor connection count
  - Replication for HA

---

## Load Test Results Template

### Scenario: Baseline (Normal Usage)

**Configuration**:
- Concurrent Users: 50
- Duration: 30 minutes
- Date: 2026-07-20

**Results**:
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| p50 Response Time | 420ms | <500ms | ✓ PASS |
| p95 Response Time | 850ms | <1s | ✓ PASS |
| p99 Response Time | 1200ms | <2s | ⚠ WARN |
| Error Rate | 0.08% | <0.1% | ✓ PASS |
| Throughput | 125 req/s | - | - |

**Database**:
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Query p95 | 85ms | <100ms | ✓ PASS |
| Connection Count | 12/20 | <20 | ✓ PASS |
| CPU Usage | 35% | <70% | ✓ PASS |

**Issues Found**:
- p99 slightly above target on coach panel endpoint
- Action: Add response caching for common questions

---

## Continuous Performance Monitoring

### Automated Monitoring

**Vercel Analytics** (automatic):
- Real User Monitoring (RUM)
- Serverless function duration
- Error tracking

**Supabase Monitoring**:
- Query performance
- Connection pool status
- Replication lag

### Alert Thresholds

Set up alerts for:
- p95 response time >1.5s
- Error rate >1%
- Database CPU >80%
- Cron job duration >45s

---

## Scale Testing Schedule

**Week 1**:
- Scenario 1: Baseline (Tuesday)
- Scenario 2: Steady Load (Wednesday)
- Scenario 3: Heavy Load (Thursday)

**Week 2**:
- Scenario 4: PR Ingestion Spike (Monday)
- Scenario 5: Cron Job Performance (Tuesday)
- Scenario 6: Database Stress (Wednesday)

**Week 3**:
- Fix identified issues
- Re-test critical scenarios
- Document baseline metrics

---

## Optimization Actions

Based on load test results:

### If Response Time High (>2s)

**Diagnosis**:
1. Check Vercel function logs for slow endpoints
2. Analyze database query times
3. Profile frontend rendering

**Fixes**:
- Add API response caching (Redis)
- Optimize N+1 queries
- Implement lazy loading
- Consider query batching

### If Error Rate High (>1%)

**Diagnosis**:
1. Check Vercel error logs
2. Review database connection pool
3. Monitor API rate limits

**Fixes**:
- Increase connection pool size
- Implement circuit breaker
- Add retry logic
- Scale database compute

### If Database CPU High (>80%)

**Diagnosis**:
1. Identify slow queries via EXPLAIN ANALYZE
2. Check missing indexes
3. Review aggregation queries

**Fixes**:
- Add indexes on common filters
- Optimize aggregation queries
- Implement query caching
- Consider database upgrade

---

## Success Criteria

✅ **Load Test PASS**:
- p99 <2s at 500 concurrent users
- Error rate <0.5%
- Database stable (CPU <70%)
- Cron job <30s
- No data corruption

⚠️ **Load Test CONDITIONAL**:
- p99 2-3s (minor optimization needed)
- Error rate 0.5-1%
- Database CPU 70-85%
- Cron job 30-45s

❌ **Load Test FAIL**:
- p99 >3s (major refactoring needed)
- Error rate >1%
- Database CPU >85%
- Cron job timeout
- Data corruption detected

---

## Post-Scale Testing

1. **Document Baselines**
   - Save metrics for future comparisons
   - Create performance dashboard

2. **Publish Results**
   - Document in engineering blog
   - Share with team
   - Use for capacity planning

3. **Setup Monitoring**
   - Configure continuous monitoring
   - Set alert thresholds
   - Create on-call runbooks

---

## Resources

- [k6 Load Testing](https://k6.io)
- [Vercel Analytics](https://vercel.com/docs/analytics)
- [Supabase Performance](https://supabase.com/docs/guides/platform/performance)
- [Web Vitals Guide](https://web.dev/vitals/)
- [Performance Optimization](https://nextjs.org/learn/seo/performance)
