import type { RelationshipType } from '@prisma/client';
import type { PersonNode, RelationshipClassification, RelationshipEdge } from '../../shared/types';

export type KinshipTerm = {
  termKey: string;
  en: string;
  te: string;
  addressTe?: string;
  confidence: 'high' | 'medium' | 'low';
};

type ResolveInput = {
  personAId: string;
  personBId: string;
  persons: PersonNode[];
  relationships: RelationshipEdge[];
  classification: RelationshipClassification;
};

type DirectionalRelationship = 'PARENT' | 'CHILD' | 'SPOUSE' | 'SIBLING' | 'INLAW' | null;
type PathStepType = 'PARENT_UP' | 'CHILD_DOWN' | 'SPOUSE' | 'SIBLING' | 'INLAW' | 'UNKNOWN';
type Gender = 'male' | 'female' | 'other' | 'unknown';
type Side = 'maternal' | 'paternal' | 'unknown';

const ordinal = (n: number): string => {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
};

export class TeluguKinshipResolver {
  public resolve(input: ResolveInput): KinshipTerm {
    const label = input.classification.label;
    const path = input.classification.paths[0] ?? [];
    const steps = this.pathToEdgeTypes(path, input.relationships);
    const genderA = this.personGender(this.personById(input.persons, input.personAId));
    const genderB = this.personGender(this.personById(input.persons, input.personBId));

    if (label === 'Unrelated') {
      return { termKey: 'UNRELATED', en: 'unrelated', te: 'సంబంధం లేదు', confidence: 'high' };
    }

    if (path.length === 0) {
      return { termKey: 'RELATIVE_GENERIC', en: 'relative', te: 'బంధువు', confidence: 'low' };
    }

    switch (label) {
      case 'Self':
        return { termKey: 'SELF', en: 'self', te: 'నేనే', confidence: 'high' };
      case 'Spouse':
        return this.spouseTerm(genderA);
      case 'Parent':
        return this.parentTerm(genderA);
      case 'Child':
        return this.childTerm(genderA);
      case 'Sibling':
        return this.siblingTerm(genderA);
      case 'Uncle/Aunt':
        return this.uncleAuntTerm(input, path, genderA);
      case 'Niece/Nephew':
        return this.nieceNephewTerm(input, path, genderA);
      case 'Grandparent':
        return this.grandparentTerm(input, path, genderA);
      case 'Grandchild':
        return this.grandchildTerm(genderA);
      case 'In-law':
        return this.inLawTerm(input, path, steps, genderA, genderB);
      case 'Relative':
        return { termKey: 'RELATIVE_GENERIC', en: 'relative', te: 'బంధువు', confidence: 'low' };
      case 'Cousin':
        return this.cousinTerm(input, path);
      default:
        break;
    }

    if (label.endsWith('Grandparent')) {
      return this.greatGrandparentTerm(genderA, label);
    }
    if (label.endsWith('Grandchild')) {
      return this.greatGrandchildTerm(genderA, label);
    }

    return { termKey: 'RELATIVE_GENERIC', en: 'relative', te: 'బంధువు', confidence: 'low' };
  }

  public pathToEdgeTypes(path: string[], relationships: RelationshipEdge[]): PathStepType[] {
    if (path.length < 2) return [];
    const out: PathStepType[] = [];
    for (let i = 0; i < path.length - 1; i += 1) {
      const rel = this.relationFromTo(relationships, path[i], path[i + 1]);
      if (rel === 'CHILD') out.push('PARENT_UP');
      else if (rel === 'PARENT') out.push('CHILD_DOWN');
      else if (rel === 'SPOUSE') out.push('SPOUSE');
      else if (rel === 'SIBLING') out.push('SIBLING');
      else if (rel === 'INLAW') out.push('INLAW');
      else out.push('UNKNOWN');
    }
    return out;
  }

  private spouseTerm(gender: Gender): KinshipTerm {
    if (gender === 'male') return { termKey: 'SPOUSE_HUSBAND', en: 'husband', te: 'భర్త', confidence: 'high' };
    if (gender === 'female') return { termKey: 'SPOUSE_WIFE', en: 'wife', te: 'భార్య', confidence: 'high' };
    return { termKey: 'SPOUSE_GENERIC', en: 'spouse', te: 'జీవిత భాగస్వామి', confidence: 'medium' };
  }

  private parentTerm(gender: Gender): KinshipTerm {
    if (gender === 'male') return { termKey: 'PARENT_FATHER', en: 'father', te: 'తండ్రి', confidence: 'high' };
    if (gender === 'female') return { termKey: 'PARENT_MOTHER', en: 'mother', te: 'తల్లి', confidence: 'high' };
    return { termKey: 'PARENT_GENERIC', en: 'parent', te: 'తల్లి/తండ్రి', confidence: 'medium' };
  }

