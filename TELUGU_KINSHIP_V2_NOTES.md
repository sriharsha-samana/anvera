# Telugu Kinship Map v2 (DOB-aware)

This is a **DOB-aware** evolution of v1.

## What changed vs v1
Some entries now use an **age-aware Telugu term object**:

Example (`B` = brother):
```json
{
  "en": "brother",
  "te": { "older": "అన్న", "younger": "తమ్ముడు", "unknown": "సోదరుడు" },
  "confidence": "high"
}
```

## How to use in code
1) Build a **kinship code** from the shortest A→B path: e.g., `MB`, `FB`, `WBW`.
2) Lookup `map[code]`.
3) If `te` is an object:
   - compute `older/younger/unknown` using DOB comparison
   - select the right variant.
4) If no code match exists, fall back to a descriptive chain.

## Notable v2 age-aware keys
- `B`, `Z`
- `FB` (father’s brother => pedda nanna vs chinna nanna)
- `BW` (brother’s wife => vadina vs maradalu)
- `HB` (husband’s brother => bava vs bava-maridi) [family usage varies]
- `WBW` address suggestion: akka/chelli (optional)

## Sources / notes
Kinship terms vary by family and region; v2 uses common usage patterns, with fallbacks and confidence flags.
