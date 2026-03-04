# BUG_REPORT.md

## 1) Executive Summary

### Issue counts
- Critical: 1
- High: 6
- Medium: 7
- Low: 2

### Top 10 dangerous issues
1. Hardcoded JWT secret in compose config.
2. Unhandled parser/size errors returning 500 for client input errors.
3. No brute-force protection / account lockout.
4. Concurrency on relationship writes causes 500s (`Prisma P1008`).
5. Missing security headers + permissive CORS.
6. Token stored in `localStorage`.
7. Backend integration tests failing in core history/relationship logic.
8. Frontend unit tests failing (`ref` runtime + stale expectations).
9. Lint/build pipeline not reproducible in current setup.
10. Containerized QA blind spots (frontend container has no tests; backend container lacks sources for lint patterns).

### Biggest reliability risks
- Write contention causes hard 500 errors.
- Error handler collapses many recoverable client errors to 500.
- CI/tooling instability hides regressions.

### Biggest security risks
- Hardcoded secret.
- No rate limiting.
- Missing hardening headers / broad CORS.
- Token exposure risk from localStorage.

### Biggest data-integrity risks
- Service-level dedupe without DB unique guard for relationships.
- Failing integration tests around rollback/relationship rules indicate invariants may drift.

---

## 2) Coverage Summary

- Components covered:
  - Backend routes/controllers/services/middleware
  - Prisma schema/migrations/seed
  - Frontend major pages/components/stores/api client
  - Docker runtime and smoke flow
- Endpoints covered count: 25 inventoried; 18 directly exercised in probes/smoke/tests
- Pages covered count: 10 inventoried; smoke/API-level verification plus unit-test-level coverage
- Roles tested: unauthenticated, owner, member, outsider
- Integrations tested: local AI path config reviewed; no external provider live calls executed
- Could not fully test:
  - Full browser E2E cross-browser matrix (no Cypress/Playwright suite available)
  - Internet-based dependency CVE scan (network DNS blocked in audit env)
  - True 10M-scale load test (environment limitations)

---

## 3) Findings

### Issue ID: SEC-001
- Severity: Critical
- Type: Security | Config/Deploy
- Component: Deployment config
- Location: `docker-compose.yml:10`
- Environment: Darwin 25.3.0, Node 22.18.0, commit `e466e41`
- Preconditions: none
- Steps to Reproduce:
  1. Open `docker-compose.yml`.
  2. Inspect backend environment variables.
- Expected: secret injected from secure env/secret manager, not checked in plaintext.
- Actual: `JWT_SECRET: enterprise-secret-key` hardcoded.
- Evidence: static file content.
- Impact: token forgery risk if config leaks.
- Suspected Root Cause: insecure default configuration committed to repo.
- Related Tests: `SEC-001`
- Workaround: rotate secrets externally and avoid committed values.

### Issue ID: SEC-002
- Severity: High
- Type: Security
- Component: Auth service
- Location: `backend/src/app.ts:11`, `backend/src/application/services/AuthService.ts`
- Preconditions: backend running
- Steps:
  1. Run repeated invalid login attempts.
  2. Observe 10 failed logins then one valid login succeeds immediately.
- Expected: lockout/throttling/challenge after repeated failures.
- Actual: repeated 401s, then immediate success (`200`) with no delay or lockout.
- Evidence: brute-force probe output.
- Impact: credential stuffing/brute-force risk.
- Suspected Root Cause: no rate limiter/lockout middleware.
- Related Tests: `SEC-010..SEC-020`
- Workaround: network-level rate limiting.

### Issue ID: BUG-001
- Severity: High
- Type: Reliability
- Component: Error handling
- Location: `backend/src/interface/http/middleware/errorHandler.ts:5`
- Preconditions: backend running
- Steps:
  1. Send malformed JSON to `/auth/login`.
  2. Observe response.
- Expected: `400 Bad Request` with parse error details.
- Actual: `500 Internal Server Error`.
- Evidence: malformed JSON request returned 500.
- Impact: client input errors inflate as server faults; monitoring noise and poor UX.
- Suspected Root Cause: non-`AppError` parser errors not mapped by middleware.
- Related Tests: `API-072`, `SEC-062`
- Workaround: none at runtime.

### Issue ID: BUG-002
- Severity: High
- Type: Reliability
- Component: Request size handling
- Location: `backend/src/app.ts:12`, `backend/src/interface/http/middleware/errorHandler.ts:5`
- Preconditions: backend running
- Steps:
  1. Send >1MB JSON payload to `/auth/login`.