  private childTerm(gender: Gender): KinshipTerm {
    if (gender === 'male') return { termKey: 'CHILD_SON', en: 'son', te: 'కొడుకు', confidence: 'high' };
    if (gender === 'female') return { termKey: 'CHILD_DAUGHTER', en: 'daughter', te: 'కూతురు', confidence: 'high' };
    return { termKey: 'CHILD_GENERIC', en: 'child', te: 'సంతానం', confidence: 'medium' };
  }

  private siblingTerm(gender: Gender): KinshipTerm {
    if (gender === 'male') return { termKey: 'SIBLING_BROTHER', en: 'brother', te: 'అన్న/తమ్ముడు', confidence: 'medium' };
    if (gender === 'female') return { termKey: 'SIBLING_SISTER', en: 'sister', te: 'అక్క/చెల్లి', confidence: 'medium' };
    return { termKey: 'SIBLING_GENERIC', en: 'sibling', te: 'తోబుట్టువు', confidence: 'medium' };
  }

  private uncleAuntTerm(input: ResolveInput, path: string[], genderA: Gender): KinshipTerm {
    const side = this.resolveParentSide(path, input.relationships, input.persons, input.personBId);
    if (side === 'maternal' && genderA === 'male') {
      return { termKey: 'UNCLE_MATERNAL', en: 'maternal uncle', te: 'మామ', confidence: 'high' };
    }
    if (side === 'maternal' && genderA === 'female') {
      return { termKey: 'AUNT_MATERNAL', en: 'maternal aunt', te: 'పిన్ని', confidence: 'high' };
    }
    if (side === 'paternal' && genderA === 'male') {
      return { termKey: 'UNCLE_PATERNAL', en: 'paternal uncle', te: 'బాబాయి', confidence: 'high' };
    }
    if (side === 'paternal' && genderA === 'female') {
      return { termKey: 'AUNT_PATERNAL', en: 'paternal aunt', te: 'అత్త', confidence: 'high' };
    }
    if (genderA === 'male') {
      return { termKey: 'UNCLE_GENERIC', en: 'uncle', te: 'మామ/బాబాయి', confidence: 'medium' };
    }
    if (genderA === 'female') {
      return { termKey: 'AUNT_GENERIC', en: 'aunt', te: 'పిన్ని/అత్త', confidence: 'medium' };
    }
    return { termKey: 'UNCLE_AUNT_GENERIC', en: 'uncle/aunt', te: 'మామ/బాబాయి/పిన్ని/అత్త', confidence: 'low' };
  }

  private nieceNephewTerm(input: ResolveInput, path: string[], genderA: Gender): KinshipTerm {
    const side = this.resolveParentSideFromA(path, input.relationships, input.persons, input.personAId);
    if (side === 'maternal' && genderA === 'male') {
      return { termKey: 'NEPHEW_MATERNAL', en: 'maternal nephew', te: 'మేనల్లుడు', confidence: 'high' };
    }
    if (side === 'maternal' && genderA === 'female') {
      return { termKey: 'NIECE_MATERNAL', en: 'maternal niece', te: 'మేనకోడలు', confidence: 'high' };
    }
    if (side === 'paternal' && genderA === 'male') {
      return { termKey: 'NEPHEW_PATERNAL', en: 'paternal nephew', te: 'మనల్లుడు', confidence: 'high' };
    }
    if (side === 'paternal' && genderA === 'female') {
      return { termKey: 'NIECE_PATERNAL', en: 'paternal niece', te: 'మనకోడలు', confidence: 'high' };
    }
    if (genderA === 'male') return { termKey: 'NEPHEW_GENERIC', en: 'nephew', te: 'మేనల్లుడు', confidence: 'medium' };
    if (genderA === 'female') return { termKey: 'NIECE_GENERIC', en: 'niece', te: 'మేనకోడలు', confidence: 'medium' };
    return { termKey: 'NIECE_NEPHEW_GENERIC', en: 'niece/nephew', te: 'మేనల్లుడు/మేనకోడలు', confidence: 'low' };
  }

