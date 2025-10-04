const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
require('dotenv').config();

const API_URL = 'https://news-site-api.fly.dev';
const JWT_SECRET = process.env.JWT_SECRET;

// Create a test user token
const testUser = {
  sub: 'c024ed9b-f7e0-4b57-a931-04059d989333',
  email: 'janoleroux@gmail.com',
  name: 'Jano le Roux',
  role: 'admin'
};

const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '1h' });

async function testLikeBug() {
  const commentId = 'b527956c-448b-4e4f-9c02-7999a3fa12db'; // A comment with 0 likes
  
  console.log('=== STEP 1: Get comments BEFORE liking (authenticated) ===');
  const before = await fetch(`${API_URL}/api/comments?articleId=article-2`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const beforeData = await before.json();
  const beforeComment = findComment(beforeData.comments, commentId);
  console.log('Comment before like:', {
    id: beforeComment?.id,
    like_count: beforeComment?.like_count,
    isLikedByUser: beforeComment?.isLikedByUser
  });
  
  console.log('\n=== STEP 2: Like the comment ===');
  const likeRes = await fetch(`${API_URL}/api/comments/${commentId}/like`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const likeData = await likeRes.json();
  console.log('Like response:', likeData);
  
  console.log('\n=== STEP 3: Get comments AFTER liking (authenticated) ===');
  const after = await fetch(`${API_URL}/api/comments?articleId=article-2`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const afterData = await after.json();
  const afterComment = findComment(afterData.comments, commentId);
  console.log('Comment after like:', {
    id: afterComment?.id,
    like_count: afterComment?.like_count,
    isLikedByUser: afterComment?.isLikedByUser
  });
  
  console.log('\n=== CHECKING FOR BUG ===');
  if (afterComment?.isLikedByUser && afterComment?.like_count === 0) {
    console.log('🐛 BUG FOUND: isLikedByUser is true but like_count is 0!');
  } else {
    console.log('✅ No bug: Counter and state are in sync');
  }
}

function findComment(comments, id) {
  for (const c of comments) {
    if (c.id === id) return c;
    if (c.replies) {
      for (const r of c.replies) {
        if (r.id === id) return r;
      }
    }
  }
  return null;
}

testLikeBug().catch(console.error);
