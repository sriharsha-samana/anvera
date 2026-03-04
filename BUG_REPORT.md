# BUG_REPORT.md

## 1) Executive Summary

### Issue counts
- Critical: 1
- High: 7
- Medium: 8
- Low: 2

### Top 10 dangerous issues
1. Hardcoded JWT secret in committed compose config.
2. Parser and payload-limit errors return 500 instead of 4xx.
3. No brute-force throttling/lockout on auth endpoints.
4. Relationship write contention returns 500 (`Prisma P1008`).
5. Security headers absent and CORS allows `*`.
6. Frontend auth token persisted in `localStorage`.
7. Backend integration tests failing in core flows (auth/family/rollback).
8. Frontend unit tests failing with runtime/test drift.
9. `prisma:deploy` script unusable without explicit `DATABASE_URL`.
10. High-severity `xlsx` vulnerability present in production dependency tree.

### Biggest reliability risks
- Concurrent writes generate 500s and lock timeouts.
- Error normalization collapses recoverable client errors into 500s.
- Test suite instability prevents reliable pre-release signal.

### Biggest security risks
- Static secret in repo.
- No brute-force defense.
- Permissive CORS + missing browser hardening headers.
- Token exposure via localStorage.

### Biggest data-integrity risks
- Concurrency handling produces failed writes and partial outcomes.
- Integration failures on rollback/family creation path indicate invariant drift.

## 2) Coverage Summary
- Components covered:
  - Backend app/middleware/controllers/services
  - Prisma schema/migrations and runtime migration state
  - Frontend routes/components/auth store
  - Docker runtime/build/startup behavior
- Endpoints covered count: 25 inventoried; 20 directly exercised.
- Pages covered count: 10 inventoried; smoke/structural + unit-test-level checks.
- Roles tested: unauthenticated, owner, member, outsider.
- Integrations tested: local AI provider paths by static review; no external paid provider live calls.
- Could not fully test:
  - Browser-level cross-browser E2E (no Playwright/Cypress suite)
  - Full 10M-scale load and soak (env constraints)
  - Full external CVE enrichment beyond local npm audit metadata

## 3) Findings

### Issue ID: SEC-001
- Severity: Critical
- Type: Security | Config/Deploy
- Component: Deployment config
- Location: `docker-compose.yml:10`
- Environment: Darwin 25.3.0, Node 22.18.0, npm 10.9.3, commit `d2d9c1e`
- Preconditions: none
- Steps to Reproduce:
  1. Open `docker-compose.yml`.
  2. Inspect `backend.environment.JWT_SECRET`.
- Expected: secret sourced from secure env/secret manager.
- Actual: hardcoded `enterprise-secret-key` in repo.
- Evidence: static file content.
- Impact: secret disclosure enables JWT forgery if config leaks.
- Suspected Root Cause: insecure default committed to source.
- Related Tests: `SEC-001`, `SEC-090`
- Workaround: inject/rotate secret externally before deployment.

### Issue ID: BUG-001
- Severity: High
- Type: Reliability
- Component: Error handler
- Location: `backend/src/interface/http/middleware/errorHandler.ts`
- Environment: same as above; backend container running
- Preconditions: backend running
- Steps to Reproduce:
  1. Send malformed JSON body to `POST /auth/login`.
  2. Observe response.
- Expected: `400 Bad Request` parse error.
- Actual: `500 Internal server error`.
- Evidence:
  - Probe output: `status 500 {"message":"Internal server error"}`
  - Logs include `entity.parse.failed` logged as unhandled.
- Impact: client errors treated as server faults; noisy alerts and poor UX.
- Suspected Root Cause: non-AppError parser exceptions not mapped.
- Related Tests: `API-072`, `SEC-020`
- Workaround: edge validation/proxy normalization.

### Issue ID: BUG-002
- Severity: High
- Type: Reliability
- Component: Request size handling
- Location: `backend/src/app.ts`, `errorHandler.ts`
- Preconditions: backend running
- Steps:
  1. Send >1MB JSON payload to `POST /auth/login`.
- Expected: `413 Payload Too Large`.
- Actual: `500 Internal server error`.
- Evidence:
  - Probe output: `status 500`.
  - Logs include `entity.too.large` as unhandled.
- Impact: abuse traffic indistinguishable from internal faults.
- Suspected Root Cause: body-parser limit errors not translated.
- Related Tests: `API-073`, `SEC-021`
- Workaround: enforce upstream payload limits with explicit 413.

### Issue ID: SEC-002
- Severity: High
- Type: Security
- Component: Auth endpoint protections
- Location: `backend/src/application/services/AuthService.ts`, `backend/src/app.ts`
- Preconditions: valid user exists
- Steps:
  1. Attempt 12 failed logins for same account.
  2. Immediately login with correct password.
- Expected: lockout/throttle/challenge after repeated failures.
- Actual: immediate success after repeated failures (`200`).
- Evidence: probe output `success_after_failures 200`.
- Impact: brute-force and credential stuffing risk.
- Suspected Root Cause: no rate limiter or lockout policy.
- Related Tests: `SEC-034..SEC-050`
- Workaround: network/WAF throttling.

