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

export class TeluguKinshipResolver {
  public resolve(input: ResolveInput): KinshipTerm | null {
    const primaryPath = input.classification.paths[0] ?? [];
    if (primaryPath.length === 0) return null;

    if (input.classification.label === 'Uncle/Aunt' || input.classification.label === 'Niece/Nephew') {
      return this.resolveUncleAunt(input, primaryPath);
    }

    if (input.classification.label === 'In-law') {
      return this.resolveInLaw(input, primaryPath);
    }

    return null;
  }

  private resolveUncleAunt(input: ResolveInput, primaryPath: string[]): KinshipTerm | null {
    const side = this.resolveParentSide(input.personAId, primaryPath, input.relationships, input.persons);
    const targetGender = this.normalizeGender(this.personById(input.persons, input.personBId)?.gender);

    if (side === 'maternal' && targetGender === 'male') {
      return { termKey: 'UNCLE_MATERNAL', en: 'maternal uncle', te: 'మామ', confidence: 'high' };
    }
    if (side === 'maternal' && targetGender === 'female') {
      return { termKey: 'AUNT_MATERNAL', en: 'maternal aunt', te: 'పిన్ని', confidence: 'high' };
    }
    if (side === 'paternal' && targetGender === 'male') {
      return { termKey: 'UNCLE_PATERNAL', en: 'paternal uncle', te: 'బాబాయి', confidence: 'high' };
    }
    if (side === 'paternal' && targetGender === 'female') {
      return { termKey: 'AUNT_PATERNAL', en: 'paternal aunt', te: 'అత్త', confidence: 'high' };
    }

    return null;
  }

  private resolveInLaw(input: ResolveInput, primaryPath: string[]): KinshipTerm | null {
    if (primaryPath.length < 3) return null;
    if (primaryPath[0] !== input.personAId || primaryPath[primaryPath.length - 1] !== input.personBId) return null;

    const spouseId = primaryPath[1];
    if (this.relationFromTo(input.relationships, input.personAId, spouseId) !== 'SPOUSE') return null;

    const siblingId = primaryPath[2];
    if (this.relationFromTo(input.relationships, spouseId, siblingId) !== 'SIBLING') return null;

    const siblingGender = this.normalizeGender(this.personById(input.persons, siblingId)?.gender);
    if (input.personBId === siblingId && siblingGender === 'male') {
      return {
        termKey: 'INLAW_SPOUSE_BROTHER',
        en: "spouse's brother",
        te: 'బావ',
        confidence: 'high',
      };
    }

    if (primaryPath.length >= 4) {
      const spouseOfSiblingId = primaryPath[3];
      const siblingToSpouse = this.relationFromTo(input.relationships, siblingId, spouseOfSiblingId);
      const spouseOfSiblingGender = this.normalizeGender(this.personById(input.persons, spouseOfSiblingId)?.gender);
      if (
        input.personBId === spouseOfSiblingId &&
        siblingToSpouse === 'SPOUSE' &&
        siblingGender === 'male' &&
        spouseOfSiblingGender === 'female'
      ) {
        return {
          termKey: 'INLAW_SPOUSE_BROTHER_WIFE',
          en: "spouse's brother's wife",
          te: 'వదిన',
          confidence: 'high',
        };
      }
    }

    return {
      termKey: 'INLAW_GENERIC',
      en: 'in-law relative',
      te: 'పెళ్లి సంబంధం',
      confidence: 'low',
    };
  }

  private resolveParentSide(
    personAId: string,
    primaryPath: string[],
    relationships: RelationshipEdge[],
    persons: PersonNode[],
  ): 'maternal' | 'paternal' | 'unknown' {
    if (primaryPath.length < 2 || primaryPath[0] !== personAId) return 'unknown';

    const parentId = this.relationFromTo(relationships, personAId, primaryPath[1]) === 'CHILD' ? primaryPath[1] : null;
    if (!parentId) return 'unknown';

    const parentGender = this.normalizeGender(this.personById(persons, parentId)?.gender);
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

  private bidirectionalType(
    direct: RelationshipType | undefined,
    reverse: RelationshipType | undefined,
    type: RelationshipType,
  ): boolean {
    return direct === type || reverse === type;
  }

  private personById(persons: PersonNode[], personId: string): PersonNode | undefined {
    return persons.find((person) => person.id === personId);
  }

  private normalizeGender(value: string | null | undefined): 'male' | 'female' | 'other' | 'unknown' {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'male' || normalized === 'm') return 'male';
    if (normalized === 'female' || normalized === 'f') return 'female';
    if (normalized === 'other') return 'other';
    return 'unknown';
  }
}
