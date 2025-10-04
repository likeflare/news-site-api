const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkSchema() {
  console.log('=== Comment likes table structure ===');
  const schema = await client.execute({
    sql: `SELECT sql FROM sqlite_master WHERE type='table' AND name='comment_likes'`,
  });
  console.log(schema.rows[0]?.sql);
  
  console.log('\n=== All likes for the problematic comment ===');
  const likes = await client.execute({
    sql: `SELECT * FROM comment_likes WHERE comment_id = 'b527956c-448b-4e4f-9c02-7999a3fa12db'`,
  });
  console.log('Likes:', likes.rows);
  console.log('Number of likes:', likes.rows.length);
  
  console.log('\n=== Try simple COUNT without DISTINCT ===');
  const count = await client.execute({
    sql: `
      SELECT 
        c.id,
        COUNT(cl.id) as like_count,
        MAX(CASE WHEN cl.user_id = ? THEN 1 ELSE 0 END) as isLikedByUser
      FROM comments c
      LEFT JOIN comment_likes cl ON c.id = cl.comment_id
      WHERE c.id = 'b527956c-448b-4e4f-9c02-7999a3fa12db'
      GROUP BY c.id
    `,
    args: ['c024ed9b-f7e0-4b57-a931-04059d989333']
  });
  console.log('COUNT without DISTINCT:', count.rows[0]);
}

checkSchema().catch(console.error);