### Issue ID: SEC-003
- Severity: High
- Type: Security
- Component: CORS + security headers
- Location: `backend/src/app.ts`
- Preconditions: backend running
- Steps:
  1. Send CORS preflight with foreign origin.
  2. Inspect headers.
- Expected: restricted origins and hardening headers.
- Actual:
  - `access-control-allow-origin: *`
  - Missing `X-Frame-Options`, `Content-Security-Policy`, `HSTS`.
- Evidence: preflight probe output `acao *`, `xfo null`, `csp null`.
- Impact: increased browser attack surface.
- Suspected Root Cause: permissive `cors()` default, no hardening middleware.
- Related Tests: `SEC-090..SEC-110`
- Workaround: reverse-proxy header/CORS policy.

### Issue ID: REL-001
- Severity: High
- Type: Reliability | Performance
- Component: Relationship writes under concurrency
- Location: `backend/src/application/services/FamilyService.ts` relationship create path
- Preconditions: owner token and two persons in family
- Steps:
  1. Fire 12 parallel identical relationship create requests.
- Expected: deterministic idempotent conflict handling, no 500s.
- Actual: mixed `201/400/500` results.
- Evidence:
  - Probe: `status_counts {"201":1,"400":6,"500":5}`
  - Backend logs show repeated `PrismaClientKnownRequestError code P1008`.
- Impact: user-visible failures and inconsistent behavior during concurrent traffic.
- Suspected Root Cause: SQLite lock contention + insufficient idempotent guard path.
- Related Tests: `CON-012`, `CON-018`, `PERF-040`
- Workaround: serialize writes or queue mutations.

### Issue ID: SEC-004
- Severity: Medium
- Type: Security
- Component: Frontend auth storage
- Location: `frontend/stores/auth.ts:33-46`
- Preconditions: authenticated browser session
- Steps:
  1. Inspect auth store implementation.
- Expected: minimally exposed token strategy.
- Actual: JWT and identity attributes persisted in `localStorage`.
- Evidence: code references `localStorage.setItem('fg_token', token)`.
- Impact: XSS can exfiltrate long-lived tokens.
- Suspected Root Cause: client-side persistence design.
- Related Tests: `SEC-120..SEC-130`
- Workaround: short token TTL + strict CSP.

### Issue ID: BUG-003
- Severity: High
- Type: Bug | Testability
- Component: Backend integration tests
- Location: multiple suites
- Preconditions: `npm run test -w backend`
- Steps:
  1. Run backend tests.
- Expected: green suite.
- Actual: 4 suites fail (e.g., 401 auth mismatches, FK failure, rollback flow failure).
- Evidence:
  - `rollbackIntegrity.test.ts` FK violation in `FamilyService.createFamily`
  - `relationshipValidation.test.ts`, `aiAsk.test.ts`, `api.test.ts` expect 200, got 401.
- Impact: release quality gate unreliable; core behaviors untrusted.
- Suspected Root Cause: test fixtures/credentials/state drift vs current logic.
- Related Tests: `API-150..API-210`, `DATA-071`
- Workaround: manual regression for affected flows.

### Issue ID: BUG-004
- Severity: Medium
- Type: Bug | Testability
- Component: Frontend unit tests
- Location: `frontend/components/ProposalManagement.vue`, `frontend/tests/versionTimeline.test.ts`
- Preconditions: `npm run test -w frontend`
- Steps:
  1. Run frontend tests.
- Expected: green tests.
- Actual:
  - `ReferenceError: ref is not defined` in `ProposalManagement.vue` setup.
  - Timeline test fails to find `Rollback` control and has prop mismatch warning.
- Evidence: Vitest stack traces and warnings.
- Impact: UI regression detection is broken.
- Suspected Root Cause: component/test harness drift.
- Related Tests: `UI-001`, `UI-017`, `UI-041`
- Workaround: manual UI smoke only.

### Issue ID: BUG-005
- Severity: Medium
- Type: Config/Deploy
- Component: Backend script ergonomics
- Location: `backend/package.json` (`prisma:deploy`)
- Preconditions: run from workspace without `DATABASE_URL`
- Steps:
  1. Execute `npm run prisma:deploy -w backend`.
- Expected: either documented env requirement surfaced or script works with default.
- Actual: hard failure `P1012 Environment variable not found: DATABASE_URL`.
- Evidence: CLI output captured in automated checks.
- Impact: CI/local deployment fragility.
- Suspected Root Cause: script omits required env wiring.
- Related Tests: `DATA-033`
- Workaround: set `DATABASE_URL` explicitly before command.

### Issue ID: PERF-001
- Severity: Medium
- Type: Performance
- Component: Frontend bundle
- Location: Nuxt build artifacts
- Preconditions: frontend build
- Steps:
  1. Run `npm run build`.
- Expected: no major chunk warning for critical app payload.
- Actual: chunk warning; main client chunk around `785.38 kB`.
- Evidence: build warning output.
- Impact: slower load/TTI on constrained clients.
- Suspected Root Cause: insufficient code splitting/dependency aggregation.
- Related Tests: `PERF-030..PERF-045`
- Workaround: aggressive caching/CDN.

