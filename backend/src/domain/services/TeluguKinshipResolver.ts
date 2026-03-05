import kinshipMapData from '../kinship/telugu-kinship-map.v2.json';
import { compareAge, type AgeOrder } from '../kinship/age';
import { buildKinshipCode } from '../kinship/KinshipCodeBuilder';
import type { PersonNode, RelationshipClassification, RelationshipEdge } from '../../shared/types';

export type KinshipTerm = {
  code: string;
  termKey: string;
  en: string;
  te: string;
  addressTe?: string;
  confidence: 'high' | 'medium' | 'low';
  note?: string;
};

type ResolveInput = {
  personAId: string;
  personBId: string;
  persons: PersonNode[];
  relationships: RelationshipEdge[];
  classification: RelationshipClassification;
};

type KinshipMapEntry = {
  en: string;
  te: string | Record<AgeOrder, string>;
  confidence?: 'high' | 'medium' | 'low';
  note?: string;
  address?: {
    ageAware?: Record<AgeOrder, string>;
  };
};

const kinshipMap: Record<string, KinshipMapEntry> = kinshipMapData as Record<string, KinshipMapEntry>;

const confidenceRank: Record<'high' | 'medium' | 'low', number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const minConfidence = (...values: Array<'high' | 'medium' | 'low'>): 'high' | 'medium' | 'low' => {
  const sorted = [...values].sort((a, b) => confidenceRank[a] - confidenceRank[b]);
  return sorted[0] ?? 'low';
};

const ordinal = (n: number): string => {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
};

const personById = (persons: PersonNode[], personId?: string | null): PersonNode | undefined => {
  if (!personId) return undefined;
  return persons.find((person) => person.id === personId);
};

const safeConfidence = (value: string | undefined): 'high' | 'medium' | 'low' => {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'low';
};

const englishFromCode = (code: string): string => {
  if (!code) return 'relative';
  if (code === 'SELF') return 'self';
  if (code === 'UNRELATED') return 'unrelated';

  const labels: Record<string, string> = {
    F: 'father',
    M: 'mother',
    S: 'son',
    D: 'daughter',
    B: 'brother',
    Z: 'sister',
    H: 'husband',
    W: 'wife',
    I: 'in-law relative',
    X: 'relative',
  };

  const parts = code.split('').map((token) => labels[token] ?? 'relative');
  if (parts.length === 0) return 'relative';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join("'s ")}'s ${parts[parts.length - 1]}`;
};

const selectTeValue = (te: string | Record<AgeOrder, string>, order: AgeOrder): string => {
  if (typeof te === 'string') return te;
  return te[order] ?? te.unknown ?? Object.values(te)[0] ?? 'సంబంధం';
};

const defaultAgeOrder = (persons: PersonNode[], personAId: string, personBId: string): AgeOrder => {
  return compareAge(personById(persons, personBId), personById(persons, personAId));
};

const pickOrderForCode = (
  code: string,
  persons: PersonNode[],
  personAId: string,
  personBId: string,
  debug: Record<string, unknown> | undefined,
): AgeOrder => {
  const hops = Array.isArray(debug?.hops)
    ? (debug?.hops as Array<{ toId: string }>)
    : [];

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

export class TeluguKinshipResolver {
  public resolve(input: ResolveInput): KinshipTerm {
    const primaryPath = input.classification.paths?.[0];

    if (!primaryPath || primaryPath.length === 0) {
      return {
        code: 'UNRELATED',
        termKey: 'FALLBACK',
        en: input.classification.label || 'relative',
        te: 'సంబంధం',
        confidence: 'low',
      };
    }

    const build = buildKinshipCode({
      personAId: input.personAId,
      personBId: input.personBId,
      primaryPath,
      persons: input.persons,
      relationships: input.relationships,
    });

    let code = build.code;

    if (input.classification.label === 'Cousin') {
      code = kinshipMap.C ? 'C' : build.code;
    }

    const mapEntry = kinshipMap[code] ?? null;
    if (mapEntry) {
      const order = pickOrderForCode(code, input.persons, input.personAId, input.personBId, build.debug);
      const te = selectTeValue(mapEntry.te, order);
      const addressTe = mapEntry.address?.ageAware ? mapEntry.address.ageAware[defaultAgeOrder(input.persons, input.personAId, input.personBId)] ?? mapEntry.address.ageAware.unknown : undefined;

      const cousinDegree = input.classification.degree;
      const cousinRemoval = input.classification.removal;
      const en =
        input.classification.label === 'Cousin' && typeof cousinDegree === 'number'
          ? cousinRemoval && cousinRemoval > 0
            ? `${ordinal(Math.max(1, cousinDegree))} cousin ${cousinRemoval} removed`
            : `${ordinal(Math.max(1, cousinDegree))} cousin`
          : mapEntry.en;

      return {
        code,
        termKey: code,
        en,
        te,
        addressTe,
        confidence: minConfidence(safeConfidence(mapEntry.confidence), build.confidence),
        note: mapEntry.note,
      };
    }

    const fallbackEn =
      input.classification.label === 'Cousin'
        ? `${ordinal(Math.max(1, input.classification.degree ?? 1))} cousin${(input.classification.removal ?? 0) > 0 ? ` ${input.classification.removal} removed` : ''}`
        : englishFromCode(build.code);

    return {
      code: build.code,
      termKey: 'FALLBACK',
      en: fallbackEn,
      te: build.descriptiveTe || 'సంబంధం',
      confidence: 'low',
      note: 'Resolved via descriptive fallback',
    };
  }
}
