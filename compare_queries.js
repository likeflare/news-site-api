const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function compare() {
  const userId = 'c024ed9b-f7e0-4b57-a931-04059d989333';
  const commentId = 'b527956c-448b-4e4f-9c02-7999a3fa12db';
  const parentId = 'comment-2';
  
  console.log('=== Query A: Filter by c.id directly ===');
  const a = await client.execute({
    sql: `
      SELECT c.*,
             (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count
      FROM comments c
      WHERE c.id = ?
    `,
    args: [commentId]
  });
  console.log('Result A:', { like_count: a.rows[0]?.like_count });
  
  console.log('\n=== Query B: Filter by parent_id ===');
  const b = await client.execute({
    sql: `
      SELECT c.*,
             (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count
      FROM comments c
      WHERE c.parent_id = ? AND c.is_approved = 1
    `,
    args: [parentId]
  });
  const rowB = b.rows.find(r => r.id === commentId);
  console.log('Result B:', { like_count: rowB?.like_count });
  
  console.log('\n=== Query C: Check parent_id value ===');
  const c = await client.execute({
    sql: `SELECT id, parent_id, is_approved FROM comments WHERE id = ?`,
    args: [commentId]
  });
  console.log('Comment info:', c.rows[0]);
}

compare().catch(console.error);