### Issue ID: SEC-005
- Severity: Medium
- Type: Security | Supply Chain
- Component: Dependency set
- Location: `frontend/package.json` (`xlsx`)
- Preconditions: `npm audit --omit=dev --json`
- Steps:
  1. Run production dependency audit.
- Expected: no high vulnerabilities.
- Actual: `xlsx` flagged high severity (Prototype Pollution, ReDoS).
- Evidence: audit JSON shows advisories `GHSA-4r6h-8v6p-xvw6`, `GHSA-5pgg-2g8v-p4x9`.
- Impact: exploitable parsing surface depending on feature exposure.
- Suspected Root Cause: vulnerable pinned range (`xlsx@0.18.5`).
- Related Tests: `SEC-140..SEC-150`
- Workaround: isolate and tightly constrain file import/export paths.

### Issue ID: SEC-006
- Severity: Low
- Type: Security | Info Disclosure
- Component: Authorization response messaging
- Location: `FamilyService.ensureFamilyMembership`
- Preconditions: outsider token + valid family id
- Steps:
  1. Query family endpoint as outsider.
- Expected: generic forbidden/unauthorized message.
- Actual: `404 {"message":"User is not a member of this family"}`.
- Evidence: authz probe output.
- Impact: minor membership model disclosure.
- Suspected Root Cause: explicit NotFoundError message.
- Related Tests: `SEC-060`
- Workaround: sanitize error messaging layer.

### Issue ID: REL-002
- Severity: Medium
- Type: Reliability
- Component: Seed/test data assumptions
- Location: test suites + running DB state
- Preconditions: backend DB with existing records
- Steps:
  1. Execute backend integration tests with shared db.
- Expected: isolated, deterministic tests.
- Actual: auth and FK-related test failures vary with runtime state.
- Evidence: mixed pass/fail suite behavior across runs.
- Impact: flaky CI and confidence erosion.
- Suspected Root Cause: coupling between tests and mutable local DB/user fixtures.
- Related Tests: `DATA-001..DATA-020`
- Workaround: dedicated ephemeral test DB per run.

### Issue ID: PERF-002
- Severity: Low
- Type: Performance/Reliability
- Component: Observability/perf harness
- Location: repository test tooling
- Preconditions: audit run
- Steps:
  1. Attempt standardized load/chaos benchmark execution.
- Expected: repeatable load/chaos harness available.
- Actual: no dedicated k6/locust/artillery/chaos toolchain.
- Evidence: repo inventory lacks such scripts/config.
- Impact: production-scale reliability regressions may go undetected.
- Suspected Root Cause: missing non-functional test harness.
- Related Tests: `PERF-080..PERF-100`
- Workaround: ad-hoc manual probes only.

### Issue ID: BUG-006
- Severity: High
- Type: Reliability | CI/CD
- Component: Root test gate
- Location: root `package.json` test script and husky workflow expectations
- Preconditions: run full test gate
- Steps:
  1. Execute `npm run test` from root.
- Expected: test gate reliably pass/fail on stable suites.
- Actual: backend fails with multiple integration regressions and strict global 90% coverage threshold not met.
- Evidence: Jest output thresholds and failed suites.
- Impact: commit/release gate noise or frequent bypassing.
- Suspected Root Cause: threshold mismatch with current suite maturity + unresolved regressions.
- Related Tests: `API-001..API-250`, `DATA-001..DATA-150`
- Workaround: split smoke gate from full coverage gate operationally.

## 4) Test Matrix Appendix
- Executed and status
  - PASS: `API-001`, `API-004`, `API-009`, `API-015`, `API-021`, `API-030`, `SEC-001`, `SEC-008`, `SEC-010`, `SEC-021`, `SEC-032`, `SEC-044`, `SEC-057`, `SEC-068`, `SEC-079`, `SEC-091`, `SEC-103`, `SEC-114`, `SEC-127`, `SEC-138`, `PERF-001`, `PERF-010`.
  - FAIL: `API-072`, `API-073`, `CON-012`, `CON-018`, `SEC-020`, `SEC-034`, `SEC-090`, `DATA-033`, `DATA-071`, `DATA-099`, `UI-001`, `UI-017`, `UI-041`.
  - BLOCKED: browser E2E matrix, internet-dependent enrichment, full chaos harness.

## 5) Recommendations (Non-fixing)
1. Enforce secure secret management and secret rotation policy in deploy manifests.
2. Add centralized mapping for parser/body-size errors to 4xx categories.
3. Add auth abuse controls (rate limiting, lockout, telemetry).
4. Add strict CORS allowlist and security header middleware baseline.
5. Establish deterministic concurrency/idempotency behavior for write endpoints.
6. Separate smoke test gate from exhaustive coverage gate; stabilize failing suites.
7. Add reproducible browser E2E harness (playwright/cypress) for critical journeys.
8. Add non-functional harness for load/spike/chaos and publish baseline SLO results.
9. Add dependency/SBOM vulnerability checks in connected CI with policy thresholds.
10. Standardize isolated ephemeral DB strategy for integration tests.
