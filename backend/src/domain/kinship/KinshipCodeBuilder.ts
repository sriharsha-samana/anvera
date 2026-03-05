import type { RelationshipType } from '@prisma/client';
import type { PersonNode, RelationshipEdge } from '../../shared/types';

export type BuildResult = {
  code: string;
  confidence: 'high' | 'medium' | 'low';
  descriptiveTe: string;
  debug?: Record<string, unknown>;
};

type HopType = 'PARENT_UP' | 'CHILD_DOWN' | 'SIBLING' | 'SPOUSE' | 'INLAW' | 'UNKNOWN';
type NormalizedGender = 'male' | 'female' | 'unknown';

type BuildInput = {
  personAId: string;
  personBId: string;
  primaryPath: string[];
  persons: PersonNode[];
  relationships: RelationshipEdge[];
};

type HopInfo = {
  fromId: string;
  toId: string;
  hopType: HopType;
  codeLetter: string;
  confidenceHint: 'high' | 'medium' | 'low';
  descriptiveTePart: string;
};

const genderOf = (person?: PersonNode): NormalizedGender => {
  const normalized = (person?.gender ?? '').trim().toLowerCase();
  if (normalized === 'male' || normalized === 'm') return 'male';
  if (normalized === 'female' || normalized === 'f') return 'female';
  return 'unknown';
};

const findPerson = (persons: PersonNode[], personId: string): PersonNode | undefined => persons.find((p) => p.id === personId);

const relationFromTo = (relationships: RelationshipEdge[], fromId: string, toId: string): HopType => {
  const direct = relationships.find((r) => r.fromPersonId === fromId && r.toPersonId === toId);
  const reverse = relationships.find((r) => r.fromPersonId === toId && r.toPersonId === fromId);

  if (direct?.type === 'PARENT') return 'CHILD_DOWN';
  if (reverse?.type === 'PARENT') return 'PARENT_UP';

  const hasType = (type: RelationshipType): boolean => direct?.type === type || reverse?.type === type;
  if (hasType('SIBLING')) return 'SIBLING';
  if (hasType('SPOUSE')) return 'SPOUSE';
  if (hasType('INLAW')) return 'INLAW';
  return 'UNKNOWN';
};

const codeFromHop = (hopType: HopType, toGender: NormalizedGender): Pick<HopInfo, 'codeLetter' | 'confidenceHint' | 'descriptiveTePart'> => {
  if (hopType === 'PARENT_UP') {
    if (toGender === 'male') return { codeLetter: 'F', confidenceHint: 'high', descriptiveTePart: 'తండ్రి' };
    if (toGender === 'female') return { codeLetter: 'M', confidenceHint: 'high', descriptiveTePart: 'తల్లి' };
    return { codeLetter: 'F', confidenceHint: 'medium', descriptiveTePart: 'తల్లి/తండ్రి' };
  }

  if (hopType === 'CHILD_DOWN') {
    if (toGender === 'male') return { codeLetter: 'S', confidenceHint: 'high', descriptiveTePart: 'కొడుకు' };
    if (toGender === 'female') return { codeLetter: 'D', confidenceHint: 'high', descriptiveTePart: 'కూతురు' };
    return { codeLetter: 'S', confidenceHint: 'medium', descriptiveTePart: 'సంతానం' };
  }

  if (hopType === 'SIBLING') {
    if (toGender === 'male') return { codeLetter: 'B', confidenceHint: 'high', descriptiveTePart: 'సోదరుడు' };
    if (toGender === 'female') return { codeLetter: 'Z', confidenceHint: 'high', descriptiveTePart: 'సోదరి' };
    return { codeLetter: 'B', confidenceHint: 'medium', descriptiveTePart: 'తోబుట్టువు' };
  }

  if (hopType === 'SPOUSE') {
    if (toGender === 'male') return { codeLetter: 'H', confidenceHint: 'high', descriptiveTePart: 'భర్త' };
    if (toGender === 'female') return { codeLetter: 'W', confidenceHint: 'high', descriptiveTePart: 'భార్య' };
    return { codeLetter: 'H', confidenceHint: 'medium', descriptiveTePart: 'జీవిత భాగస్వామి' };
  }

  if (hopType === 'INLAW') {
    return { codeLetter: 'I', confidenceHint: 'medium', descriptiveTePart: 'పెళ్లి సంబంధం' };
  }

  return { codeLetter: 'X', confidenceHint: 'low', descriptiveTePart: 'తెలియని సంబంధం' };
};

export const buildKinshipCode = ({ primaryPath, persons, relationships }: BuildInput): BuildResult => {
  if (!primaryPath || primaryPath.length === 0) {
    return {
      code: 'UNRELATED',
      confidence: 'low',
      descriptiveTe: 'సంబంధం',
      debug: { reason: 'empty-path' },
    };
  }

  if (primaryPath.length === 1) {
    return {
      code: 'SELF',
      confidence: 'high',
      descriptiveTe: 'నేను',
      debug: { reason: 'self-path' },
    };
  }

  const hops: HopInfo[] = [];
  for (let i = 0; i < primaryPath.length - 1; i += 1) {
    const fromId = primaryPath[i];
    const toId = primaryPath[i + 1];
    const toPerson = findPerson(persons, toId);
    const hopType = relationFromTo(relationships, fromId, toId);
    const coded = codeFromHop(hopType, genderOf(toPerson));
    hops.push({ fromId, toId, hopType, ...coded });
  }

  const code = hops.map((h) => h.codeLetter).join('');
  const descriptiveTe = hops.map((h) => h.descriptiveTePart).join(' → ');

  const confidence: BuildResult['confidence'] = hops.some((h) => h.confidenceHint === 'low')
    ? 'low'
    : hops.some((h) => h.confidenceHint === 'medium')
      ? 'medium'
      : 'high';

  return {
    code,
    confidence,
    descriptiveTe,
    debug: {
      hops,
    },
  };
};