  private grandparentTerm(input: ResolveInput, path: string[], genderA: Gender): KinshipTerm {
    if (genderA === 'male') {
      return { termKey: 'GRANDPARENT_GRANDFATHER', en: 'grandfather', te: 'తాతయ్య', confidence: 'high' };
    }
    if (genderA === 'female') {
      const side = this.resolveParentSide(path, input.relationships, input.persons, input.personBId);
      if (side === 'maternal') return { termKey: 'GRANDPARENT_GRANDMOTHER_MATERNAL', en: 'maternal grandmother', te: 'అమ్మమ్మ', confidence: 'high' };
      if (side === 'paternal') return { termKey: 'GRANDPARENT_GRANDMOTHER_PATERNAL', en: 'paternal grandmother', te: 'నానమ్మ', confidence: 'high' };
      return { termKey: 'GRANDPARENT_GRANDMOTHER_GENERIC', en: 'grandmother', te: 'అమ్మమ్మ/నానమ్మ', confidence: 'medium' };
    }
    return { termKey: 'GRANDPARENT_GENERIC', en: 'grandparent', te: 'తాతయ్య/అమ్మమ్మ/నానమ్మ', confidence: 'low' };
  }

  private greatGrandparentTerm(genderA: Gender, label: string): KinshipTerm {
    const greatCount = Math.max(1, (label.match(/Great-/g) ?? []).length);
    const enBase =
      genderA === 'male'
        ? `${'great-'.repeat(greatCount)}grandfather`
        : genderA === 'female'
          ? `${'great-'.repeat(greatCount)}grandmother`
          : `${'great-'.repeat(greatCount)}grandparent`;
    if (genderA === 'male') {
      return { termKey: `GREAT_GRANDPARENT_MALE_L${greatCount + 1}`, en: enBase, te: 'పెద్ద తరం తాత', confidence: 'medium' };
    }
    if (genderA === 'female') {
      return {
        termKey: `GREAT_GRANDPARENT_FEMALE_L${greatCount + 1}`,
        en: enBase,
        te: 'పెద్ద తరం అమ్మమ్మ/నానమ్మ',
        confidence: 'medium',
      };
    }
    return {
      termKey: `GREAT_GRANDPARENT_GENERIC_L${greatCount + 1}`,
      en: enBase,
      te: 'పెద్ద తరం పూర్వీకుడు/పూర్వికురాలు',
      confidence: 'low',
    };
  }

  private grandchildTerm(genderA: Gender): KinshipTerm {
    if (genderA === 'male') return { termKey: 'GRANDCHILD_GRANDSON', en: 'grandson', te: 'మనవడు', confidence: 'high' };
    if (genderA === 'female') return { termKey: 'GRANDCHILD_GRANDDAUGHTER', en: 'granddaughter', te: 'మనవరాలు', confidence: 'high' };
    return { termKey: 'GRANDCHILD_GENERIC', en: 'grandchild', te: 'మనవడు/మనవరాలు', confidence: 'medium' };
  }

  private greatGrandchildTerm(genderA: Gender, label: string): KinshipTerm {
    const greatCount = Math.max(1, (label.match(/Great-/g) ?? []).length);
    const enBase =
      genderA === 'male'
        ? `${'great-'.repeat(greatCount)}grandson`
        : genderA === 'female'
          ? `${'great-'.repeat(greatCount)}granddaughter`
          : `${'great-'.repeat(greatCount)}grandchild`;
    if (genderA === 'male') {
      return { termKey: `GREAT_GRANDCHILD_MALE_L${greatCount + 1}`, en: enBase, te: 'తరువాతి తరం మనవడు', confidence: 'medium' };
    }
    if (genderA === 'female') {
      return { termKey: `GREAT_GRANDCHILD_FEMALE_L${greatCount + 1}`, en: enBase, te: 'తరువాతి తరం మనవరాలు', confidence: 'medium' };
    }
    return {
      termKey: `GREAT_GRANDCHILD_GENERIC_L${greatCount + 1}`,
      en: enBase,
      te: 'తరువాతి తరం మనవడు/మనవరాలు',
      confidence: 'low',
    };
  }

  private cousinTerm(input: ResolveInput, path: string[]): KinshipTerm {
    const degree = input.classification.degree ?? 1;
    const removal = input.classification.removal ?? 0;
    const en = removal === 0 ? `${ordinal(Math.max(1, degree))} cousin` : `${ordinal(Math.max(1, degree))} cousin ${removal} removed`;
    const side = this.resolveParentSideFromA(path, input.relationships, input.persons, input.personAId);
    const enWithSide = side === 'maternal' ? `maternal ${en}` : side === 'paternal' ? `paternal ${en}` : en;
    return {
      termKey: `COUSIN_GENERIC_D${Math.max(1, degree)}_R${Math.max(0, removal)}`,
      en: enWithSide,
      te: 'బంధువు (కజిన్)',
      confidence: 'medium',
    };
  }

