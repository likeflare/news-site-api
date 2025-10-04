const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function testFix() {
  const userId = 'c024ed9b-f7e0-4b57-a931-04059d989333';
  const parentId = 'comment-2';
  
  console.log('=== TESTING FIXED QUERY (without DISTINCT) ===');
  const fixed = await client.execute({
    sql: `
      SELECT c.*,
             COALESCE(COUNT(cl.id), 0) as like_count,
             COALESCE(MAX(CASE WHEN cl.user_id = ? THEN 1 ELSE 0 END), 0) as isLikedByUser
      FROM comments c
      LEFT JOIN comment_likes cl ON c.id = cl.comment_id
      WHERE c.parent_id = ? AND c.is_approved = 1
      GROUP BY c.id
      ORDER BY c.created_at_int ASC, c.created_at ASC
    `,
    args: [userId, parentId],
  });
  
  console.log('Fixed query results:');
  for (const row of fixed.rows) {
    console.log({
      id: row.id,
      author: row.author_name,
      like_count: row.like_count,
      isLikedByUser: row.isLikedByUser
    });
  }
  
  const buggyComment = fixed.rows.find(r => r.id === 'b527956c-448b-4e4f-9c02-7999a3fa12db');
  if (buggyComment) {
    if (buggyComment.isLikedByUser && buggyComment.like_count === 0) {
      console.log('\n🐛 BUG STILL EXISTS');
    } else {
      console.log('\n✅ BUG FIXED! like_count:', buggyComment.like_count, 'isLikedByUser:', buggyComment.isLikedByUser);
    }
  }
}

testFix().catch(console.error);
