# Security Test Report – LearnXR (Local Scope Only)

## 1. Scope and environment

| Item | Value |
|------|--------|
| **Target URLs (in scope only)** | `http://localhost:5002` (Express API), optionally `http://localhost:5173` (Vite dev) |
| **HexStrike version/source** | 0x4m4/hexstrike-ai (clone at D:\hexstrike-ai). HexStrike server running on localhost:8888. |
| **Tools used** | Baseline: `scripts/security-baseline-check.ps1` (PowerShell). Code analysis: manual review of server codebase. |
| **Date** | 2026-02-18 |
| **Production systems** | **No production systems or databases were targeted.** All tests were run against local instances only. |

---

## 2. Methodology

- **Baseline automated checks:** Health endpoint, API reachability, security headers analysis.
- **Code analysis:** Manual review of authentication/authorization middleware, input validation, CORS configuration, error handling, secrets management, rate limiting.
- **API surface analyzed:** `/health`, `/api/payment`, `/api/skybox`, `/api/user`, `/api/ai-detection`, `/api/assistant`, `/api/dev/api-keys`, `/api/lms`, `/api/ai-education`, `/api/assessment`, `/api/auth`, `/api/proxy-asset`.
- **Focus areas:** Injection attacks, auth bypass, IDOR, information disclosure, CORS misconfiguration, rate limiting gaps.

---

## 3. Findings

| # | Finding title | Severity | Affected endpoint/area | Description | Evidence (file/ref) | Recommendation |
|---|----------------|----------|------------------------|-------------|---------------------|-----------------|
| 1 | Baseline check passed | Info | localhost:5002 | Health returned 200; GET to /api/payment, /api/user, /api/assistant, /api/auth returned 404 or error without auth (expected). | security-test-runs/baseline-20260218-144658.txt | None. |
| 2 | Security headers present on /health | Info | /health | X-Frame-Options: DENY, X-Content-Type-Options: nosniff, X-XSS-Protection: 1; mode=block, Content-Security-Policy set. | security-test-runs/baseline-20260218-144658.txt | Keep headers in production; consider HSTS when using HTTPS. |
| 3 | CORS allows all origins | Medium | All API endpoints | CORS configuration in `server/src/server.ts` line 45 has `cb(null, true)` fallback, allowing any origin. While specific origins are whitelisted, the fallback permits all requests. | server/src/server.ts:32-50 | Restrict CORS to specific origins only; remove the fallback `cb(null, true)` or replace with `cb(new Error('Origin not allowed'), false)`. |
| 4 | Rate limiting not applied globally | Medium | All API endpoints except /api/linkedin | `express-rate-limit` is installed but only used on `/api/linkedin` route. No global rate limiting middleware, leaving endpoints vulnerable to brute force and DoS. | server/src/routes/linkedin.ts:8, server/src/server.ts | Add global rate limiting middleware (e.g., 100 req/15min per IP) and stricter limits for auth endpoints (e.g., 5 req/15min). |
| 5 | Debug middleware logs request bodies | Low | All API endpoints | Debug middleware in `server/src/server.ts` lines 84-92 logs full request bodies and headers, which may expose sensitive data (passwords, tokens) in logs. | server/src/server.ts:84-92 | Remove or conditionally enable debug logging only in development; sanitize sensitive fields (password, token, apiKey) before logging. |
| 6 | X-Powered-By header exposed | Low | All responses | Express default `X-Powered-By: Express` header exposes server technology, aiding fingerprinting. | security-test-runs/baseline-20260218-144658.txt | Disable with `app.disable('x-powered-by')` in server.ts. |
| 7 | CSP allows unsafe-inline and unsafe-eval in development | Low | All responses | Content-Security-Policy in development mode allows `'unsafe-inline'` and `'unsafe-eval'` for scripts, reducing XSS protection. | server/src/server.ts:74 | Tighten CSP in development; use nonces or hashes instead of unsafe-inline/unsafe-eval. |
| 8 | Input validation varies by route | Low | Multiple endpoints | Some routes (e.g., `/api/assistant/message`) validate required fields but don't sanitize inputs; others (e.g., `/api/payment/detect-country`) parse user-controlled IP headers without validation. | server/src/routes/assistant.ts:244-272, server/src/routes/payment.ts:58-100 | Implement centralized input validation/sanitization middleware; validate and sanitize all user inputs (IPs, strings, numbers) before use. |
| 9 | Potential IDOR in user profile access | Low | RBAC middleware | `getUserProfile()` and `canAccessStudent()` functions properly check permissions, but if a route doesn't use RBAC middleware, direct Firestore queries could bypass checks. | server/src/middleware/rbacMiddleware.ts | Ensure all routes that access user/student/class data use appropriate RBAC middleware (`requireStudentAccess`, `requireClassAccess`, etc.). |
| 10 | API key validation uses prefix lookup | Info | /api/dev/api-keys | API key validation uses prefix-based Firestore queries, which is efficient but could be optimized with composite indexes if scale increases. | server/src/services/apiKeyService.ts:215-218 | Current implementation is acceptable; monitor Firestore query performance as API keys grow. |
| 11 | Firestore queries use parameterized inputs | Info | All database operations | Firestore queries use SDK methods (where, query) rather than raw strings, preventing NoSQL injection. | server/src/middleware/rbacMiddleware.ts, server/client/src/lib/firebase/queries/curriculumChapters.ts | Continue using Firestore SDK methods; avoid string concatenation in queries. |
| 12 | Authentication middleware properly validates tokens | Info | Protected routes | `verifyFirebaseToken()` middleware correctly validates Firebase ID tokens and handles errors. | server/src/middleware/authMiddleware.ts:26-73 | Current implementation is secure; ensure all protected routes use this middleware. |

