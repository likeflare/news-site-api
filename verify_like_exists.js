const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function verify() {
  const commentId = 'b527956c-448b-4e4f-9c02-7999a3fa12db';
  
  console.log('=== ALL likes in database ===');
  const all = await client.execute({
    sql: `SELECT * FROM comment_likes ORDER BY created_at DESC LIMIT 10`,
  });
  console.log('Total likes:', all.rows.length);
  console.log('Recent likes:', all.rows);
  
  console.log('\n=== Likes for our comment ===');
  const specific = await client.execute({
    sql: `SELECT * FROM comment_likes WHERE comment_id = ?`,
    args: [commentId]
  });
  console.log('Likes for', commentId, ':', specific.rows);
  
  console.log('\n=== Try casting the ID ===');
  const cast = await client.execute({
    sql: `SELECT * FROM comment_likes WHERE CAST(comment_id AS TEXT) = CAST(? AS TEXT)`,
    args: [commentId]
  });
  console.log('With CAST:', cast.rows);
  
  console.log('\n=== Check for hidden characters ===');
  const hex = await client.execute({
    sql: `SELECT hex(comment_id) as hex_id FROM comment_likes WHERE comment_id LIKE '%b527956c%'`,
  });
  console.log('Hex check:', hex.rows);
}

verify().catch(console.error);
