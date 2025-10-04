const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function testBackendFix() {
  const userId = 'c024ed9b-f7e0-4b57-a931-04059d989333';
  const articleId = 'article-2';
  
  console.log('=== SIMULATING FIXED BACKEND GET /api/comments ===\n');
  
  // Top-level comments (fixed query)
  const result = await client.execute({
    sql: `
      SELECT c.*,
             (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count,
             (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END 
              FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as isLikedByUser
      FROM comments c
      WHERE c.article_id = ? AND c.parent_id IS NULL AND c.is_approved = 1
      ORDER BY c.created_at_int DESC, c.created_at DESC
    `,
    args: [userId, articleId],
  });

  console.log('Top-level comments:');
  for (const row of result.rows) {
    console.log({
      id: row.id,
      author: row.author_name,
      like_count: Number(row.like_count),
      isLikedByUser: Boolean(row.isLikedByUser)
    });
    
    // Get replies for this comment
    const repliesResult = await client.execute({
      sql: `
        SELECT c.*,
               (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count,
               (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END 
                FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as isLikedByUser
        FROM comments c
        WHERE c.parent_id = ? AND c.is_approved = 1
        ORDER BY c.created_at_int ASC, c.created_at ASC
      `,
      args: [userId, row.id],
    });
    
    if (repliesResult.rows.length > 0) {
      console.log('  Replies:');
      for (const reply of repliesResult.rows) {
        console.log('  -', {
          id: reply.id,
          author: reply.author_name,
          like_count: Number(reply.like_count),
          isLikedByUser: Boolean(reply.isLikedByUser)
        });
      }
    }
  }
  
  console.log('\n=== CHECKING FOR BUG ===');
  let bugFound = false;
  for (const row of result.rows) {
    if (Boolean(row.isLikedByUser) && Number(row.like_count) === 0) {
      console.log('🐛 BUG FOUND in comment:', row.id);
      bugFound = true;
    }
  }
  
  if (!bugFound) {
    console.log('✅ NO BUG! All like counts are accurate!');
  }
}

testBackendFix().catch(console.error);