- Expected: `413 Payload Too Large`.
- Actual: `500 Internal Server Error`.
- Evidence: oversized payload probe returned status `500`.
- Impact: hides abuse patterns; prevents proper client/backoff behavior.
- Suspected Root Cause: body-parser error classes not explicitly handled.
- Related Tests: `API-073`, `SEC-063`
- Workaround: edge proxy payload limits with explicit responses.

### Issue ID: REL-001
- Severity: High
- Type: Reliability | Performance
- Component: Relationship write path
- Location: `backend/src/application/services/FamilyService.ts:490`, `backend/prisma/schema.prisma:133`
- Preconditions: owner token and family with two people
- Steps:
  1. Run parallel identical relationship-create requests.
- Expected: deterministic idempotent behavior (one success, others clean 4xx).
- Actual: mixed `201/400/500`; backend logs show `Prisma P1008`.
- Evidence: concurrency probe output + backend logs.
- Impact: concurrent traffic can cause user-visible 500s and failed writes.
- Suspected Root Cause: SQLite lock contention + no DB-level uniqueness/idempotency guard + transactional contention.
- Related Tests: `CON-001..CON-015`, `PERF-061..PERF-070`
- Workaround: serialize writes at API gateway (temporary).

### Issue ID: SEC-003
- Severity: High
- Type: Security
- Component: HTTP hardening
- Location: `backend/src/app.ts:11`
- Preconditions: backend running
- Steps:
  1. Send CORS preflight from arbitrary origin.
  2. Inspect response headers.
- Expected: restricted origins + hardened headers.
- Actual:
  - `Access-Control-Allow-Origin: *`
  - Missing CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy
- Evidence: response headers.
- Impact: broader browser attack surface.
- Suspected Root Cause: permissive default `cors()` and no hardening middleware.
- Related Tests: `SEC-091..SEC-110`
- Workaround: enforce at reverse proxy.

### Issue ID: SEC-004
- Severity: Medium
- Type: Security
- Component: Frontend auth storage
- Location: `frontend/stores/auth.ts:33`
- Preconditions: logged-in browser session
- Steps:
  1. Inspect auth store.
- Expected: minimize token exposure (prefer hardened cookie/session patterns).
- Actual: JWT persisted in `localStorage`.
- Evidence: code lines 33-37 and restore lines 42-46.
- Impact: XSS can exfiltrate tokens.
- Suspected Root Cause: client-side token persistence strategy.
- Related Tests: `SEC-115..SEC-120`
- Workaround: shorten token lifetime and CSP hardening.

### Issue ID: BUG-003
- Severity: High
- Type: Bug | Testability
- Component: Backend integration quality gate
- Location: `backend/tests/integration/relationshipValidation.test.ts:84`, `backend/tests/integration/rollbackIntegrity.test.ts:68`
- Preconditions: run backend tests in container
- Steps:
  1. Execute backend tests.
- Expected: all integration tests pass.
- Actual: 2 suites fail:
  - cycle update expected 400 got 200
  - rollback integrity expected `['P1']` got `['P One']`
- Evidence: Jest output.
- Impact: core invariants not trusted; release risk.
- Suspected Root Cause: regression or stale assertions against current behavior.
- Related Tests: `DATA-090`, `DATA-101`
- Workaround: mandatory manual regression for these flows.

### Issue ID: BUG-004
- Severity: Medium
- Type: Bug | Testability
- Component: Frontend unit tests
- Location: `frontend/components/ProposalManagement.vue:247`, `frontend/tests/versionTimeline.test.ts:26`
- Preconditions: run frontend tests
- Steps:
  1. Execute frontend tests.
- Expected: tests pass.
- Actual:
  - `ReferenceError: ref is not defined` in `ProposalManagement.vue`
  - VersionTimeline test cannot find `Rollback`
- Evidence: Vitest output and stack traces.
- Impact: frontend regression detection is broken.
- Suspected Root Cause: test harness + component changes out of sync.
- Related Tests: `UI-001..UI-010`
- Workaround: rely on smoke/manual checks only (limited).

### Issue ID: BUG-005
- Severity: Medium
- Type: Config/Deploy
- Component: Frontend lint config
- Location: `frontend/eslint.config.js:1`
- Preconditions: run frontend lint
- Steps:
  1. Execute lint command.
- Expected: lint runs.
- Actual: ESLint fails: `module is not defined in ES module scope`.
- Evidence: lint output.
- Impact: static analysis gate disabled.
- Suspected Root Cause: CJS export in ESM package without `.cjs`.
- Related Tests: `UI-245`
- Workaround: none in current pipeline.

### Issue ID: BUG-006
- Severity: Medium
- Type: Config/Deploy
- Component: Backend lint/build toolchain
- Location: `backend/eslint.config.js`, `backend/tsconfig.json`
- Preconditions: run local lint/build
- Steps:
  1. `npm run lint -w backend`
  2. `npm run build -w backend`
