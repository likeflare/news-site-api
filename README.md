# News Site API - Secure Backend

This is a secure Node.js/Express backend API that protects your Turso database and provides authentication, rate limiting, and input validation for your news site.

## 🎯 What We Built

A complete, production-ready backend API with:

✅ **Database Security**: Turso credentials only on backend (never exposed to browser)
✅ **Authentication**: JWT-based auth with role-based access control (user/admin)
✅ **Rate Limiting**: Prevents spam and abuse (global, comment, admin limits)
✅ **Input Validation**: Zod schemas validate all inputs before database operations
✅ **XSS Protection**: HTML sanitization with DOMPurify
✅ **SQL Injection Prevention**: Parameterized queries throughout
✅ **CORS Configuration**: Only allows requests from your Next.js frontend

## 📁 Project Structure

```
news-site-api/
├── src/
│   ├── config/
│   │   └── database.ts           # Turso database connection
│   ├── middleware/
│   │   ├── auth.ts                # JWT authentication
│   │   ├── rateLimit.ts           # Rate limiting rules
│   │   ├── validation.ts          # Input validation schemas
│   │   └── sanitize.ts            # HTML sanitization
│   ├── routes/
│   │   ├── articles.ts            # Article endpoints
│   │   ├── comments.ts            # Comment endpoints
│   │   └── admin/
│   │       └── comments.ts        # Admin comment management
│   ├── utils/
│   │   ├── errors.ts              # Error classes
│   │   └── logger.ts              # Winston logger
│   ├── types/
│   │   └── index.ts               # TypeScript types
│   └── index.ts                   # Express app entry point
├── .env                           # Environment variables
├── .env.example                   # Template
├── Dockerfile                     # For Fly.io deployment
├── package.json
└── tsconfig.json
```

## 🚀 Quick Start

### Development

```bash
# Start dev server (with hot reload)
npm run dev

# Server runs on http://localhost:3001
```

### Build for Production

```bash
npm run build
npm start
```

## 🔐 Environment Variables

Required in `.env`:

```env
# Server
NODE_ENV=development
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000

# Database (from your Next.js .env.local)
TURSO_DATABASE_URL=libsql://news-site-likeflare.aws-us-east-1.turso.io
TURSO_AUTH_TOKEN=your-token-here

# JWT (MUST match NextAuth secret)
JWT_SECRET=your-secret-key-here-change-in-production

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📡 API Endpoints

### Public Endpoints (No Auth)

```
GET  /health                    # Health check
GET  /api/articles              # List published articles
GET  /api/articles/:slug        # Get single article
GET  /api/comments?articleId=x  # Get article comments
```

### User Endpoints (Requires Auth)

```
POST /api/comments              # Create comment (requires JWT)
```

### Admin Endpoints (Requires Admin Role)

```
GET    /api/admin/comments      # List all comments
PUT    /api/admin/comments/:id  # Update comment
DELETE /api/admin/comments/:id  # Delete comment
```

## 🧪 Testing Endpoints

```bash
# Health check
curl http://localhost:3001/health

# Get articles
curl http://localhost:3001/api/articles?limit=5

# Get comments for article
curl http://localhost:3001/api/comments?articleId=article-1

# Create comment (requires JWT token)
curl -X POST http://localhost:3001/api/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"articleId":"article-1","content":"Great article!"}'
```

## 🛡️ Security Features

### Authentication Flow
1. User logs in via NextAuth on frontend
2. Frontend receives JWT token
3. Frontend includes token in `Authorization: Bearer TOKEN` header
4. Backend validates JWT and extracts user info
5. Admin routes check `role === "admin"`

### Rate Limiting
- **Global**: 100 requests/minute per IP
- **Comments**: 5 comments/minute per user
- **Admin**: 100 operations/minute
- **Write ops**: 10 requests/minute

### Input Validation
- All inputs validated with Zod schemas
- Comment content: max 5000 characters
- Article fields: proper lengths and formats
- Email format validation

### XSS Protection
- All HTML sanitized with DOMPurify
- Comments: Only allow `<p>`, `<br>`, `<strong>`, `<em>`, `<a>`
- Articles: Full HTML with safe tags only

## 📦 Next Steps

### 1. Deploy to Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch app
fly launch

# Set secrets
fly secrets set TURSO_DATABASE_URL="your-url"
fly secrets set TURSO_AUTH_TOKEN="your-token"
fly secrets set JWT_SECRET="your-secret"
fly secrets set ALLOWED_ORIGINS="https://yoursite.com"
fly secrets set NODE_ENV="production"

# Deploy
fly deploy
```

### 2. Update Next.js Frontend

Add to your Next.js `.env.local`:
```env
NEXT_PUBLIC_API_URL=https://your-api.fly.dev
```

### 3. Remove Database Access from Next.js

**IMPORTANT**: Once backend is deployed and tested:
1. Remove `lib/db/connection.ts` and `lib/db/queries.ts` from Next.js
2. Remove `NEXT_PUBLIC_TURSO_DATABASE_URL` from Next.js `.env.local`
3. Replace all database calls with API client calls

## 🔍 Monitoring

```bash
# View logs
npm run dev  # Local development logs

# On Fly.io
fly logs
fly status
fly dashboard
```

## 📚 Additional Resources

- See `FLY_IO_BACKEND_SETUP.md` for complete implementation guide
- Fly.io Docs: https://fly.io/docs/
- Express Docs: https://expressjs.com/

## ✅ Security Checklist

- [x] Database credentials not exposed to browser
- [x] All admin routes require authentication
- [x] Comments require authentication
- [x] Input validation on all endpoints
- [x] Rate limiting active
- [x] XSS protection implemented
- [x] SQL injection prevented (parameterized queries)
- [x] CORS configured for specific origins
- [x] Error handling doesn't leak sensitive info

---

**Your database is now secure!** 🎉
