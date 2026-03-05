import { KinshipResolverV2 } from '../../src/domain/kinship/KinshipResolverV2';
import type { PersonNode, RelationshipEdge } from '../../src/shared/types';

const resolver = new KinshipResolverV2();

const person = (id: string, gender: string, dateOfBirth: string | null): PersonNode => ({
  id,
  familyId: 'f1',
  name: id,
  gender,
  dateOfBirth,
  metadataJson: '{}',
});

const edge = (id: string, fromPersonId: string, toPersonId: string, type: RelationshipEdge['type']): RelationshipEdge => ({
  id,
  familyId: 'f1',
  fromPersonId,
  toPersonId,
  type,
  metadataJson: '{}',
});

describe('KinshipResolverV2', () => {
  test("father's brother maps to FB Telugu term", () => {
    const persons = [
      person('a', 'male', '1990-01-01'),
      person('father', 'male', '1965-01-01'),
      person('fbrother', 'male', '1968-01-01'),
    ];
    const relationships = [edge('r1', 'father', 'a', 'PARENT'), edge('r2', 'father', 'fbrother', 'SIBLING')];

    const result = resolver.resolve({
      personAId: 'a',
      personBId: 'fbrother',
      persons,
      relationships,
      primaryPath: ['a', 'father', 'fbrother'],
    });

    expect(result.code).toBe('FB');
    expect(result.termTe).toBeTruthy();
    expect(result.confidence).toBe('high');
  });

  test("mother's brother maps to MB (మామ)", () => {
    const persons = [
      person('a', 'male', '1990-01-01'),
      person('mother', 'female', '1968-01-01'),
      person('mb', 'male', '1970-01-01'),
    ];
    const relationships = [edge('r1', 'mother', 'a', 'PARENT'), edge('r2', 'mother', 'mb', 'SIBLING')];

    const result = resolver.resolve({
      personAId: 'a',
      personBId: 'mb',
      persons,
      relationships,
      primaryPath: ['a', 'mother', 'mb'],
    });

    expect(result.code).toBe('MB');
    expect(result.termTe).toBe('మామ');
    expect(result.confidence).toBe('high');
  });

  test("wife's brother's wife maps to WBW (వదిన)", () => {
    const persons = [
      person('a', 'male', '1990-01-01'),
      person('wife', 'female', '1992-01-01'),
      person('wbrother', 'male', '1994-01-01'),
      person('wbw', 'female', '1995-01-01'),
    ];
    const relationships = [
      edge('r1', 'a', 'wife', 'SPOUSE'),
      edge('r2', 'wife', 'wbrother', 'SIBLING'),
      edge('r3', 'wbrother', 'wbw', 'SPOUSE'),
    ];

    const result = resolver.resolve({
      personAId: 'a',
      personBId: 'wbw',
      persons,
      relationships,
      primaryPath: ['a', 'wife', 'wbrother', 'wbw'],
    });

    expect(result.code).toBe('WBW');
    expect(result.termTe).toBe('వదిన');
  });

  test('fallback returns code + low confidence when mapping missing/ambiguous', () => {
    const persons = [person('a', 'unknown', null), person('x', 'unknown', null), person('y', 'unknown', null)];
    const relationships = [edge('r1', 'a', 'x', 'INLAW'), edge('r2', 'x', 'y', 'INLAW')];

    const result = resolver.resolve({
      personAId: 'a',
      personBId: 'y',
      persons,
      relationships,
      primaryPath: ['a', 'x', 'y'],
    });

    expect(result.code).toBe('II');
    expect(result.termTe).toBeNull();
    expect(result.confidence).toBe('low');
    expect(result.debug?.reason).toBe('NO_MAPPING');
  });
});
