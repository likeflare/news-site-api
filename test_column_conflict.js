const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function test() {
  const replyId = 'b527956c-448b-4e4f-9c02-7999a3fa12db';
  
  console.log('=== Check if comments table has like_count column ===');
  const schema = await client.execute({
    sql: `SELECT sql FROM sqlite_master WHERE type='table' AND name='comments'`
  });
  console.log(schema.rows[0].sql);
  
  console.log('\n=== Test with c.* (includes all columns) ===');
  const withStar = await client.execute({
    sql: `
      SELECT c.*,
             (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count
      FROM comments c
      WHERE c.id = ?
    `,
    args: [replyId]
  });
  console.log('With c.*:', {
    id: withStar.rows[0].id,
    like_count: withStar.rows[0].like_count,
    like_count_type: typeof withStar.rows[0].like_count
  });
  
  console.log('\n=== Test without c.* (explicit columns only) ===');
  const withoutStar = await client.execute({
    sql: `
      SELECT c.id, c.author_name,
             (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count
      FROM comments c
      WHERE c.id = ?
    `,
    args: [replyId]
  });
  console.log('Without c.*:', {
    id: withoutStar.rows[0].id,
    like_count: withoutStar.rows[0].like_count,
    like_count_type: typeof withoutStar.rows[0].like_count
  });
}

test().catch(console.error);
