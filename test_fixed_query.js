const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function testQueries() {
  const userId = 'c024ed9b-f7e0-4b57-a931-04059d989333';
  const parentId = 'comment-2';
  
  console.log('=== CURRENT (BUGGY) QUERY ===');
  const buggy = await client.execute({
    sql: `
      SELECT c.*,
             COALESCE(COUNT(DISTINCT cl.id), 0) as like_count,
             COALESCE(MAX(CASE WHEN cl.user_id = ? THEN 1 ELSE 0 END), 0) as isLikedByUser
      FROM comments c
      LEFT JOIN comment_likes cl ON c.id = cl.comment_id
      WHERE c.parent_id = ? AND c.is_approved = 1
      GROUP BY c.id
    `,
    args: [userId, parentId],
  });
  
  const buggyRow = buggy.rows.find(r => r.id === 'b527956c-448b-4e4f-9c02-7999a3fa12db');
  console.log('Buggy result:', {
    like_count: buggyRow?.like_count,
    isLikedByUser: buggyRow?.isLikedByUser
  });
  
  console.log('\n=== TESTING: Count likes separately ===');
  const separate = await client.execute({
    sql: `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as isLikedByUser
      FROM comments c
      WHERE c.parent_id = ? AND c.is_approved = 1
    `,
    args: [userId, parentId],
  });
  
  const separateRow = separate.rows.find(r => r.id === 'b527956c-448b-4e4f-9c02-7999a3fa12db');
  console.log('Separate subquery result:', {
    like_count: separateRow?.like_count,
    isLikedByUser: separateRow?.isLikedByUser
  });
  
  console.log('\n=== TESTING: Manual check for this specific comment ===');
  const manual = await client.execute({
    sql: `
      SELECT 
        COUNT(*) as total_likes,
        SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) as user_liked
      FROM comment_likes 
      WHERE comment_id = 'b527956c-448b-4e4f-9c02-7999a3fa12db'
    `,
    args: [userId],
  });
  console.log('Manual count:', manual.rows[0]);
}

testQueries().catch(console.error);