  private inLawTerm(
    input: ResolveInput,
    path: string[],
    steps: PathStepType[],
    genderA: Gender,
    genderB: Gender,
  ): KinshipTerm {
    const hasSpouse = steps.includes('SPOUSE');
    const thirdNode = path[2];

    // A -> spouse -> spouse's parent
    if (steps.length === 2 && steps[0] === 'SPOUSE' && steps[1] === 'PARENT_UP') {
      if (genderB === 'male') return { termKey: 'INLAW_SPOUSE_FATHER', en: "spouse's father", te: 'మామగారు', confidence: 'high' };
      if (genderB === 'female') return { termKey: 'INLAW_SPOUSE_MOTHER', en: "spouse's mother", te: 'అత్తగారు', confidence: 'high' };
      return { termKey: 'INLAW_SPOUSE_PARENT', en: "spouse's parent", te: 'మామగారు/అత్తగారు', confidence: 'medium' };
    }

    // A -> spouse -> spouse's sibling
    if (steps.length === 2 && steps[0] === 'SPOUSE' && steps[1] === 'SIBLING') {
      if (genderB === 'male') return { termKey: 'INLAW_SPOUSE_BROTHER', en: "spouse's brother", te: 'బావ', confidence: 'high' };
      if (genderB === 'female') return { termKey: 'INLAW_SPOUSE_SISTER', en: "spouse's sister", te: 'మరదలు/వదిన', confidence: 'medium' };
      return { termKey: 'INLAW_SPOUSE_SIBLING', en: "spouse's sibling", te: 'బావ/మరదలు/వదిన', confidence: 'low' };
    }

    // A -> sibling -> sibling's spouse
    if (steps.length === 2 && steps[0] === 'SIBLING' && steps[1] === 'SPOUSE') {
      if (genderB === 'male') return { termKey: 'INLAW_SIBLING_HUSBAND', en: "sibling's husband", te: 'బావ', confidence: 'medium' };
      if (genderB === 'female') return { termKey: 'INLAW_SIBLING_WIFE', en: "sibling's wife", te: 'వదిన', confidence: 'medium' };
      return { termKey: 'INLAW_SIBLING_SPOUSE', en: "sibling's spouse", te: 'బావ/వదిన', confidence: 'low' };
    }

    // A -> spouse -> spouse sibling -> spouse
    if (steps.length >= 3 && steps[0] === 'SPOUSE' && steps[1] === 'SIBLING' && steps[2] === 'SPOUSE') {
      const siblingGender = this.personGender(this.personById(input.persons, thirdNode));
      if (siblingGender === 'male' && genderB === 'female') {
        return {
          termKey: 'INLAW_SPOUSE_BROTHER_WIFE',
          en: "spouse's brother's wife",
          te: 'వదిన',
          confidence: 'high',
        };
      }
      if (siblingGender === 'female' && genderB === 'male') {
        return {
          termKey: 'INLAW_SPOUSE_SISTER_HUSBAND',
          en: "spouse's sister's husband",
          te: 'బావ',
          confidence: 'high',
        };
      }
      return {
        termKey: 'INLAW_SPOUSE_SIBLING_SPOUSE',
        en: "spouse's sibling's spouse",
        te: 'బావ/వదిన/మరదలు',
        confidence: 'medium',
      };
    }

    // A -> child -> spouse
    if (steps.length === 2 && steps[0] === 'CHILD_DOWN' && steps[1] === 'SPOUSE') {
      if (genderB === 'male') return { termKey: 'INLAW_CHILD_HUSBAND', en: "child's husband", te: 'అల్లుడు', confidence: 'high' };
      if (genderB === 'female') return { termKey: 'INLAW_CHILD_WIFE', en: "child's wife", te: 'కోడలు', confidence: 'high' };
      return { termKey: 'INLAW_CHILD_SPOUSE', en: "child's spouse", te: 'అల్లుడు/కోడలు', confidence: 'medium' };
    }

    // A -> spouse -> child
    if (steps.length === 2 && steps[0] === 'SPOUSE' && steps[1] === 'CHILD_DOWN') {
      if (genderB === 'male') return { termKey: 'STEP_CHILD_SON', en: "spouse's son", te: 'సవతి కొడుకు', confidence: 'medium' };
      if (genderB === 'female') return { termKey: 'STEP_CHILD_DAUGHTER', en: "spouse's daughter", te: 'సవతి కూతురు', confidence: 'medium' };
      return { termKey: 'STEP_CHILD_GENERIC', en: "spouse's child", te: 'సవతి సంతానం', confidence: 'low' };
    }

    // A -> parent -> spouse
    if (steps.length === 2 && steps[0] === 'PARENT_UP' && steps[1] === 'SPOUSE') {
      if (genderB === 'male') return { termKey: 'STEP_PARENT_FATHER', en: "parent's husband", te: 'సవతి తండ్రి', confidence: 'medium' };
      if (genderB === 'female') return { termKey: 'STEP_PARENT_MOTHER', en: "parent's wife", te: 'సవతి తల్లి', confidence: 'medium' };
      return { termKey: 'STEP_PARENT_GENERIC', en: 'step-parent', te: 'సవతి తల్లి/తండ్రి', confidence: 'low' };
    }

    if (hasSpouse || steps.includes('INLAW')) {
      const through: 'spouse' | 'sibling' | 'parent' | 'child' | 'unknown' =
        steps[0] === 'SPOUSE'
          ? 'spouse'
          : steps[0] === 'SIBLING'
            ? 'sibling'
            : steps[0] === 'PARENT_UP'
              ? 'parent'
              : steps[0] === 'CHILD_DOWN'
                ? 'child'
                : 'unknown';
      return {
        termKey: `INLAW_GENERIC_${through.toUpperCase()}`,
        en: through === 'unknown' ? 'in-law relative' : `in-law via ${through}`,
        te: 'పెళ్లి సంబంధం',
        confidence: 'low',
      };
    }

    // Should not happen for In-law label, keep deterministic fallback.
    return { termKey: 'INLAW_GENERIC', en: 'in-law relative', te: 'పెళ్లి సంబంధం', confidence: 'low' };
  }

