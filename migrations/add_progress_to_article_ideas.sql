-- Add progress column to article_ideas table
-- States: 'pending', 'started', 'done', 'failed'
ALTER TABLE article_ideas ADD COLUMN progress TEXT DEFAULT 'pending';
ALTER TABLE article_ideas ADD COLUMN progress_started_at INTEGER;
ALTER TABLE article_ideas ADD COLUMN progress_completed_at INTEGER;
