const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function debug() {
  const replyId = 'b527956c-448b-4e4f-9c02-7999a3fa12db';
  
  console.log('=== Test A: COUNT with hardcoded ID ===');
  const a = await client.execute({
    sql: `SELECT (SELECT COUNT(*) FROM comment_likes WHERE comment_id = 'b527956c-448b-4e4f-9c02-7999a3fa12db') as cnt`
  });
  console.log('Result:', a.rows[0]);
  
  console.log('\n=== Test B: COUNT with parameter ===');
  const b = await client.execute({
    sql: `SELECT (SELECT COUNT(*) FROM comment_likes WHERE comment_id = ?) as cnt`,
    args: [replyId]
  });
  console.log('Result:', b.rows[0]);
  
  console.log('\n=== Test C: COUNT from comments table with c.id reference ===');
  const c = await client.execute({
    sql: `
      SELECT c.id,
             (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as cnt
      FROM comments c
      WHERE c.id = ?
    `,
    args: [replyId]
  });
  console.log('Result:', c.rows[0]);
  
  console.log('\n=== Test D: Check c.id value ===');
  const d = await client.execute({
    sql: `SELECT c.id, typeof(c.id) as id_type FROM comments c WHERE c.id = ?`,
    args: [replyId]
  });
  console.log('Result:', d.rows[0]);
  
  console.log('\n=== Test E: Check comment_likes.comment_id value ===');
  const e = await client.execute({
    sql: `SELECT comment_id, typeof(comment_id) as id_type FROM comment_likes WHERE comment_id = ?`,
    args: [replyId]
  });
  console.log('Result:', e.rows[0]);
  
  console.log('\n=== Test F: Direct comparison ===');
  const f = await client.execute({
    sql: `
      SELECT 
        c.id as comment_id,
        cl.comment_id as like_comment_id,
        c.id = cl.comment_id as ids_match
      FROM comments c, comment_likes cl
      WHERE c.id = ? AND cl.comment_id = ?
    `,
    args: [replyId, replyId]
  });
  console.log('Result:', f.rows[0]);
}

debug().catch(console.error);
