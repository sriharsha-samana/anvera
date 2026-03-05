import { TeluguKinshipResolver } from '../../src/domain/services/TeluguKinshipResolver';
import type { PersonNode, RelationshipClassification, RelationshipEdge } from '../../src/shared/types';

const resolver = new TeluguKinshipResolver();

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

const resolve = (
  personAId: string,
  personBId: string,
  persons: PersonNode[],
  relationships: RelationshipEdge[],
  classification: RelationshipClassification,
) => resolver.resolve({ personAId, personBId, persons, relationships, classification });

describe('TeluguKinshipResolver v2', () => {
  test('B/Z use DOB-aware older/younger variants', () => {
    const persons = [
      person('a', 'male', '1990-06-19'),
      person('bOlder', 'male', '1987-01-01'),
      person('bYounger', 'male', '1995-01-01'),
      person('zOlder', 'female', '1986-01-01'),
      person('zYounger', 'female', '1994-01-01'),
    ];

    const relationships = [
      edge('r1', 'a', 'bOlder', 'SIBLING'),
      edge('r2', 'a', 'bYounger', 'SIBLING'),
      edge('r3', 'a', 'zOlder', 'SIBLING'),
      edge('r4', 'a', 'zYounger', 'SIBLING'),
    ];

    expect(
      resolve('a', 'bOlder', persons, relationships, {
        label: 'Sibling',
        paths: [['a', 'bOlder']],
        multiplePaths: false,
        cycleDetected: false,
      }).te,
    ).toBe('అన్న');

    expect(
      resolve('a', 'bYounger', persons, relationships, {
        label: 'Sibling',
        paths: [['a', 'bYounger']],
        multiplePaths: false,
        cycleDetected: false,
      }).te,
    ).toBe('తమ్ముడు');

    expect(
      resolve('a', 'zOlder', persons, relationships, {
        label: 'Sibling',
        paths: [['a', 'zOlder']],
        multiplePaths: false,
        cycleDetected: false,
      }).te,
    ).toBe('అక్క');

    expect(
      resolve('a', 'zYounger', persons, relationships, {
        label: 'Sibling',
        paths: [['a', 'zYounger']],
        multiplePaths: false,
        cycleDetected: false,
      }).te,
    ).toBe('చెల్లి');
  });

  test('FB uses father-vs-fathersBrother DOB for older/younger Telugu term', () => {
    const persons = [
      person('a', 'male', '1990-06-19'),
      person('father', 'male', '1960-01-01'),
      person('fbOlder', 'male', '1954-01-01'),
      person('fbYounger', 'male', '1968-01-01'),
    ];

    const relationships = [
      edge('r1', 'father', 'a', 'PARENT'),
      edge('r2', 'father', 'fbOlder', 'SIBLING'),
      edge('r3', 'father', 'fbYounger', 'SIBLING'),
    ];

    expect(
      resolve('a', 'fbOlder', persons, relationships, {
        label: 'Uncle/Aunt',
        paths: [['a', 'father', 'fbOlder']],
        multiplePaths: false,
        cycleDetected: false,
      }).te,
    ).toBe('పెద్ద నాన్న');

    expect(
      resolve('a', 'fbYounger', persons, relationships, {
        label: 'Uncle/Aunt',
        paths: [['a', 'father', 'fbYounger']],
        multiplePaths: false,
        cycleDetected: false,
      }).te,
    ).toBe('చిన్న నాన్న / బాబాయి');
  });

  test('WBW uses formal term and age-aware address variant', () => {
    const persons = [
      person('a', 'male', '1990-06-19'),
      person('wife', 'female', '1992-01-01'),
      person('wifeBrother', 'male', '1989-01-01'),
      person('wbwOlder', 'female', '1985-01-01'),
      person('wbwYounger', 'female', '1999-01-01'),
    ];

    const relationships = [
      edge('r1', 'a', 'wife', 'SPOUSE'),
      edge('r2', 'wife', 'wifeBrother', 'SIBLING'),
      edge('r3', 'wifeBrother', 'wbwOlder', 'SPOUSE'),
      edge('r4', 'wifeBrother', 'wbwYounger', 'SPOUSE'),
    ];

    const older = resolve('a', 'wbwOlder', persons, relationships, {
      label: 'In-law',
      paths: [['a', 'wife', 'wifeBrother', 'wbwOlder']],
      multiplePaths: false,
      cycleDetected: false,
    });
    expect(older.termKey).toBe('WBW');
    expect(older.te).toBe('వదిన');
    expect(older.addressTe).toBe('అక్క');

    const younger = resolve('a', 'wbwYounger', persons, relationships, {
      label: 'In-law',
      paths: [['a', 'wife', 'wifeBrother', 'wbwYounger']],
      multiplePaths: false,
      cycleDetected: false,
    });
    expect(younger.termKey).toBe('WBW');
    expect(younger.te).toBe('వదిన');
    expect(younger.addressTe).toBe('చెల్లి');
  });

  test('basic mapping cases: MB => మామ, MZ => పిన్ని, FM => నానమ్మ', () => {
    const persons = [
      person('a', 'male', '1990-06-19'),
      person('mother', 'female', '1965-01-01'),
      person('father', 'male', '1960-01-01'),
      person('mb', 'male', '1962-01-01'),
      person('mz', 'female', '1967-01-01'),
      person('fm', 'female', '1935-01-01'),
    ];

    const relationships = [
      edge('r1', 'mother', 'a', 'PARENT'),
      edge('r2', 'father', 'a', 'PARENT'),
      edge('r3', 'mother', 'mb', 'SIBLING'),
      edge('r4', 'mother', 'mz', 'SIBLING'),
      edge('r5', 'fm', 'father', 'PARENT'),
    ];

    expect(
      resolve('a', 'mb', persons, relationships, {
        label: 'Uncle/Aunt',
        paths: [['a', 'mother', 'mb']],
        multiplePaths: false,
        cycleDetected: false,
      }).te,
    ).toBe('మామ');

    expect(
      resolve('a', 'mz', persons, relationships, {
        label: 'Uncle/Aunt',
        paths: [['a', 'mother', 'mz']],
        multiplePaths: false,
        cycleDetected: false,
      }).te,
    ).toBe('పిన్ని');

    expect(
      resolve('a', 'fm', persons, relationships, {
        label: 'Grandparent',
        paths: [['a', 'father', 'fm']],
        multiplePaths: false,
        cycleDetected: false,
      }).te,
    ).toBe('నానమ్మ');
  });

  test('resolver returns non-null deterministic result for every GraphEngine label family when path exists', () => {
    const persons = [
      person('a', 'male', '1990-06-19'),
      person('f', 'male', '1960-01-01'),
      person('m', 'female', '1965-01-01'),
      person('b', 'male', '1988-01-01'),
      person('z', 'female', '1987-01-01'),
      person('w', 'female', '1992-01-01'),
      person('c', 'male', '2015-01-01'),
      person('x', 'female', '1994-01-01'),
    ];

    const relationships = [
      edge('r1', 'f', 'a', 'PARENT'),
      edge('r2', 'm', 'a', 'PARENT'),
      edge('r3', 'a', 'b', 'SIBLING'),
      edge('r4', 'a', 'z', 'SIBLING'),
      edge('r5', 'a', 'w', 'SPOUSE'),
      edge('r6', 'a', 'c', 'PARENT'),
      edge('r7', 'b', 'x', 'SPOUSE'),
      edge('r8', 'w', 'x', 'SIBLING'),
      edge('r9', 'b', 'z', 'INLAW'),
    ];

    const cases: Array<{ classification: RelationshipClassification; personBId: string }> = [
      { classification: { label: 'Self', paths: [['a']], multiplePaths: false, cycleDetected: false }, personBId: 'a' },
      { classification: { label: 'Unrelated', paths: [['a', 'x']], multiplePaths: false, cycleDetected: false }, personBId: 'x' },
      { classification: { label: 'Spouse', paths: [['a', 'w']], multiplePaths: false, cycleDetected: false }, personBId: 'w' },
      { classification: { label: 'Parent', paths: [['a', 'c']], multiplePaths: false, cycleDetected: false }, personBId: 'c' },
      { classification: { label: 'Child', paths: [['a', 'f']], multiplePaths: false, cycleDetected: false }, personBId: 'f' },
      { classification: { label: 'Sibling', paths: [['a', 'b']], multiplePaths: false, cycleDetected: false }, personBId: 'b' },
      { classification: { label: 'Uncle/Aunt', paths: [['a', 'm', 'b']], multiplePaths: false, cycleDetected: false }, personBId: 'b' },
      { classification: { label: 'Niece/Nephew', paths: [['a', 'b', 'c']], multiplePaths: false, cycleDetected: false }, personBId: 'c' },
      { classification: { label: 'Grandparent', paths: [['a', 'f', 'm']], multiplePaths: false, cycleDetected: false }, personBId: 'm' },
      {
        classification: { label: 'Great-Grandparent', paths: [['a', 'f', 'm', 'b']], multiplePaths: false, cycleDetected: false },
        personBId: 'b',
      },
      { classification: { label: 'Grandchild', paths: [['a', 'c', 'x']], multiplePaths: false, cycleDetected: false }, personBId: 'x' },
      {
        classification: { label: 'Great-Great-Grandchild', paths: [['a', 'c', 'x', 'z']], multiplePaths: false, cycleDetected: false },
        personBId: 'z',
      },
      {
        classification: {
          label: 'Cousin',
          degree: 2,
          removal: 1,
          paths: [['a', 'f', 'm', 'b']],
          multiplePaths: false,
          cycleDetected: false,
        },
        personBId: 'b',
      },
      { classification: { label: 'In-law', paths: [['a', 'w', 'x']], multiplePaths: false, cycleDetected: false }, personBId: 'x' },
      { classification: { label: 'Relative', paths: [['a', 'b', 'z']], multiplePaths: false, cycleDetected: false }, personBId: 'z' },
    ];

    for (const testCase of cases) {
      const term = resolve('a', testCase.personBId, persons, relationships, testCase.classification);
      expect(term).toBeTruthy();
      expect(term.code.length).toBeGreaterThan(0);
      expect(term.termKey.length).toBeGreaterThan(0);
      expect(term.en.length).toBeGreaterThan(0);
      expect(term.te.length).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(term.confidence);
    }
  });
});
