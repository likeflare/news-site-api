const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function testSubquery() {
  const userId = 'c024ed9b-f7e0-4b57-a931-04059d989333';
  const parentId = 'comment-2';
  
  console.log('=== TESTING SUBQUERY APPROACH ===');
  const subquery = await client.execute({
    sql: `
      SELECT c.*,
             (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count,
             (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END 
              FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as isLikedByUser
      FROM comments c
      WHERE c.parent_id = ? AND c.is_approved = 1
      ORDER BY c.created_at_int ASC, c.created_at ASC
    `,
    args: [userId, parentId],
  });
  
  console.log('Subquery results:');
  for (const row of subquery.rows) {
    console.log({
      id: row.id,
      author: row.author_name,
      like_count: row.like_count,
      isLikedByUser: row.isLikedByUser
    });
  }
  
  const testComment = subquery.rows.find(r => r.id === 'b527956c-448b-4e4f-9c02-7999a3fa12db');
  if (testComment) {
    if (testComment.isLikedByUser && testComment.like_count === 0) {
      console.log('\n🐛 BUG STILL EXISTS');
    } else {
      console.log('\n✅ FIXED! like_count:', testComment.like_count, 'isLikedByUser:', testComment.isLikedByUser);
    }
  }
}

testSubquery().catch(console.error);
