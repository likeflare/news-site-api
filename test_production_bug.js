const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
require('dotenv').config();

const API_URL = 'https://news-site-api.fly.dev';
const JWT_SECRET = process.env.JWT_SECRET;

const testUser = {
  sub: 'c024ed9b-f7e0-4b57-a931-04059d989333',
  email: 'janoleroux@gmail.com',
  name: 'Jano le Roux',
  role: 'admin'
};

const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '1h' });

async function testProductionBug() {
  // Use a comment with 0 likes
  const commentId = 'comment-11';
  
  console.log('=== STEP 1: Get comment BEFORE liking ===');
  const before = await fetch(`${API_URL}/api/comments?articleId=article-2`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const beforeData = await before.json();
  const beforeComment = findComment(beforeData.comments, commentId);
  console.log('Before:', {
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
  
  console.log('\n=== STEP 3: Get comment AFTER liking (simulating page refresh) ===');
  const after = await fetch(`${API_URL}/api/comments?articleId=article-2`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const afterData = await after.json();
  const afterComment = findComment(afterData.comments, commentId);
  console.log('After refresh:', {
    like_count: afterComment?.like_count,
    isLikedByUser: afterComment?.isLikedByUser
  });
  
  console.log('\n=== RESULT ===');
  if (afterComment?.isLikedByUser && afterComment?.like_count === 0) {
    console.log('❌ BUG STILL EXISTS: Red heart but counter shows 0');
  } else if (afterComment?.isLikedByUser && afterComment?.like_count > 0) {
    console.log('✅ BUG FIXED: Like state and counter match correctly!');
    console.log(`   - Red heart: ${afterComment.isLikedByUser ? 'YES' : 'NO'}`);
    console.log(`   - Counter: ${afterComment.like_count}`);
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

testProductionBug().catch(console.error);
