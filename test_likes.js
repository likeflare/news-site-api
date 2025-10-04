const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function testLikes() {
  // Get a comment with likes
  const result = await client.execute(`
    SELECT 
      c.id,
      c.author_name,
      c.like_count as stored_like_count,
      COUNT(DISTINCT cl.id) as actual_like_count,
      GROUP_CONCAT(cl.user_id) as liked_by_users
    FROM comments c
    LEFT JOIN comment_likes cl ON c.id = cl.comment_id
    WHERE c.article_id = 'article-2'
    GROUP BY c.id
    LIMIT 5
  `);
  
  console.log('Comment like analysis:');
  console.log(JSON.stringify(result.rows, null, 2));
}

testLikes().catch(console.error);
