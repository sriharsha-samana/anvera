# SYSTEM_MAP.md

## Phase 1 Checklist
- [x] Services/modules enumerated
- [x] API endpoints inventoried
- [x] UI routes inventoried
- [x] Auth model + role matrix mapped
- [x] Data model + invariants mapped
- [x] External integrations mapped
- [x] Critical workflows documented

## Services / Modules
- Backend: TypeScript + Express app (`backend/src/app.ts`), layered architecture.
- Frontend: Nuxt 3 + Vue 3 + Vuetify (`frontend/pages`, `frontend/components`).
- DB: SQLite via Prisma (`backend/prisma/schema.prisma`).
- AI integrations: Ollama, OpenAI-compatible, OpenRouter/Groq, Gemini.
- Container runtime: Docker Compose (`docker-compose.yml`), optional Ollama service.

## API Inventory
Base: `http://<host>:4000`

### Auth
- `POST /auth/register` (public)
  - Request: `{ password, givenName, familyName, gender, email, dateOfBirth?, phone?, ... }`
  - Response: `{ token }`
  - Errors: `400 validation`, `409 conflict`, `500`
- `POST /auth/login` (public)
  - Request: `{ identifier, password }`
  - Response: `{ token }`
  - Errors: `401 invalid credentials`, `500`
- `GET /auth/me` (Bearer)
  - Response: profile fields
  - Errors: `401`

### Families
- `GET /families` (Bearer)
  - Response: families where user is owner/member, includes owner info and `totalMembers`
- `POST /families` (Bearer)
  - Request: `{ name }`
  - Owner of created family = caller
- `POST /families/:id/clone` (Bearer)
  - Request: `{ name? }`
- `PUT /families/:id` (Bearer owner)
- `DELETE /families/:id` (Bearer owner)

### Persons
- `GET /families/:id/persons` (Bearer member)
- `POST /families/:id/persons` (Bearer owner)
- `PUT /families/:id/persons/:personId` (Bearer owner)
- `DELETE /families/:id/persons/:personId` (Bearer owner)

### Relationships
- `GET /families/:id/relationships` (Bearer member)
- `POST /families/:id/relationships` (Bearer owner)
- `PUT /families/:id/relationships/:relationshipId` (Bearer owner)
- `DELETE /families/:id/relationships/:relationshipId` (Bearer owner)
- `GET /relationship?familyId=&personA=&personB=` (Bearer member)

### Proposals
- `POST /families/:id/proposals` (Bearer member/owner, policy-controlled)
- `GET /families/:id/proposals` (Bearer member)
- `POST /proposals/:id/approve` (Bearer owner)
- `POST /proposals/:id/reject` (Bearer owner)

### Versions / Rollback
- `GET /families/:id/versions` (Bearer member)
- `POST /families/:id/rollback/:versionNumber` (Bearer owner)

### AI
- `POST /ai/explain` (Bearer)
- `POST /ai/ask` (Bearer)

## Error Schema (observed)
- AppError -> `{ message, details? }` with mapped HTTP status.
- Unmapped errors -> `500 {"message":"Internal server error"}`.

## UI Routes / States
- `/` login + registration.
- `/families` families list/cards and owner info.
- `/profile` user profile.
- `/families/[id]` family overview dashboard.
- `/families/[id]/graph` graph/focus/download views.
- `/families/[id]/persons/new` add person.
- `/families/[id]/persons/[personId]` person profile/edit.
- `/families/[id]/proposals` create/review proposals + preview.
- `/families/[id]/versions` version timeline/history + rollback.
- `/families/[id]/danger` destructive actions.

## Auth Model / Roles / Permissions
- AuthN: JWT bearer token (8h expiry), signed by `JWT_SECRET`.
- AuthZ roles:
  - Owner: direct graph mutations + approval/reject + rollback + family destructive ops.
  - Member: read family graph; submit proposals.
  - Outsider: no membership access to family-specific endpoints.
- Membership check: `FamilyService.ensureFamilyMembership`.

## Data Model
- User, PersonIdentity, Family, FamilyMember, Person, Relationship, Proposal, FamilyVersion, AuditLog.
- Key constraints:
  - `FamilyMember @@unique([familyId,userId])`
  - `Person @@unique([familyId,identityId])`
  - `FamilyVersion @@unique([familyId,versionNumber])`
- Invariants (intended): append-only version history, rollback creates new version, proposal auditability, owner-governed direct writes.

## External Integrations
- LLM providers via HTTP: Ollama, OpenAI-compatible, OpenRouter/Groq, Gemini.
- No payments/SMS/email/webhook integrations detected.

## Critical Workflows (20)
1. Register -> token issuance.
2. Login via username/email/phone.
3. Create family -> initial snapshot version.
4. Owner adds person -> new version.
5. Owner updates person -> new version.
6. Owner deletes person -> relationship cascade + version.
7. Owner adds relationship with integrity checks.
8. Owner updates relationship with anti-cycle checks.
9. Owner deletes relationship + version.
10. Member submits add-person proposal.
11. Member submits add-relationship proposal.
12. Owner approves proposal -> apply + version + audit.
13. Owner rejects proposal -> status + reason + audit.
14. List version timeline.
15. Rollback to target version.
16. Relationship query (personA/personB).
17. AI explain endpoint.
18. AI ask endpoint (family-specific/global).
19. Clone family data graph.
20. Delete family + dependent cleanup.
