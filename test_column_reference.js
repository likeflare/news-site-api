const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function test() {
  const commentId = 'b527956c-448b-4e4f-9c02-7999a3fa12db';
  
  console.log('=== Test 1: Hardcoded ID in subquery ===');
  const t1 = await client.execute({
    sql: `
      SELECT c.id,
             (SELECT COUNT(*) FROM comment_likes WHERE comment_id = 'b527956c-448b-4e4f-9c02-7999a3fa12db') as cnt
      FROM comments c
      WHERE c.id = ?
    `,
    args: [commentId]
  });
  console.log('Hardcoded:', t1.rows[0]);
  
  console.log('\n=== Test 2: Reference c.id in subquery ===');
  const t2 = await client.execute({
    sql: `
      SELECT c.id,
             (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) as cnt
      FROM comments c
      WHERE c.id = ?
    `,
    args: [commentId]
  });
  console.log('Reference c.id:', t2.rows[0]);
  
  console.log('\n=== Test 3: Without table alias in subquery ===');
  const t3 = await client.execute({
    sql: `
      SELECT comments.id,
             (SELECT COUNT(*) FROM comment_likes WHERE comment_id = comments.id) as cnt
      FROM comments
      WHERE comments.id = ?
    `,
    args: [commentId]
  });
  console.log('No alias:', t3.rows[0]);
}

test().catch(console.error);