- Expected: successful lint/build.
- Actual:
  - missing `@typescript-eslint/parser`
  - missing type defs (`jest`)
- Evidence: command outputs.
- Impact: local/CI reproducibility risk; broken quality gates.
- Suspected Root Cause: incomplete install state + fragile toolchain assumptions.
- Related Tests: `API-249`, `DATA-149`
- Workaround: run backend tests inside container only (partial).

### Issue ID: REL-002
- Severity: Medium
- Type: Reliability | CI/CD
- Component: Docker runtime QA path
- Location: runtime behavior (`docker-compose exec`)
- Preconditions: containers running
- Steps:
  1. Run frontend tests in container.
  2. Run backend lint in container.
- Expected: containerized QA commands usable.
- Actual:
  - frontend container: “No test files found”
  - backend container: lint pattern finds no `src/**/*.ts`
- Evidence: command outputs.
- Impact: production-like environment cannot run full quality gates.
- Suspected Root Cause: container image contents differ from dev/test expectations.
- Related Tests: `UI-250`, `API-250`
- Workaround: run tests from host workspace.

### Issue ID: PERF-001
- Severity: Medium
- Type: Performance
- Component: Frontend bundle
- Location: frontend build artifacts (Nuxt output)
- Preconditions: run frontend build
- Steps:
  1. Build frontend.
- Expected: no severe chunk warnings for core app payload.
- Actual: warning for chunks >500kB; client chunk ~785kB.
- Evidence: build output warning and sizes.
- Impact: slower initial load/time-to-interactive on weaker networks/devices.
- Suspected Root Cause: insufficient code-splitting and heavy dependency aggregation.
- Related Tests: `PERF-081..PERF-090`
- Workaround: CDN + caching mitigations only.

### Issue ID: SEC-005
- Severity: Low
- Type: Security | Information disclosure
- Component: Membership authorization responses
- Location: `backend/src/application/services/FamilyService.ts:765`
- Preconditions: outsider token + familyId
- Steps:
  1. Call protected family endpoints as outsider.
- Expected: generic unauthorized/forbidden without membership detail.
- Actual: `404 {"message":"User is not a member of this family"}`.
- Evidence: auth matrix probe output.
- Impact: minor information leakage of membership model.
- Suspected Root Cause: explicit NotFound message.
- Related Tests: `SEC-040..SEC-055`
- Workaround: sanitize message at API gateway.

### Issue ID: CONFIG-001
- Severity: Low
- Type: Config/Deploy
- Component: Dependency security audit process
- Location: package/audit execution path
- Preconditions: run `npm audit` locally/in container
- Steps:
  1. Local `npm audit --omit=dev --json`
  2. Container `npm audit --omit=dev --json`
- Expected: actionable vulnerability report.
- Actual:
  - local blocked by DNS/network (`ENOTFOUND registry.npmjs.org`)
  - backend container blocked by missing lockfile (`ENOLOCK`)
- Evidence: command outputs.
- Impact: CVE visibility gap.
- Suspected Root Cause: environment/network + container package-lock omission.
- Related Tests: `SEC-131..SEC-150`
- Workaround: run audit in connected CI with lockfiles.

---

## 4) Test Matrix Appendix (executed subset status)

- PASS: `API-001`, `API-017`, `API-018`, `API-044`, `API-045`, `API-207`, `PERF-001`, `DATA-081`
- FAIL: `API-072`, `API-073`, `API-153`, `SEC-001`, `SEC-010`, `SEC-021`, `SEC-030`, `DATA-090`, `DATA-101`, `UI-001`, `UI-002`, `UI-003`
- BLOCKED: `SEC-131..SEC-150` (full internet CVE checks), many browser/cross-browser tests (no e2e harness)

---

## 5) Recommendations (non-fixing)

1. Enforce release gates that require passing backend+frontend tests and lints before deploy.
2. Add centralized error translation for body-parser and payload-size errors to avoid false 500s.
3. Add auth rate limiting / lockout / abuse telemetry.
4. Add DB constraints/idempotency strategy for relationship writes under concurrency.
5. Add security hardening middleware and strict CORS policy.
6. Move secrets to external secret management and rotate existing secret.
7. Align container images with QA needs (include test files/tooling or dedicated test image).
8. Establish regular dependency audit in connected CI and publish SBOM/vuln reports.
9. Expand automated browser E2E (playwright/cypress) for rollback/proposals/history flows.
10. Add structured observability for lock timeout, rollback anomalies, and proposal conflicts.
