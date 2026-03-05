# Anvera UI Layout Blueprint (Nuxt 3 + Vuetify) — Implementation-Ready

Version: 1.0  
Scope: Frontend UX/UI restructure + layout system for Anvera, aligned to the **current repo** structure (`/frontend/pages/...`).

---

## 1) Product UX Goals

### Primary user jobs
1. **See the family clearly** (tree/graph views that stay readable as the family grows)
2. **Find a person fast** (global search + person drawer)
3. **Understand relationships** (relationship explorer + multi-path)
4. **Govern changes safely** (proposals + impact preview + versions + rollback)

### Guardrails (non-negotiable)
- **Owner-only direct edits** to people/relationships
- Members can only **propose**
- Everything is **local-first**, fast, and understandable

---

## 2) Current UX Baseline (What already exists)

Your frontend already has these major screens/routes:

### Families
- `/families` — “Family Workspace” list + create family
- `/families/[id]` — “Family Overview” page (graph + people + relationships in one page)
- `/families/[id]/graph` — graph-focused view
- `/families/[id]/proposals` — proposals list + approve/reject flows
- `/families/[id]/versions` — history/versions
- `/families/[id]/danger` — settings/danger zone
- `/families/[id]/persons/new` — add person
- `/families/[id]/persons/[personId]` — person profile/details

This document proposes a **more coherent layout + navigation + multi-layout graph system**, while keeping the above routes (you can add routes too, but don’t break existing ones).

---

## 3) Global App Shell (Layout System)

### 3.1 App-level layout: `layouts/app.vue`
**Desktop**
- **Top App Bar**
  - Left: Anvera logo + *dataset/family selector*
  - Center: **Global Person Search** (typeahead)
  - Right:
    - “Self” chip (linked person)
    - Language toggle (EN / తెలుగు)
    - Proposal notifications
    - Profile menu

- **Left Navigation Drawer**
  - Dashboard
  - Family Overview
  - Relationship Explorer
  - Proposals
  - Versions
  - People Directory
  - Settings (Owner only → show but lock for members)

**Mobile**
- Bottom navigation:
  - Overview
  - Explore
  - Proposals
  - Versions
  - People

### 3.2 Consistent “Context Strip” (top-of-page helper)
Show these *always* near the page title:
- Active family name
- Role: Owner/Member
- Self person (chip)
- Dataset mode: Master/Clone (if you implement cloning UX)

---

## 4) Route Map (Recommended)

Keep existing routes; add these new (optional but recommended) routes:

### Existing (keep)
- `/families`
- `/families/[id]`
- `/families/[id]/graph`
- `/families/[id]/proposals`
- `/families/[id]/versions`
- `/families/[id]/danger`
- `/families/[id]/persons/new`
- `/families/[id]/persons/[personId]`

### Recommended additions (new)
- `/families/[id]/explore` (Relationship Explorer dedicated page)
- `/families/[id]/people` (Directory view for power users)
- `/families/[id]/versions/[versionNumber]` (diff view)

---

## 5) Page Layout Specifications

### 5.1 `/families` — Family Workspace
**Goal:** pick a family + create new.
**Layout**
- Title + subtitle
- Create family (text field + button)
- Family cards:
  - Name
  - Owner badge
  - Role badge (“You are owner/member”)
  - Actions: **Open Overview**
- Right side (or below on mobile): Relationship AI assistant widget can remain, but it should *not* dominate.

**UX upgrades**
- Add a “Last updated” / “Last activity” field on each family card
- Add “Open Relationship Explorer” quick action

---

### 5.2 `/families/[id]` — Family Overview (Make this the “Home” of a family)
This is already a large “everything in one place” page. Keep that concept, but restructure it into **three stacked sections** with consistent controls.

#### Section A — Family Graph (multi-layout)
Add a **layout switch** with 3 modes:
1. **Generations** (banded levels)
2. **Focus Graph** (center + neighborhood)
3. **Timeline** (optional)

Controls row:
- Focus person select
- Depth slider (for focus graph)
- Filters:
  - Blood vs marriage edges
  - Maternal vs paternal highlight
  - Living only
- Export:
  - Download image
  - Export JSON (optional)

Graph interactions:
- Click person → open **Person Drawer** (right side), not a full page navigation by default (still provide “Open profile” button inside drawer)

---

#### Section B — Relationship Explorer (embedded lite)
Keep a compact version here for quick lookup:
- Person A defaults to “Self”
- Person B search
- Compute
- Show top 3 relationship results
- Button: “Open full Explorer”

---

#### Section C — People & Relationships (management)
Split into two tabs or two cards:
- People list
- Relationships table

Owner actions:
- Add person (button)
- Add relationship (button)
- Edit relationship
- Delete relationship

Member actions:
- “Propose change” buttons instead of direct edits

---

### 5.3 `/families/[id]/graph` — Graph Studio (full-screen visualization)
**Goal:** best-in-class graph exploration with advanced controls.

Layout:
- Full-width canvas
- Floating toolbar:
  - Layout switch (Generations / Focus / Timeline)
  - Depth slider
  - Expand/collapse controls
  - “Center on Self”
  - Search within graph
- Right drawer:
  - person details
  - relationship quick actions (owner vs member)

Add a “Path” overlay mode:
- pick 2 people → show only the path

---

