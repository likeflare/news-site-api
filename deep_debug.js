const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function deepDebug() {
  const commentId = 'b527956c-448b-4e4f-9c02-7999a3fa12db';
  
  console.log('=== 1. Direct count from comment_likes ===');
  const direct = await client.execute({
    sql: `SELECT COUNT(*) as cnt FROM comment_likes WHERE comment_id = ?`,
    args: [commentId]
  });
  console.log('Direct count:', direct.rows[0]);
  
  console.log('\n=== 2. Subquery in SELECT ===');
  const sub = await client.execute({
    sql: `SELECT (SELECT COUNT(*) FROM comment_likes WHERE comment_id = ?) as cnt`,
    args: [commentId]
  });
  console.log('Subquery count:', sub.rows[0]);
  
  console.log('\n=== 3. Subquery with comment join ===');
  const join = await client.execute({
    sql: `
      SELECT 
        c.id,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as cnt
      FROM comments c
      WHERE c.id = ?
    `,
    args: [commentId]
  });
  console.log('Join + subquery count:', join.rows[0]);
  
  console.log('\n=== 4. Check if comment_likes.comment_id matches ===');
  const check = await client.execute({
    sql: `
      SELECT cl.comment_id, c.id, cl.comment_id = c.id as matches
      FROM comment_likes cl, comments c
      WHERE cl.comment_id = ? AND c.id = ?
    `,
    args: [commentId, commentId]
  });
  console.log('ID match check:', check.rows[0]);
  
  console.log('\n=== 5. Raw like record ===');
  const raw = await client.execute({
    sql: `SELECT * FROM comment_likes WHERE comment_id = ?`,
    args: [commentId]
  });
  console.log('Raw like:', raw.rows[0]);
  
  console.log('\n=== 6. Check comment_id type ===');
  console.log('typeof comment_id param:', typeof commentId);
  console.log('comment_id value:', JSON.stringify(commentId));
}

deepDebug().catch(console.error);
