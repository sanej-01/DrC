-- Dr. Codium MVP Phase 1.3 — Seed Data
-- Demo workspace "Platform Squad" with sample developers and scored PRs
-- Idempotent: uses INSERT ... ON CONFLICT DO NOTHING

-- ============ DEMO WORKSPACE ============
INSERT INTO workspaces (id, name, slug) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Platform Squad', 'platform-squad')
ON CONFLICT (id) DO NOTHING;

-- ============ DEMO USERS (Developers + Manager) ============
INSERT INTO users (id, auth_id, email, display_name, github_handle) VALUES
  -- Developers
  ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'aisha@example.com', 'Aisha Khan', 'aisha-khan'),
  ('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'marcus@example.com', 'Marcus Lee', 'marcus-lee'),
  ('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 'dana@example.com', 'Dana Ortiz', 'dana-ortiz'),
  ('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', 'sam@example.com', 'Sam Patel', 'sam-patel'),
  ('550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', 'wei@example.com', 'Wei Chen', 'wei-chen'),
  ('550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440006', 'liam@example.com', 'Liam Novak', 'liam-novak'),
  -- Manager
  ('550e8400-e29b-41d4-a716-446655440099', '550e8400-e29b-41d4-a716-446655440099', 'priya@example.com', 'Priya Reddy', 'priya-reddy')
ON CONFLICT (id) DO NOTHING;

-- ============ DEMO MEMBERSHIPS ============
INSERT INTO memberships (workspace_id, user_id, role) VALUES
  -- Developers
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', 'developer'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440002', 'developer'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440003', 'developer'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440004', 'developer'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440005', 'developer'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440006', 'developer'),
  -- Manager
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440099', 'manager')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- ============ DEMO REPOSITORIES ============
INSERT INTO repos (id, workspace_id, github_repo_id, owner, name, full_name, url, is_private) VALUES
  ('550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440000', 123456789, 'example-org', 'api-service', 'example-org/api-service', 'https://github.com/example-org/api-service', false),
  ('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440000', 123456790, 'example-org', 'web-app', 'example-org/web-app', 'https://github.com/example-org/web-app', false),
  ('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440000', 123456791, 'example-org', 'database', 'example-org/database', 'https://github.com/example-org/database', false)
ON CONFLICT (id) DO NOTHING;

-- ============ DEMO PULL REQUESTS (Merged) ============
-- 12 PRs for demo (mix of developers, recent merged)
INSERT INTO pull_requests (
  id, workspace_id, repo_id, github_pr_id, pr_node_id, title, number, url,
  author_github_handle, author_user_id, merged_at,
  additions_count, deletions_count, files_changed_count
) VALUES
  -- Aisha's PRs (high quality)
  ('550e8400-e29b-41d4-a716-446655440100', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440010', 1001, 'PR_NODE_1001', 'Add error handling middleware', 1001, 'https://github.com/example-org/api-service/pull/1001', 'aisha-khan', '550e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '2 days', 45, 12, 3),
  ('550e8400-e29b-41d4-a716-446655440101', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440010', 1002, 'PR_NODE_1002', 'Implement caching layer', 1002, 'https://github.com/example-org/api-service/pull/1002', 'aisha-khan', '550e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '1 day', 180, 45, 8),
  ('550e8400-e29b-41d4-a716-446655440102', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440011', 2001, 'PR_NODE_2001', 'Refactor auth component', 2001, 'https://github.com/example-org/web-app/pull/2001', 'aisha-khan', '550e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '3 days', 120, 80, 5),

  -- Marcus's PRs (lower quality, watch area)
  ('550e8400-e29b-41d4-a716-446655440103', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440010', 1003, 'PR_NODE_1003', 'Add user endpoints', 1003, 'https://github.com/example-org/api-service/pull/1003', 'marcus-lee', '550e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '5 days', 320, 50, 12),
  ('550e8400-e29b-41d4-a716-446655440104', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440011', 2002, 'PR_NODE_2002', 'Fix billing page issues', 2002, 'https://github.com/example-org/web-app/pull/2002', 'marcus-lee', '550e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '4 days', 95, 200, 7),

  -- Dana's PRs (high quality, improving)
  ('550e8400-e29b-41d4-a716-446655440105', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440012', 3001, 'PR_NODE_3001', 'Add database migrations', 3001, 'https://github.com/example-org/database/pull/3001', 'dana-ortiz', '550e8400-e29b-41d4-a716-446655440003', NOW() - INTERVAL '3 days', 150, 30, 4),

  -- Sam's PRs (steady)
  ('550e8400-e29b-41d4-a716-446655440106', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440011', 2003, 'PR_NODE_2003', 'Update dashboard styles', 2003, 'https://github.com/example-org/web-app/pull/2003', 'sam-patel', '550e8400-e29b-41d4-a716-446655440004', NOW() - INTERVAL '2 days', 80, 60, 3),

  -- Wei's PRs (growing)
  ('550e8400-e29b-41d4-a716-446655440107', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440010', 1004, 'PR_NODE_1004', 'Add request logging', 1004, 'https://github.com/example-org/api-service/pull/1004', 'wei-chen', '550e8400-e29b-41d4-a716-446655440005', NOW() - INTERVAL '1 day', 65, 25, 2),

  -- Liam's PRs (early stage)
  ('550e8400-e29b-41d4-a716-446655440108', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440011', 2004, 'PR_NODE_2004', 'Add form validation', 2004, 'https://github.com/example-org/web-app/pull/2004', 'liam-novak', '550e8400-e29b-41d4-a716-446655440006', NOW() - INTERVAL '6 days', 200, 150, 8)
ON CONFLICT (id) DO NOTHING;

-- ============ DEMO PR SCORES ============
-- Sample scores showing variety: high performers, watch areas, growing
INSERT INTO pr_scores (id, pr_id, code_quality, bug_risk, architecture, test_coverage) VALUES
  -- Aisha (high)
  ('550e8400-e29b-41d4-a716-446655440200', '550e8400-e29b-41d4-a716-446655440100', 88, 15, 90, 82),
  ('550e8400-e29b-41d4-a716-446655440201', '550e8400-e29b-41d4-a716-446655440101', 92, 10, 88, 85),
  ('550e8400-e29b-41d4-a716-446655440202', '550e8400-e29b-41d4-a716-446655440102', 85, 12, 92, 78),

  -- Marcus (watch area - bug risk)
  ('550e8400-e29b-41d4-a716-446655440203', '550e8400-e29b-41d4-a716-446655440103', 72, 48, 65, 55),
  ('550e8400-e29b-41d4-a716-446655440204', '550e8400-e29b-41d4-a716-446655440104', 68, 52, 62, 48),

  -- Dana (improving)
  ('550e8400-e29b-41d4-a716-446655440205', '550e8400-e29b-41d4-a716-446655440105', 82, 18, 85, 88),

  -- Sam (steady)
  ('550e8400-e29b-41d4-a716-446655440206', '550e8400-e29b-41d4-a716-446655440106', 78, 22, 75, 70),

  -- Wei (growing)
  ('550e8400-e29b-41d4-a716-446655440207', '550e8400-e29b-41d4-a716-446655440107', 80, 20, 78, 68),

  -- Liam (early stage)
  ('550e8400-e29b-41d4-a716-446655440208', '550e8400-e29b-41d4-a716-446655440108', 65, 35, 58, 45)
ON CONFLICT (id) DO NOTHING;

-- ============ DEMO FEEDBACK ITEMS ============
-- Sample feedback showing coaching points
INSERT INTO feedback_items (id, score_id, type, title, description, file_path, line_number) VALUES
  -- Aisha feedback (mostly GOOD)
  ('550e8400-e29b-41d4-a716-446655440300', '550e8400-e29b-41d4-a716-446655440200', 'GOOD', 'Excellent error handling', 'Error responses are comprehensive and informative', 'src/middleware/errors.ts', 45),
  ('550e8400-e29b-41d4-a716-446655440301', '550e8400-e29b-41d4-a716-446655440201', 'IMPROVE', 'Consider cache invalidation strategy', 'Add documentation for cache key expiration', 'src/cache/layer.ts', 120),

  -- Marcus feedback (FIX/IMPROVE)
  ('550e8400-e29b-41d4-a716-446655440302', '550e8400-e29b-41d4-a716-446655440203', 'FIX', 'Missing null checks', 'Add validation before accessing nested properties', 'src/handlers/users.ts', 85),
  ('550e8400-e29b-41d4-a716-446655440303', '550e8400-e29b-41d4-a716-446655440204', 'FIX', 'SQL injection risk', 'Use parameterized queries for all database calls', 'src/db/billing.ts', 220),

  -- Dana feedback (GOOD/SUGGEST)
  ('550e8400-e29b-41d4-a716-446655440304', '550e8400-e29b-41d4-a716-446655440205', 'GOOD', 'Clean migration structure', 'Schema changes are well-documented', 'migrations/001_users.sql', 1),
  ('550e8400-e29b-41d4-a716-446655440305', '550e8400-e29b-41d4-a716-446655440205', 'SUGGEST', 'Add index on user_id', 'Improve query performance for common lookups', 'migrations/001_users.sql', 45)
ON CONFLICT (id) DO NOTHING;

-- ============ DEMO COACHING CARDS ============
-- 90-day rolling aggregates
INSERT INTO coaching_cards (workspace_id, user_id, window_start, window_days, avg_code_quality, avg_bug_risk, avg_architecture, avg_test_coverage, pr_count, confidence_level) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', (CURRENT_DATE - INTERVAL '90 days')::DATE, 90, 88.33, 12.33, 90.00, 81.67, 3, 'high'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440002', (CURRENT_DATE - INTERVAL '90 days')::DATE, 90, 70.00, 50.00, 63.50, 51.50, 2, 'high'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440003', (CURRENT_DATE - INTERVAL '90 days')::DATE, 90, 82.00, 18.00, 85.00, 88.00, 1, 'low'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440004', (CURRENT_DATE - INTERVAL '90 days')::DATE, 90, 78.00, 22.00, 75.00, 70.00, 1, 'low'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440005', (CURRENT_DATE - INTERVAL '90 days')::DATE, 90, 80.00, 20.00, 78.00, 68.00, 1, 'low'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440006', (CURRENT_DATE - INTERVAL '90 days')::DATE, 90, 65.00, 35.00, 58.00, 45.00, 1, 'low')
ON CONFLICT (workspace_id, user_id, window_start, window_days) DO NOTHING;

-- ============ DEMO NOTES (Private Manager Notes) ============
INSERT INTO notes (workspace_id, author_id, about_user_id, content) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440099', '550e8400-e29b-41d4-a716-446655440001', 'Aisha is excelling. Ready for architecture leadership role. Consider for caching project.'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440099', '550e8400-e29b-41d4-a716-446655440002', 'Marcus has been struggling with security practices. Schedule 1:1 to discuss SQL injection risks.'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440099', '550e8400-e29b-41d4-a716-446655440006', 'Liam is early in journey. Pair him with Dana on migration work.')
ON CONFLICT (id) DO NOTHING;

-- ============ DEMO ALERTS ============
-- Action-framed alerts (not surveillance)
INSERT INTO alerts (workspace_id, for_user_id, alert_type, about_user_id, title, description) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440099', 'ready_to_stretch', '550e8400-e29b-41d4-a716-446655440001', 'Aisha is ready to stretch', 'Architecture skills in top growth band. Consider architecture-heavy project.'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440099', 'watch_area', '550e8400-e29b-41d4-a716-446655440002', 'Marcus may need a check-in', 'Bug-risk scores down 14 pts over last 5 PRs. Consider supportive 1:1.'),
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440099', 'coaching_milestone', NULL, 'Team coached 14 PRs today', 'All team members received coaching feedback on their recent work.')
ON CONFLICT (id) DO NOTHING;

-- ============ DEMO AUDIT LOG ============
-- Sample audit entries for accountability
INSERT INTO audit_log (workspace_id, action, subject_type, subject_id, actor_id, actor_role, details, model_version, tokens_used, latency_ms) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'pr_scored', 'pr', '550e8400-e29b-41d4-a716-446655440100', NULL, NULL, '{"pr_title": "Add error handling middleware", "dimensions": 4}', 'claude-sonnet-5', 1250, 2340),
  ('550e8400-e29b-41d4-a716-446655440000', 'pr_scored', 'pr', '550e8400-e29b-41d4-a716-446655440101', NULL, NULL, '{"pr_title": "Implement caching layer", "dimensions": 4}', 'claude-sonnet-5', 1850, 3120),
  ('550e8400-e29b-41d4-a716-446655440000', 'note_created', 'note', '1', '550e8400-e29b-41d4-a716-446655440099', 'manager', '{"about_user": "Aisha Khan", "private": true}', NULL, NULL, NULL),
  ('550e8400-e29b-41d4-a716-446655440000', 'alert_generated', 'alert', '1', NULL, NULL, '{"alert_type": "ready_to_stretch", "about_user": "Aisha Khan"}', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============ COMPLETION ============
-- Verify seed is complete
SELECT COUNT(*) as workspace_count FROM workspaces WHERE slug = 'platform-squad';
SELECT COUNT(*) as user_count FROM users WHERE email LIKE '%@example.com';
SELECT COUNT(*) as pr_count FROM pull_requests WHERE workspace_id = '550e8400-e29b-41d4-a716-446655440000';
SELECT COUNT(*) as score_count FROM pr_scores WHERE pr_id IN (SELECT id FROM pull_requests WHERE workspace_id = '550e8400-e29b-41d4-a716-446655440000');