  private resolveParentSide(path: string[], relationships: RelationshipEdge[], persons: PersonNode[], personBId: string): Side {
    if (path.length < 2) return 'unknown';
    // Find the parent directly above B in the shortest path.
    for (let i = path.length - 2; i >= 0; i -= 1) {
      if (path[i + 1] !== personBId) continue;
      if (this.relationFromTo(relationships, path[i], path[i + 1]) !== 'PARENT') continue;
      const parentGender = this.personGender(this.personById(persons, path[i]));
      if (parentGender === 'female') return 'maternal';
      if (parentGender === 'male') return 'paternal';
    }

    // General fallback: first descending parent edge toward B.
    for (let i = 0; i < path.length - 1; i += 1) {
      if (this.relationFromTo(relationships, path[i], path[i + 1]) !== 'PARENT') continue;
      const parentGender = this.personGender(this.personById(persons, path[i]));
      if (parentGender === 'female') return 'maternal';
      if (parentGender === 'male') return 'paternal';
    }
    return 'unknown';
  }

  private resolveParentSideFromA(path: string[], relationships: RelationshipEdge[], persons: PersonNode[], personAId: string): Side {
    if (path.length < 2 || path[0] !== personAId) return 'unknown';
    if (this.relationFromTo(relationships, path[0], path[1]) !== 'CHILD') return 'unknown';
    const parentGender = this.personGender(this.personById(persons, path[1]));
    if (parentGender === 'female') return 'maternal';
    if (parentGender === 'male') return 'paternal';
    return 'unknown';
  }

  private relationFromTo(relationships: RelationshipEdge[], fromId: string, toId: string): DirectionalRelationship {
    const direct = relationships.find((r) => r.fromPersonId === fromId && r.toPersonId === toId);
    const reverse = relationships.find((r) => r.fromPersonId === toId && r.toPersonId === fromId);
    if (direct?.type === 'PARENT') return 'PARENT';
    if (reverse?.type === 'PARENT') return 'CHILD';
    if (this.bidirectionalType(direct?.type, reverse?.type, 'SPOUSE')) return 'SPOUSE';
    if (this.bidirectionalType(direct?.type, reverse?.type, 'SIBLING')) return 'SIBLING';
    if (this.bidirectionalType(direct?.type, reverse?.type, 'INLAW')) return 'INLAW';
    return null;
  }

  private bidirectionalType(direct: RelationshipType | undefined, reverse: RelationshipType | undefined, type: RelationshipType): boolean {
    return direct === type || reverse === type;
  }

  private personById(persons: PersonNode[], personId?: string | null): PersonNode | undefined {
    if (!personId) return undefined;
    return persons.find((person) => person.id === personId);
  }

  private personGender(person: PersonNode | undefined): Gender {
    const normalized = (person?.gender ?? '').trim().toLowerCase();
    if (normalized === 'male' || normalized === 'm') return 'male';
    if (normalized === 'female' || normalized === 'f') return 'female';
    if (normalized === 'other') return 'other';
    return 'unknown';
  }
}