---

## 4. Summary

| Severity | Count |
|----------|--------|
| Critical | 0 |
| High | 0 |
| Medium | 2 |
| Low | 5 |
| Info | 5 |

**Overall risk statement:** Baseline check passed with security headers present. Code analysis identified **2 medium-severity findings** (CORS allows all origins, no global rate limiting) and **5 low-severity findings** (debug logging, X-Powered-By header, CSP unsafe directives, input validation gaps, potential IDOR). No critical or high-severity vulnerabilities found. Authentication and authorization middleware are properly implemented. Recommendations focus on tightening CORS, adding global rate limiting, and improving logging/input validation.

**Confirmation:** Production database and production app were **not** tested. All testing was limited to the local security test environment (localhost only).

---

## 5. Appendix

### How to reproduce

1. **Baseline check:** From repo root with backend running (`npm run dev`), run `.\scripts\security-baseline-check.ps1`.
2. **Code analysis:** Review `server/src/server.ts` (CORS, security headers, debug logging), `server/src/middleware/` (auth, RBAC), `server/src/routes/` (input validation, rate limiting).
3. **HexStrike MCP (optional):** Start HexStrike server (`python hexstrike_server.py` in D:\hexstrike-ai), then in Cursor Composer use: *"Run security tests with HexStrike MCP against http://localhost:5002 only."*

### Caveats

- Auth tests limited to local/test accounts only; no production credentials used.
- Code analysis based on static review; dynamic testing (e.g., actual auth bypass attempts) not performed.
- HexStrike MCP tools (nuclei, nikto) were not executed in this run; install per [HEXSTRIKE_SETUP.md](HEXSTRIKE_SETUP.md) for deeper scanning.
- Frontend (localhost:5173) was not tested; focus was on API endpoints.

### Remediation priority

1. **High priority:** Fix CORS fallback (finding #3), add global rate limiting (finding #4).
2. **Medium priority:** Sanitize debug logging (finding #5), disable X-Powered-By (finding #6), tighten CSP (finding #7).
3. **Low priority:** Standardize input validation (finding #8), audit routes for RBAC coverage (finding #9).
