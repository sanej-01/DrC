-- Phase 5.4: Feedback thumbs and helpful voting
-- Developers can vote on coaching feedback usefulness
-- Idempotent: votes can be changed anytime

CREATE TABLE IF NOT EXISTS coaching_feedback_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coaching_card_id UUID NOT NULL REFERENCES coaching_cards(id) ON DELETE CASCADE,
  developer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Vote state
  helpful BOOLEAN NOT NULL, -- true = thumbs up, false = thumbs down
  voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Idempotency key
  UNIQUE(coaching_card_id, developer_id)
);

CREATE INDEX idx_coaching_feedback_votes_card ON coaching_feedback_votes(coaching_card_id);
CREATE INDEX idx_coaching_feedback_votes_developer ON coaching_feedback_votes(developer_id);

-- RLS: Users can vote on cards in their workspace
ALTER TABLE coaching_feedback_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaching_feedback_votes_user_vote" ON coaching_feedback_votes
  FOR INSERT
  WITH CHECK (
    developer_id = auth.uid()
    AND coaching_card_id IN (
      SELECT id FROM coaching_cards
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "coaching_feedback_votes_view" ON coaching_feedback_votes
  FOR SELECT
  USING (
    coaching_card_id IN (
      SELECT id FROM coaching_cards
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "coaching_feedback_votes_update_own" ON coaching_feedback_votes
  FOR UPDATE
  USING (developer_id = auth.uid())
  WITH CHECK (developer_id = auth.uid());

-- Vote summary table (cached counts for performance)
CREATE TABLE IF NOT EXISTS coaching_card_vote_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coaching_card_id UUID NOT NULL REFERENCES coaching_cards(id) ON DELETE CASCADE UNIQUE,

  -- Vote counts
  helpful_count INTEGER DEFAULT 0,
  unhelpful_count INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0,

  -- Helpfulness percentage
  helpful_percentage DECIMAL(5, 2) DEFAULT NULL,

  -- Metadata
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coaching_card_vote_summary_card ON coaching_card_vote_summary(coaching_card_id);

-- RLS: View-only for workspace members
ALTER TABLE coaching_card_vote_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaching_card_vote_summary_view" ON coaching_card_vote_summary
  FOR SELECT
  USING (
    coaching_card_id IN (
      SELECT id FROM coaching_cards
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Function to update vote summary (trigger)
CREATE OR REPLACE FUNCTION update_coaching_card_vote_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Count helpful and unhelpful votes
  INSERT INTO coaching_card_vote_summary (
    coaching_card_id,
    helpful_count,
    unhelpful_count,
    total_votes,
    helpful_percentage,
    last_updated_at
  )
  SELECT
    NEW.coaching_card_id,
    SUM(CASE WHEN helpful = true THEN 1 ELSE 0 END),
    SUM(CASE WHEN helpful = false THEN 1 ELSE 0 END),
    COUNT(*),
    ROUND(
      (SUM(CASE WHEN helpful = true THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100,
      2
    ),
    NOW()
  FROM coaching_feedback_votes
  WHERE coaching_card_id = NEW.coaching_card_id
  ON CONFLICT (coaching_card_id) DO UPDATE SET
    helpful_count = EXCLUDED.helpful_count,
    unhelpful_count = EXCLUDED.unhelpful_count,
    total_votes = EXCLUDED.total_votes,
    helpful_percentage = EXCLUDED.helpful_percentage,
    last_updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on insert
CREATE TRIGGER trigger_update_vote_summary_insert
AFTER INSERT ON coaching_feedback_votes
FOR EACH ROW
EXECUTE FUNCTION update_coaching_card_vote_summary();

-- Trigger on update
CREATE TRIGGER trigger_update_vote_summary_update
AFTER UPDATE ON coaching_feedback_votes
FOR EACH ROW
WHEN (OLD.helpful IS DISTINCT FROM NEW.helpful)
EXECUTE FUNCTION update_coaching_card_vote_summary();

-- Trigger on delete
CREATE TRIGGER trigger_update_vote_summary_delete
AFTER DELETE ON coaching_feedback_votes
FOR EACH ROW
EXECUTE FUNCTION update_coaching_card_vote_summary();
