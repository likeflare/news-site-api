const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function debugSQL() {
  const userId = 'c024ed9b-f7e0-4b57-a931-04059d989333';
  const parentId = 'comment-2';
  
  console.log('=== Testing the EXACT query from the backend (replies) ===');
  const result = await client.execute({
    sql: `
      SELECT c.*,
             COALESCE(COUNT(DISTINCT cl.id), 0) as like_count,
             COALESCE(MAX(CASE WHEN cl.user_id = ? THEN 1 ELSE 0 END), 0) as isLikedByUser
      FROM comments c
      LEFT JOIN comment_likes cl ON c.id = cl.comment_id
      WHERE c.parent_id = ? AND c.is_approved = 1
      GROUP BY c.id
      ORDER BY c.created_at_int ASC, c.created_at ASC
    `,
    args: [userId, parentId],
  });
  
  console.log('Query results:');
  for (const row of result.rows) {
    console.log({
      id: row.id,
      author: row.author_name,
      like_count: row.like_count,
      isLikedByUser: row.isLikedByUser,
      user_id_param: userId
    });
  }
  
  console.log('\n=== Check comment_likes table directly ===');
  const likes = await client.execute({
    sql: `SELECT * FROM comment_likes WHERE comment_id = 'b527956c-448b-4e4f-9c02-7999a3fa12db'`,
    args: []
  });
  console.log('Direct likes query:', likes.rows);
}

debugSQL().catch(console.error);
