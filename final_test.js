const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function finalTest() {
  const userId = 'c024ed9b-f7e0-4b57-a931-04059d989333';
  const parentId = 'comment-2';
  
  console.log('=== TESTING FINAL FIX (without c.*) ===\n');
  
  const result = await client.execute({
    sql: `
      SELECT 
        c.id, c.article_id, c.parent_id, c.author_name, c.author_email,
        c.author_avatar, c.content, c.is_approved, c.created_at, c.updated_at,
        c.user_id, c.created_at_int, c.updated_at_int,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count,
        (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END 
         FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as isLikedByUser
      FROM comments c
      WHERE c.parent_id = ? AND c.is_approved = 1
      ORDER BY c.created_at_int ASC, c.created_at ASC
    `,
    args: [userId, parentId],
  });
  
  console.log('Results:');
  for (const row of result.rows) {
    const like_count = Number(row.like_count);
    const isLikedByUser = Boolean(row.isLikedByUser);
    
    console.log({
      id: row.id,
      author: row.author_name,
      like_count,
      isLikedByUser
    });
    
    if (isLikedByUser && like_count === 0) {
      console.log('  ❌ BUG STILL EXISTS!');
    } else if (isLikedByUser && like_count > 0) {
      console.log('  ✅ CORRECT: Liked and count matches!');
    }
  }
}

finalTest().catch(console.error);
