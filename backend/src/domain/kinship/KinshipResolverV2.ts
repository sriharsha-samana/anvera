import teluguMapJson from './telugu-kinship-map.v2.json';
import { compareAge, type AgeOrder } from './age';
import { buildKinshipCode } from './KinshipCodeBuilder';
import type { PersonNode, RelationshipEdge } from '../../shared/types';

export type KinshipPayload = {
  culture: 'te';
  termTe: string;
  code: string | null;
  termKey: string;
  confidence: 'high' | 'medium' | 'low';
  debug?: Record<string, unknown>;
};

type KinshipMapEntry = {
  en?: string;
  te?: string | Record<AgeOrder, string>;
  confidence?: 'high' | 'medium' | 'low';
  note?: string;
  address?: {
    ageAware?: Record<AgeOrder, string>;
  };
};

type ResolveInput = {
  personAId: string;
  personBId: string;
  persons: PersonNode[];
  relationships: RelationshipEdge[];
  primaryPath: string[];
};

type HopDebug = {
  fromId: string;
  toId: string;
  hopType: string;
  codeLetter: string;
  confidenceHint: string;
  descriptiveTePart: string;
};

const kinshipMap: Record<string, KinshipMapEntry> =
  typeof teluguMapJson === 'object' && teluguMapJson
    ? (teluguMapJson as Record<string, KinshipMapEntry>)
    : {};

const confidenceRank: Record<'high' | 'medium' | 'low', number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const minConfidence = (...values: Array<'high' | 'medium' | 'low'>): 'high' | 'medium' | 'low' => {
  const sorted = [...values].sort((a, b) => confidenceRank[a] - confidenceRank[b]);
  return sorted[0] ?? 'low';
};

const personById = (persons: PersonNode[], personId: string): PersonNode | undefined =>
  persons.find((p) => p.id === personId);

const safeConfidence = (value: string | undefined): 'high' | 'medium' | 'low' => {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'low';
};

const selectVariant = (value: string | Record<AgeOrder, string>, order: AgeOrder): string => {
  if (typeof value === 'string') return value;
  return value[order] ?? value.unknown ?? Object.values(value)[0] ?? 'సంబంధం';
};

const normalizedTermTe = (value?: string | null): string => {
  const normalized = (value ?? '').trim();
  return normalized.length > 0 ? normalized : 'సంబంధం';
};

const defaultAgeOrder = (persons: PersonNode[], personAId: string, personBId: string): AgeOrder =>
  compareAge(personById(persons, personBId), personById(persons, personAId));

const pickAgeOrderForCode = (
  code: string,
  persons: PersonNode[],
  personAId: string,
  personBId: string,
  hops: HopDebug[],
): AgeOrder => {
  if (code === 'FB' && hops.length >= 2) {
    const father = personById(persons, hops[0].toId);
    const fathersBrother = personById(persons, hops[1].toId);
    return compareAge(fathersBrother, father);
  }

  if (code === 'BW' && hops.length >= 2) {
    const brother = personById(persons, hops[0].toId);
    const self = personById(persons, personAId);
    return compareAge(brother, self);
  }

  if (code === 'HB' && hops.length >= 2) {
    const husband = personById(persons, hops[0].toId);
    const husbandsBrother = personById(persons, hops[1].toId);
    return compareAge(husbandsBrother, husband);
  }

  if (code === 'B' || code === 'Z') {
    return compareAge(personById(persons, personBId), personById(persons, personAId));
  }

  return defaultAgeOrder(persons, personAId, personBId);
};

export class KinshipResolverV2 {
  public resolve(input: ResolveInput): KinshipPayload {
    try {
      if (!input.primaryPath || input.primaryPath.length === 0) {
        return {
          culture: 'te',
          termTe: 'సంబంధం',
          code: null,
          termKey: 'FALLBACK',
          confidence: 'low',
          debug: { reason: 'EMPTY_PATH' },
        };
      }

      const built = buildKinshipCode({
        personAId: input.personAId,
        personBId: input.personBId,
        primaryPath: input.primaryPath,
        persons: input.persons,
        relationships: input.relationships,
      });

      const code = built.code || null;
      if (!code) {
        return {
          culture: 'te',
          termTe: normalizedTermTe(built.descriptiveTe),
          code: null,
          termKey: 'FALLBACK',
          confidence: 'low',
          debug: { reason: 'NO_CODE_FALLBACK', build: built },
        };
      }

      const entry = kinshipMap[code];
      if (!entry || !entry.te) {
        return {
          culture: 'te',
          termTe: normalizedTermTe(built.descriptiveTe),
          code,
          termKey: code,
          confidence: 'low',
          debug: { reason: 'NO_MAPPING_FALLBACK', build: built },
        };
      }

      const hops = Array.isArray(built.debug?.hops) ? (built.debug?.hops as HopDebug[]) : [];
      const order = pickAgeOrderForCode(
        code,
        input.persons,
        input.personAId,
        input.personBId,
        hops,
      );
      const termTe = selectVariant(entry.te, order);

      const debug: Record<string, unknown> = {
        code,
        order,
      };

      if (entry.note) debug.note = entry.note;
      if (entry.address?.ageAware) {
        const addressOrder = defaultAgeOrder(input.persons, input.personAId, input.personBId);
        debug.addressTe = entry.address.ageAware[addressOrder] ?? entry.address.ageAware.unknown;
      }

      return {
        culture: 'te',
        termTe: normalizedTermTe(termTe),
        code,
        termKey: code,
        confidence: minConfidence(safeConfidence(entry.confidence), built.confidence),
        debug,
      };
    } catch (error) {
      return {
        culture: 'te',
        termTe: 'సంబంధం',
        code: null,
        termKey: 'FALLBACK',
        confidence: 'low',
        debug: {
          reason: 'KINSHIP_RESOLUTION_FAILED_FALLBACK',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}
