# News Site API - Production-Ready Backend

A comprehensive, security-focused Express.js backend API for a modern news publishing platform. Built with TypeScript, featuring Google OAuth authentication, JWT-based authorization, real-time engagement (likes/comments), full content management, and enterprise-level security.

---

## Table of Contents

- [What This API Does](#what-this-api-does)
- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [API Endpoints](#api-endpoints)
- [Authentication & Authorization](#authentication--authorization)
- [Security Features](#security-features)
- [Database Structure](#database-structure)
- [Environment Configuration](#environment-configuration)
- [Deployment](#deployment)
- [Utilities](#utilities)

---

## What This API Does

This is a **feature-complete news platform backend** that provides:

### Content Management
- **Articles**: Create, read, update, delete with rich HTML content
- **Authors**: Author profiles with expertise, social links, and stats
- **Categories**: Organize content with color-coded categories
- **Tags**: Tag-based article organization and discovery
- **Publishing**: Draft/published workflow with scheduling

### User Engagement
- **Comments**: Nested comment threads with replies
- **Likes**: Like articles and comments with toggle functionality
- **Moderation**: Admin approval workflow for comments
- **Real-time counts**: Engagement metrics updated automatically

### Discovery Features
- **Full-text search**: Search across article titles, excerpts, and content
- **Related articles**: Smart recommendations via tags and categories
- **Trending**: Popular articles ranked by view count
- **Filtering**: Browse by category, author, tags, or featured status

### Authentication & Security
- **Google OAuth 2.0**: Seamless social sign-in
- **JWT tokens**: Access + refresh token system
- **Role-based access**: User and admin roles with granular permissions
- **Rate limiting**: IP-based protection against abuse
- **Content sanitization**: XSS protection with DOMPurify
- **Audit logging**: Track all admin actions for compliance

### Admin Dashboard Support
- Complete CRUD operations for all content types
- Bulk delete operations
- Comment moderation queue
- Quick actions (feature toggle, approve/reject)
- Comprehensive audit trail

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 18+ with TypeScript |
| **Framework** | Express 5.x |
| **Database** | Turso (LibSQL/SQLite) |
| **Authentication** | Google OAuth 2.0 via Passport.js |
| **Authorization** | JWT (jsonwebtoken) |
| **Validation** | Zod schemas |
| **Security** | Helmet.js, DOMPurify, CORS, Rate limiting |
| **Logging** | Winston |
| **Dev Tools** | tsx, nodemon, TypeScript ESNext |

---

## Quick Start

### Prerequisites
- Node.js 18+
- Turso database account
- Google OAuth credentials

### Installation

```bash
# Clone or navigate to project
cd news-site-api

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### Development

```bash
# Start dev server with hot reload
npm run dev

# Server runs on http://localhost:3001
```

### Production Build

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Health Check

```bash
curl http://localhost:3001/health
# Response: {"status":"ok","timestamp":"2025-01-15T10:30:00.000Z"}
```

---

## API Endpoints

### Public Endpoints (No Authentication)

#### Articles
```
GET  /api/articles
     Query: limit, offset, categorySlug, authorSlug, tagSlug, featured, search
     Returns: Published articles with pagination

GET  /api/articles/:slug
     Returns: Single article + increments view count
```

#### Article Likes
```
GET  /api/article-likes/:articleId
     Returns: Total like count + user's like status (if authenticated)

POST /api/article-likes/:articleId
     Auth Required: Like or unlike article (toggle)
     Returns: Updated like count and status
```

#### Comments
```
GET  /api/comments?articleId=:id
     Returns: Nested comment threads with like counts (approved only)

POST /api/comments
     Auth Required | Rate Limited: 5/min
     Body: { articleId, content, parentId? }
     Returns: New comment

POST /api/comments/:commentId/like
     Auth Required: Like or unlike comment (toggle)
     Returns: Updated like count and status
```

#### Search & Discovery
```
GET  /api/search?q=:query&limit=10&offset=0
     Returns: Articles matching search query

GET  /api/related?articleId=:id&limit=3
     Returns: Related articles (by tags, then category)

GET  /api/trending?limit=5
     Returns: Top articles by view count
```

#### Content Browsing
```
GET  /api/authors
     Returns: All author profiles

GET  /api/authors/:slug
     Returns: Single author with stats

GET  /api/categories
     Returns: All categories

GET  /api/categories/:slug
     Returns: Single category

GET  /api/tags
     Returns: All tags ordered by popularity

GET  /api/tags/:slug
     Returns: Single tag with article count
```

#### Authentication
```
GET  /api/auth/google
     Redirects: Google OAuth login

GET  /api/auth/callback/google
     Callback: Returns access + refresh tokens

GET  /api/auth/me
     Auth Required
     Returns: Current user profile

POST /api/auth/signout
     Auth Required
     Revokes current token

POST /api/auth/refresh
     Body: { refreshToken }
     Returns: New access + refresh tokens

POST /api/auth/revoke
     Auth Required
     Revokes all user tokens (sign out everywhere)
```

#### Users
```
POST /api/users
     Body: { email, name, avatar_url, provider, provider_id, auth_secret }
     Returns: User data (creates if new)

GET  /api/users/me
     Auth Required
     Returns: Current user profile

GET  /api/users/:userId
     Auth Required: Can only access own profile (unless admin)
     Returns: User data

POST /api/users/lookup/email
     Auth Required: Can only lookup own email (unless admin)
     Body: { email }
     Returns: User ID and role

POST /api/users/invalidate-cache
     Auth Required
     Clears role cache for current user
```

---

### Admin Endpoints (Require Admin Role)

All admin routes require:
- Valid JWT access token
- `role: "admin"` in token payload
- Subject to admin rate limiting (200 req/min)

#### Admin Articles
```
GET    /api/admin/articles
       Returns: All articles (published + drafts)

GET    /api/admin/articles/:id
       Returns: Single article with tags
       Logs: VIEW_ARTICLE action

POST   /api/admin/articles
       Body: { title, slug, excerpt, content, tldr, image_url, author_id, 
               category_id, read_time, is_featured, is_published, tags[] }
       Returns: New article ID
       Logs: CREATE_ARTICLE action

PUT    /api/admin/articles/:id
       Body: Article fields to update + tags[]
       Auto-sets published_at_int when publishing
       Logs: UPDATE_ARTICLE action

PATCH  /api/admin/articles/:id/featured
       Body: { is_featured: boolean }
       Quick toggle for featured status
       Logs: FEATURE_ARTICLE or UNFEATURE_ARTICLE

DELETE /api/admin/articles/:id
       Cascades: Deletes article tags
       Logs: DELETE_ARTICLE action
```

#### Admin Comments
```
GET    /api/admin/comments?limit=50&offset=0&approved=all
       Query: approved (true/false/all)
       Returns: All comments with article metadata + total count

PUT    /api/admin/comments/:id
       Body: { content?, is_approved? }
       Returns: Success confirmation

DELETE /api/admin/comments/:id
       OR Body: { id } or { ids: [...] }
       Supports: Single or bulk delete
       Cascades: Deletes replies
```

#### Admin Authors
```
GET    /api/admin/authors
POST   /api/admin/authors
       Body: { name, slug, title, bio, avatar_url, expertise[], 
               twitter_url, linkedin_url, ... }
PUT    /api/admin/authors/:id
DELETE /api/admin/authors/:id
       OR Body: { ids: [...] }
```

#### Admin Categories
```
GET    /api/admin/categories
GET    /api/admin/categories/:id
POST   /api/admin/categories
       Body: { name, slug, description, color }
PUT    /api/admin/categories/:id
DELETE /api/admin/categories/:id
       OR Body: { ids: [...] }
```

#### Admin Tags
```
GET    /api/admin/tags
POST   /api/admin/tags
       Body: { name, slug }
PUT    /api/admin/tags/:id
DELETE /api/admin/tags/:id
       OR Body: { ids: [...] }
```

#### Admin Users
```
GET    /api/admin/users?limit=50&offset=0&search=
       Query: search (searches name + email)
       Returns: User list with pagination
```

---

## Authentication & Authorization

### OAuth Flow

1. **Initiate**: Frontend redirects to `/api/auth/google`
2. **Google Login**: User authenticates with Google
3. **Callback**: Google redirects to `/api/auth/callback/google`
4. **Auto-create**: Backend creates user if first login
5. **Tokens**: Frontend receives access + refresh tokens in URL params
6. **Store**: Frontend stores tokens securely (httpOnly cookies recommended)

### Token System

**Access Token** (1 hour lifespan)
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "name": "User Name",
  "role": "admin",
  "image": "https://...",
  "jti": "unique-token-id",
  "type": "access"
}
```

**Refresh Token** (7 days lifespan)
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "type": "refresh"
}
```

### Authorization Levels

| Level | Requirements | Endpoints |
|-------|-------------|-----------|
| **Public** | None | Articles, categories, authors, tags, search |
| **Authenticated** | Valid access token | Create comments, like content, view profile |
| **Admin** | `role: "admin"` in token | All `/api/admin/*` routes |

### Using Tokens

```bash
# Include access token in Authorization header
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     https://api.example.com/api/auth/me

# Refresh expired access token
curl -X POST https://api.example.com/api/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

### Security Mechanisms

- **Token Blacklist**: Revoked tokens stored in-memory with auto-cleanup
- **User Revocation**: Sign out all devices revokes all tokens globally
- **Role Cache**: User roles cached for 1 hour to reduce DB queries
- **Timing Safety**: Auth endpoints add delays to prevent user enumeration
- **Constant-time Comparison**: Secret validation uses timing-safe comparisons

---

## Security Features

### 1. Content Security

**HTML Sanitization** (DOMPurify)
- Comments: `<p>, <br>, <strong>, <em>, <a>` only
- Articles: Extended rich HTML (`<h1-6>, <table>, <img>, <blockquote>, <code>`)
- Strips: Scripts, event handlers, dangerous attributes
- Allows: Safe semantic HTML and links

**Input Validation** (Zod)
- Email: Max 255 chars, valid format, lowercase
- Search: Max 200 chars, SQL wildcard escaping
- Comments: 1-10,000 chars
- All query parameters validated before processing

**SQL Injection Prevention**
- 100% parameterized queries
- No string concatenation in SQL
- Escape wildcards in LIKE patterns

### 2. Network Security

**Helmet.js Security Headers**
```
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**CORS Policy**
- Whitelist-based origin validation
- Credentials support enabled
- Preflight request handling
- Blocks unknown origins in production

**Request Limits**
- Body size: 1MB max
- Rate limiting: See table below

### 3. Rate Limiting

| Type | Limit | Window | Applies To |
|------|-------|--------|------------|
| **Global** | 500 req | 1 minute | All IPs (excludes /health) |
| **Comments** | 5 posts | 1 minute | Create comment endpoint |
| **Admin** | 200 ops | 1 minute | All admin routes |
| **Auth** | 3 attempts | 15 minutes | Failed login attempts |
| **Write** | 20 ops | 1 minute | POST/PUT/DELETE endpoints |

All rate limiting is IP-based with Fly.io `fly-client-ip` header support.

### 4. Authentication Security

**JWT Secrets Management**
- Separate secrets for access and refresh tokens
- Fallback chain: `JWT_SECRET` → `NEXTAUTH_SECRET` → `JWT_REFRESH_SECRET`
- Production crashes if secrets missing
- Development warnings if using defaults

**CSRF Protection** (Optional)
- Token-based validation
- HttpOnly secure cookies
- Strict SameSite policy
- Middleware: `csrfProtection()`

**Timing Attack Prevention**
- Auth endpoints: +100ms minimum delay
- User creation: +150ms delay
- Constant-time secret comparison
- Prevents user enumeration via response timing

### 5. Audit Logging

All admin actions logged to `audit_logs` table:
```typescript
{
  user_id: string,
  user_email: string,
  action: "CREATE_ARTICLE" | "DELETE_COMMENT" | ...,
  resource: "article" | "comment" | ...,
  resource_id: string,
  details: JSON,
  ip_address: string,
  user_agent: string,
  success: boolean,
  created_at_int: number
}
```

Use cases:
- Compliance auditing
- Security investigation
- Debugging admin operations
- User activity tracking

---

## Database Structure

### Schema Overview

```
users
├── id (PK)
├── email, name, avatar_url, role
├── provider, provider_id (Google OAuth)
└── created_at_int, updated_at_int

articles
├── id (PK)
├── title, slug (unique), excerpt, content, tldr
├── image_url, image_alt_text, image_credits
├── author_id (FK → authors)
├── category_id (FK → categories)
├── read_time, view_count, like_count, comment_count
├── is_featured, is_published, published_at_int
├── word_count, keywords
└── created_at_int, updated_at_int

comments
├── id (PK)
├── article_id (FK → articles)
├── parent_id (FK → comments, for replies)
├── author_name, author_email, author_avatar
├── content, like_count, is_approved
└── created_at_int, updated_at_int

article_likes
├── id (PK)
├── article_id (FK → articles)
├── user_id (FK → users)
├── UNIQUE(article_id, user_id)
└── created_at_int

comment_likes
├── id (PK)
├── comment_id (FK → comments)
├── user_id (FK → users)
└── created_at

authors
├── id (PK)
├── name, slug (unique), title, bio
├── avatar_url, location, website, email
├── expertise (JSON array)
├── twitter_url, linkedin_url
├── article_count, follower_count, award_count
└── created_at_int, updated_at_int

categories
├── id (PK)
├── name, slug (unique), description
├── color (hex code for UI)
└── created_at_int, updated_at_int

tags
├── id (PK)
├── name, slug (unique)
├── article_count
└── created_at_int, updated_at_int

article_tags (many-to-many)
├── article_id (FK → articles)
└── tag_id (FK → tags)

audit_logs
├── id (PK)
├── user_id, user_email
├── action, resource, resource_id
├── details (JSON)
├── ip_address, user_agent
├── success (boolean)
└── created_at_int
```

### Key Relationships

- **Articles → Authors**: Many-to-one (each article has one author)
- **Articles → Categories**: Many-to-one (each article has one category)
- **Articles → Tags**: Many-to-many (via article_tags)
- **Comments → Articles**: Many-to-one (each comment belongs to one article)
- **Comments → Comments**: Self-referencing (replies via parent_id)
- **Likes → Articles/Comments**: Many-to-many with unique constraints

---

## Environment Configuration

### Required Variables

```env
# Database (Turso)
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# JWT Secrets (CRITICAL: Change in production)
JWT_SECRET=your-secret-key-minimum-32-chars
# Optional: Separate refresh token secret
JWT_REFRESH_SECRET=different-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_URL=http://localhost:3001  # Base URL for OAuth callbacks

# CORS (comma-separated)
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# User Creation Security
USER_CREATION_SECRET=shared-secret-between-frontend-and-backend

# Server
PORT=3001
NODE_ENV=production  # or development

# Rate Limiting (optional, defaults shown)
RATE_LIMIT_WINDOW_MS=60000          # 1 minute
RATE_LIMIT_MAX_REQUESTS=500         # 500 per window
```

### Optional Variables

```env
# CSRF Protection (if enabled)
CSRF_SECRET=your-csrf-secret

# Logging Level
LOG_LEVEL=info  # error, warn, info, debug

# Trust Proxy (for reverse proxies)
TRUST_PROXY=true
```

### Environment-Specific Configs

**Development**
```env
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
NEXTAUTH_URL=http://localhost:3001
```

**Production (Fly.io)**
```env
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com
NEXTAUTH_URL=https://api.yourdomain.com
TRUST_PROXY=true
```

---

## Deployment

### Fly.io Deployment

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Initialize app (follow prompts)
fly launch

# Set secrets (never commit these!)
fly secrets set TURSO_DATABASE_URL="libsql://..."
fly secrets set TURSO_AUTH_TOKEN="eyJh..."
fly secrets set JWT_SECRET="your-secret-key"
fly secrets set GOOGLE_CLIENT_ID="your-id"
fly secrets set GOOGLE_CLIENT_SECRET="your-secret"
fly secrets set ALLOWED_ORIGINS="https://yourdomain.com"
fly secrets set USER_CREATION_SECRET="shared-secret"
fly secrets set NODE_ENV="production"

# Deploy
fly deploy

# View logs
fly logs

# Check status
fly status

# Open dashboard
fly dashboard
```

### Docker Deployment

```bash
# Build image
docker build -t news-site-api .

# Run container
docker run -p 3001:3001 \
  -e TURSO_DATABASE_URL="libsql://..." \
  -e TURSO_AUTH_TOKEN="..." \
  -e JWT_SECRET="..." \
  -e GOOGLE_CLIENT_ID="..." \
  -e GOOGLE_CLIENT_SECRET="..." \
  -e ALLOWED_ORIGINS="https://yourdomain.com" \
  -e NODE_ENV="production" \
  news-site-api
```

### Health Monitoring

```bash
# Health check endpoint
curl https://api.yourdomain.com/health

# Expected response
{"status":"ok","timestamp":"2025-01-15T10:30:00.000Z"}
```

---

## Utilities

### Built-in Utility Scripts

**Create Admin User**
```bash
node make-admin.js <email>
# Promotes existing user to admin role
```

**Run Database Migrations**
```bash
node run-migration.js
# Executes pending database migrations
```

### Utility Functions

**Token Management** (`src/utils/tokens.ts`)
- `generateAccessToken(user)` - Create 1h access token
- `generateRefreshToken(user)` - Create 7d refresh token
- `verifyAccessToken(token)` - Validate + blacklist check
- `verifyRefreshToken(token)` - Validate refresh token
- `revokeToken(jti)` - Blacklist specific token
- `revokeUserTokens(userId)` - Revoke all user tokens

**Token Blacklist** (`src/utils/tokenBlacklist.ts`)
- In-memory store with auto-cleanup (every 5 minutes)
- `add(jti, expiration)` - Blacklist token
- `isBlacklisted(jti)` - Check if revoked
- `revokeUserTokens(userId)` - Global user revocation
- `isUserRevoked(userId)` - Check user revocation status

**Role Cache** (`src/utils/roleCache.ts`)
- In-memory cache (1 hour TTL)
- `get(userId)` - Fetch cached role
- `set(userId, role)` - Cache user role
- `invalidate(userId)` - Clear user's cache
- `clear()` - Clear all cache
- `getStats()` - Monitor cache performance

**Audit Logging** (`src/utils/auditLog.ts`)
- `logAdminAction(params)` - Record admin activity
- Non-blocking: Errors don't crash operations
- Logs: User, action, resource, IP, success status

**ID Generation** (`src/utils/generateId.ts`)
- `generateId(prefix)` - Format: `{prefix}-{timestamp}-{random}`
- Example: `article-1707234567890-k9l2m3n4`
- Ensures uniqueness, sortability, debuggability

---

## Project Structure

```
news-site-api/
├── src/
│   ├── config/
│   │   └── database.ts              # Turso connection singleton
│   ├── middleware/
│   │   ├── auth.ts                  # JWT validation & role checks
│   │   ├── rateLimit.ts             # Rate limiting configs
│   │   ├── validation.ts            # Zod schema validation
│   │   ├── sanitize.ts              # DOMPurify HTML sanitization
│   │   └── csrf.ts                  # CSRF token validation
│   ├── routes/
│   │   ├── articles.ts              # Public article endpoints
│   │   ├── comments.ts              # Comment CRUD + likes
│   │   ├── search.ts                # Full-text search
│   │   ├── related.ts               # Related articles
│   │   ├── trending.ts              # Trending by views
│   │   ├── authors.ts               # Author profiles
│   │   ├── categories.ts            # Category browsing
│   │   ├── tags.ts                  # Tag browsing
│   │   ├── auth.ts                  # OAuth + JWT endpoints
│   │   ├── users.ts                 # User management
│   │   └── admin/
│   │       ├── articles.ts          # Admin article management
│   │       ├── comments.ts          # Comment moderation
│   │       ├── authors.ts           # Author admin CRUD
│   │       ├── categories.ts        # Category admin CRUD
│   │       └── tags.ts              # Tag admin CRUD
│   ├── utils/
│   │   ├── tokens.ts                # JWT generation & validation
│   │   ├── tokenBlacklist.ts        # In-memory revocation store
│   │   ├── roleCache.ts             # Role caching service
│   │   ├── auditLog.ts              # Admin action logging
│   │   ├── generateId.ts            # Unique ID generator
│   │   └── errors.ts                # Custom error classes
│   ├── types/
│   │   └── index.ts                 # TypeScript interfaces
│   └── index.ts                     # Express app entry point
├── .env                             # Environment variables (gitignored)
├── .env.example                     # Template
├── Dockerfile                       # Container config
├── fly.toml                         # Fly.io deployment config
├── package.json
├── tsconfig.json
├── make-admin.js                    # Admin user creation utility
└── run-migration.js                 # Database migration runner
```

---

## API Response Formats

### Success Response
```json
{
  "article": { ... },
  "total": 42
}
```

### Error Response
```json
{
  "error": "Human-readable error message"
}
```

### Validation Error
```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": ["email"],
      "message": "Invalid email format"
    }
  ]
}
```

---

## Development Tips

### Testing Endpoints

```bash
# Get all articles
curl http://localhost:3001/api/articles?limit=5

# Search articles
curl http://localhost:3001/api/search?q=technology

# Create comment (requires auth)
curl -X POST http://localhost:3001/api/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"articleId":"article-123","content":"Great post!"}'

# Admin: Get all comments
curl http://localhost:3001/api/admin/comments \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Debugging

```bash
# Enable debug logs
LOG_LEVEL=debug npm run dev

# View token details (JWT.io)
echo "YOUR_TOKEN" | pbcopy
# Paste at https://jwt.io

# Check blacklist stats
# Add endpoint: GET /api/debug/blacklist-stats
```

### Common Issues

**"Invalid token"**
- Check token expiration (access tokens last 1 hour)
- Verify JWT_SECRET matches between frontend/backend
- Ensure token isn't blacklisted (check after signout)

**"403 Forbidden" on admin routes**
- Verify `role: "admin"` in token payload
- Use `make-admin.js <email>` to promote user
- Clear role cache: `POST /api/users/invalidate-cache`

**Rate limit errors**
- Check IP address extraction (Fly.io uses `fly-client-ip` header)
- Adjust limits in `.env` or `src/middleware/rateLimit.ts`

---

## Security Checklist

- [x] Database credentials never exposed to browser
- [x] All admin routes require authentication + admin role
- [x] JWT secrets stored securely (environment variables)
- [x] Input validation on all endpoints (Zod schemas)
- [x] HTML sanitization prevents XSS (DOMPurify)
- [x] SQL injection prevented (100% parameterized queries)
- [x] Rate limiting active (5 configs: global, auth, comment, admin, write)
- [x] CORS configured for specific origins
- [x] Security headers enabled (Helmet.js)
- [x] Timing attack prevention (auth endpoints)
- [x] Token blacklist with auto-cleanup
- [x] Audit logging for admin actions
- [x] User enumeration protection (constant-time responses)
- [x] Request size limits (1MB max)
- [x] Error handling doesn't leak sensitive info

---

## Performance Features

- **Database Connection Pooling**: Singleton Turso client with connection reuse
- **Role Caching**: 1-hour in-memory cache reduces DB queries
- **Token Blacklist Cleanup**: Auto-purges expired entries every 5 minutes
- **Efficient Queries**: Related articles use tag-first strategy
- **Query Optimization**: Indexed columns (slug, timestamps)
- **Result Streaming**: Supports large result sets

---

## License

This project is proprietary. See LICENSE file for details.

---

## Support & Resources

- **Turso Docs**: https://docs.turso.tech/
- **Express Docs**: https://expressjs.com/
- **Fly.io Docs**: https://fly.io/docs/
- **JWT Spec**: https://jwt.io/introduction
- **OAuth 2.0**: https://oauth.net/2/

---

**Your news platform backend is production-ready!** 🚀

For questions or issues, refer to the inline code documentation or check the audit logs for debugging admin operations.
