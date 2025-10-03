-- Create article_likes table for tracking user likes on articles
-- This ensures accurate like counts and prevents duplicate likes

CREATE TABLE IF NOT EXISTS article_likes (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at_int INTEGER NOT NULL,
  UNIQUE(article_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_article_likes_article_id ON article_likes(article_id);

CREATE INDEX IF NOT EXISTS idx_article_likes_user_id ON article_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_article_likes_composite ON article_likes(article_id, user_id);
