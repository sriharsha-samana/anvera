# Telugu Kinship Mapping (Anvera) — v1

This pack contains a **data-driven** Telugu kinship map plus a recommended **resolver algorithm** for Anvera.

## Files
- `telugu-kinship-map.v1.json`  
  Keys are **kinship codes** (e.g., `MB`, `FB`, `WBW`) and values contain Telugu and English terms.

## Kinship code system
Each letter represents one step **from Person A to Person B**.

| Code | Meaning |
|---|---|
| F | father |
| M | mother |
| B | brother |
| Z | sister |
| S | son |
| D | daughter |
| H | husband |
| W | wife |
| SELF | self |

Examples:
- `MB` = mother’s brother (maternal uncle) → **మామ**
- `FB` = father’s brother (paternal uncle) → **బాబాయి**
- `WBW` = wife’s brother’s wife → **వదిన**

> Notes:
> - Some entries are **dialect/family dependent** and include `confidence: low/medium`.
> - Many codes have a **descriptive fallback** (`confidence: low`) so you can “support all cases” without returning null.

## Resolver algorithm (recommended)
### Inputs
- `personAId`, `personBId`
- `classification` from GraphEngine: `{ label, paths, commonAncestorId, cousinDegree, cousinRemoved, ... }`
- `persons` (gender, optional DOB)
- `relationships` (edge types: parent, spouse, sibling, etc.)

### Steps
1) **Choose a primary path**
- Use `classification.paths[0]` (shortest path).

2) **Convert primary path to a kinship code**
- Walk edges A→B.
- For each step, emit:
  - `F` or `M` when stepping to a parent (choose by parent’s gender; if unknown, emit `F` as generic parent or emit `P` and later fall back).
  - `S` or `D` when stepping to a child (choose by child’s gender; if unknown, emit `S` as generic child or emit `C` and later fall back).
  - `B` or `Z` when stepping to a sibling (choose by sibling’s gender; if unknown, use `B` and fall back).
  - `H` or `W` when stepping to spouse (choose by spouse gender; if unknown, use `W` and fall back).

3) **Lookup**
- If exact code exists in `telugu-kinship-map.v1.json`, return it.

4) **Label-based overrides**
- For cousin: do not rely on path string only; keep English as “N-th cousin, R removed”.
- If cousin code isn’t found, return `C` (generic cousin entry) with `confidence: medium`.

5) **Fallback**
- If you cannot determine genders for some steps, build a “descriptive chain”
  - Example: `తల్లి → సోదరుడు → భార్య`
- Return with `confidence: low`.

## Suggested API output shape
Add (non-breaking) to `/relationship` response:
```json
{
  "label": "Uncle/Aunt",
  "paths": [["a","m","mb"]],
  "kinship": {
    "code": "MB",
    "termKey": "MB",
    "en": "mother's brother (maternal uncle)",
    "te": "మామ",
    "confidence": "high"
  }
}
```

## Important cultural caveat
Telugu kinship is **context-sensitive** (side, age, family convention). The dataset provides:
- a **best-effort formal term**
- and low/medium confidence + notes where Telugu usage varies.

Use the **graph-derived code** as the source of truth; use AI only to *explain*, not to decide the term.