### 5.4 `/families/[id]/explore` — Relationship Explorer (dedicated)
**Goal:** answer “what is X to me?” with multi-path + Telugu.

Split layout:
- Left card: query form
- Right: ranked relationship results
- Below: Path viewer (step-by-step)

Result card fields:
- English kin term
- Telugu kin term
- Tags:
  - blood/in-law
  - maternal/paternal
  - elder/younger (if determinable)
- “Explain” (AI) — explanation-only, use structured computed data

---

### 5.5 `/families/[id]/proposals`
Make this feel like an “owner governance inbox”.

List view:
- Filters: Pending/Approved/Rejected/Overridden
- Sort: newest / highest impact
- Each item:
  - proposer
  - summary
  - impact count
  - status

Detail drawer/modal:
- Change summary
- **Impact preview**
  - affected people count
  - before/after relationship changes
  - “graph diff” mini preview (optional)
- Owner actions: approve / reject
- After approve:
  - show “Undo / rollback guidance” (points to Versions)

---

### 5.6 `/families/[id]/versions`
Timeline view + diff viewer.

- Timeline list of versions with:
  - version number
  - created by
  - reason (proposal/manual/rollback)
- Click version:
  - show changes (people / relationships)
  - “Rollback to this version” button (owner only)
  - “Export snapshot” (optional)

---

### 5.7 `/families/[id]/persons/[personId]` — Person Profile
Convert to a structured detail page:

Header:
- Avatar + name
- Badges (computed relative to Self):
  - generation delta
  - side maternal/paternal (when applicable)
  - blood/in-law

Tabs:
1) Overview
2) Relationships (parents/spouse/children/siblings)
3) Timeline (events)
4) Versions (changes involving this person)

---

### 5.8 `/profile`
Make it “My Account + Self-linking”
- account info
- set “Self person” (within family)
- default language

---

## 6) Core Reusable Components (Build these once)

### Navigation & Shell
- `AppShell.vue` (drawer + appbar + footer)
- `ContextStrip.vue` (family + role + self + dataset)
- `GlobalPersonSearch.vue` (typeahead + keyboard shortcuts)

### People UI
- `PersonCardCompact.vue` (graph nodes + list)
- `PersonChip.vue` (inline references)
- `PersonDrawer.vue` (right-side details + actions)
- `PersonForm.vue` (create/edit/propose)

### Graph
- `GraphToolbar.vue`
- `GraphLayoutSwitch.vue` (Generations / Focus / Timeline)
- `GraphCanvas.vue` (wrap your current `GraphVisualization`)
- `PathViewer.vue` (two-person path)
- `GraphLegend.vue` (blood vs marriage, maternal vs paternal, etc.)

### Governance
- `ProposalCard.vue`
- `ProposalDetailDrawer.vue`
- `ImpactPreviewPanel.vue`
- `VersionTimeline.vue`
- `VersionDiffPanel.vue`

### Relationship Explorer
- `RelationshipQueryForm.vue`
- `RelationshipResultCard.vue`
- `RelationshipExplainPanel.vue` (AI explanation-only)

---

## 7) Visual Language Rules (So it’s readable)

Edges:
- Blood: solid line
- Marriage: dashed line
- Unknown/other: dotted line

Badges:
- maternal/paternal should be indicated by **icon + label**, not color only
- elder/younger should be explicit in text if known

Avoid information overload:
- Default view shows **Self + 2 hops** (focus graph)
- Make “show all” an intentional action

---

## 8) Permissions UX (Owner vs Member)

Owner:
- primary buttons: Add person, Add relationship, Approve/Reject proposals
Member:
- primary buttons: Propose person change, Propose relationship change
- show read-only banners where needed

Every “Edit” affordance must either:
- become disabled with tooltip (“Owner only”), OR
- change into “Propose edit”

---

## 9) Accessibility & UX polish

- Keyboard shortcuts:
  - `/` focus search
  - `g` then `o/e/p/v` (go: overview/explore/proposals/versions)
- Skeleton loaders for queries
- Empty states:
  - no people → “Add Self + parents/spouse/children”
  - no relationships → “Add parent-child and spouse links”
- Safe deletes:
  - owner sees “impact warning” before destructive ops

---

## 10) Definition of Done (UI)

- App shell consistent across all pages
- Global search works and opens Person Drawer
- Graph layout switch works (at least Generations + Focus Graph)
- Relationship explorer returns multi-path results + Telugu output display fields
- Proposals & versions have a clear governance workflow
- All owner-only actions guarded in UI + backend errors handled gracefully
- Mobile is usable (not perfect, but works)

---

## Appendix A: Suggested Page-to-Component Wiring

- `/families/[id]` uses:
  - `ContextStrip`
  - `GraphCanvas` + `GraphToolbar` + `GraphLayoutSwitch`
  - `RelationshipQueryForm` (lite)
  - `PeopleTable` + `RelationshipsTable`
  - `PersonDrawer` (global overlay)

- `/families/[id]/graph` uses:
  - `GraphCanvas` full-screen
  - `GraphToolbar` advanced
  - `PathViewer`
  - `PersonDrawer`

- `/families/[id]/explore` uses:
  - `RelationshipQueryForm`
  - `RelationshipResultCard`
  - `PathViewer`
  - `RelationshipExplainPanel`
