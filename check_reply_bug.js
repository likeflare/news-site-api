const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkReply() {
  const userId = 'c024ed9b-f7e0-4b57-a931-04059d989333';
  const replyId = 'b527956c-448b-4e4f-9c02-7999a3fa12db';
  
  const result = await client.execute({
    sql: `
      SELECT c.*,
             (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count,
             (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END 
              FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as isLikedByUser
      FROM comments c
      WHERE c.id = ?
    `,
    args: [userId, replyId],
  });
  
  console.log('Reply data:', result.rows[0]);
  console.log('like_count:', Number(result.rows[0].like_count));
  console.log('isLikedByUser:', Boolean(result.rows[0].isLikedByUser));
  
  console.log('\n=== Direct like check ===');
  const likes = await client.execute({
    sql: 'SELECT * FROM comment_likes WHERE comment_id = ?',
    args: [replyId]
  });
  console.log('Actual likes in DB:', likes.rows);
}

checkReply().catch(console.error);
