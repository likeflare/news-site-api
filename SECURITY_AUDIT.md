# Security Audit Report - Node.js Backend API

Date: October 5, 2025
Scope: Complete backend API security review

## CRITICAL Vulnerabilities Found

### 1. EMAIL EXPOSURE IN COMMENTS API - HIGH RISK
**Location:** src/routes/comments.ts

**Issue:** User emails are exposed in public comment responses
```typescript
SELECT c.author_email, c.author_name FROM comments c
```

**Attack:** Anyone can scrape all user emails from public articles
**Fix:** Remove author_email from SELECT in public routes

### 2. JWT SECRET REUSE - HIGH RISK  
**Location:** src/routes/auth.ts (refresh endpoint)

**Issue:** Same JWT_SECRET for access and refresh tokens
**Attack:** Compromised refresh token can forge new tokens
**Fix:** Use separate secrets for access/refresh tokens

### 3. USER ENUMERATION VIA TIMING - MEDIUM RISK
**Location:** src/routes/users.ts (POST endpoint)

**Issue:** Different response times for existing vs new users
**Attack:** Attacker can enumerate registered email addresses
**Fix:** Add constant-time delay to match response times

### 4. WEAK CORS CONFIGURATION - MEDIUM RISK
**Location:** src/index.ts

**Issue:** Wildcard origin (*) with credentials=true in non-production
```typescript
if (process.env.NODE_ENV !== "production") {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Credentials", "true");
}
```

**Attack:** CSRF attacks, token theft
**Fix:** Strict origin validation, no wildcards with credentials

### 5. NO TOKEN REVOCATION - MEDIUM RISK

**Issue:** No mechanism to invalidate tokens before expiry
**Attack:** Stolen tokens work until natural expiration
**Fix:** Implement token blacklist or refresh token rotation

## What's Secure (Good!)

1. ✅ Parameterized queries (no SQL injection)
2. ✅ Input validation with Zod schemas
3. ✅ HTML sanitization with DOMPurify
4. ✅ Rate limiting on all endpoints
5. ✅ Timing-safe secret comparison
6. ✅ Role-based access control
7. ✅ Helmet security headers
8. ✅ OAuth-only (no passwords)

## Immediate Action Required

1. Remove author_email from comment SELECT (1 hour)
2. Add timing delay to user creation (1 hour)  
3. Separate JWT secrets (4 hours)
4. Fix CORS configuration (3 hours)
5. Implement token revocation (8 hours)

## Risk Level: 7.5/10 (Good but needs fixes)

Email exposure is actively leaking PII and must be fixed immediately.
