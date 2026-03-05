import { GraphEngine } from '../../src/domain/services/GraphEngine';
import { TeluguKinshipResolver } from '../../src/domain/services/TeluguKinshipResolver';
import type { PersonNode, RelationshipClassification, RelationshipEdge } from '../../src/shared/types';

const resolver = new TeluguKinshipResolver();
const engine = new GraphEngine();

const person = (id: string, name: string, gender: string): PersonNode => ({
  id,
  familyId: 'f1',
  name,
  gender,
  dateOfBirth: null,
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

describe('TeluguKinshipResolver', () => {
  test('maternal/paternal uncle/aunt mappings are correct', () => {
    const persons: PersonNode[] = [
      person('a', 'A', 'male'),
      person('mother', 'Mother', 'female'),
      person('father', 'Father', 'male'),
      person('maternalUncle', 'Maternal Uncle', 'male'),
      person('maternalAunt', 'Maternal Aunt', 'female'),
      person('paternalUncle', 'Paternal Uncle', 'male'),
      person('paternalAunt', 'Paternal Aunt', 'female'),
    ];
    const relationships: RelationshipEdge[] = [
      edge('r1', 'mother', 'a', 'PARENT'),
      edge('r2', 'father', 'a', 'PARENT'),
      edge('r3', 'mother', 'maternalUncle', 'SIBLING'),
      edge('r4', 'mother', 'maternalAunt', 'SIBLING'),
      edge('r5', 'father', 'paternalUncle', 'SIBLING'),
      edge('r6', 'father', 'paternalAunt', 'SIBLING'),
    ];

    const maternalUncle = engine.classifyRelationship('maternalUncle', 'a', persons, relationships, 8);
    const paternalUncle = engine.classifyRelationship('paternalUncle', 'a', persons, relationships, 8);
    const maternalAunt = engine.classifyRelationship('maternalAunt', 'a', persons, relationships, 8);
    const paternalAunt = engine.classifyRelationship('paternalAunt', 'a', persons, relationships, 8);

    expect(
      resolver.resolve({ personAId: 'maternalUncle', personBId: 'a', persons, relationships, classification: maternalUncle }).te,
    ).toBe('మామ');
    expect(
      resolver.resolve({ personAId: 'paternalUncle', personBId: 'a', persons, relationships, classification: paternalUncle }).te,
    ).toBe('బాబాయి');
    expect(
      resolver.resolve({ personAId: 'maternalAunt', personBId: 'a', persons, relationships, classification: maternalAunt }).te,
    ).toBe('పిన్ని');
    expect(
      resolver.resolve({ personAId: 'paternalAunt', personBId: 'a', persons, relationships, classification: paternalAunt }).te,
    ).toBe('అత్త');
  });

  test('in-law common patterns resolve deterministically', () => {
    const persons: PersonNode[] = [
      person('a', 'A', 'male'),
      person('spouse', 'Spouse', 'female'),
      person('spouseBrother', 'Spouse Brother', 'male'),
      person('spouseSister', 'Spouse Sister', 'female'),
      person('spouseMother', 'Spouse Mother', 'female'),
      person('spouseFather', 'Spouse Father', 'male'),
      person('spouseBrotherWife', 'Spouse Brother Wife', 'female'),
      person('sibling', 'Sibling', 'female'),
      person('siblingSpouse', 'Sibling Spouse', 'male'),
      person('child', 'Child', 'female'),
      person('childSpouse', 'Child Spouse', 'male'),
      person('spouseChild', 'Spouse Child', 'male'),
      person('parent', 'Parent', 'female'),
      person('stepParent', 'Step Parent', 'male'),
    ];
    const relationships: RelationshipEdge[] = [
      edge('r1', 'a', 'spouse', 'SPOUSE'),
      edge('r2', 'spouse', 'spouseBrother', 'SIBLING'),
      edge('r3', 'spouse', 'spouseSister', 'SIBLING'),
      edge('r4', 'spouseMother', 'spouse', 'PARENT'),
      edge('r5', 'spouseFather', 'spouse', 'PARENT'),
      edge('r6', 'spouseBrother', 'spouseBrotherWife', 'SPOUSE'),
      edge('r7', 'a', 'sibling', 'SIBLING'),
      edge('r8', 'sibling', 'siblingSpouse', 'SPOUSE'),
      edge('r9', 'a', 'child', 'PARENT'),
      edge('r10', 'child', 'childSpouse', 'SPOUSE'),
      edge('r11', 'spouse', 'spouseChild', 'PARENT'),
      edge('r12', 'parent', 'a', 'PARENT'),
      edge('r13', 'parent', 'stepParent', 'SPOUSE'),
    ];

    const by = (a: string, b: string) => {
      const classification = engine.classifyRelationship(a, b, persons, relationships, 8);
      return resolver.resolve({ personAId: a, personBId: b, persons, relationships, classification });
    };

    expect(by('a', 'spouseBrother').termKey).toBe('INLAW_SPOUSE_BROTHER');
    expect(by('a', 'spouseBrother').te).toBe('బావ');
    expect(by('a', 'spouseSister').termKey).toBe('INLAW_SPOUSE_SISTER');
    expect(by('a', 'spouseMother').termKey).toBe('INLAW_SPOUSE_MOTHER');
    expect(by('a', 'spouseFather').termKey).toBe('INLAW_SPOUSE_FATHER');
    expect(by('a', 'spouseBrotherWife').termKey).toBe('INLAW_SPOUSE_BROTHER_WIFE');
    expect(by('a', 'siblingSpouse').termKey).toBe('INLAW_SIBLING_HUSBAND');
    expect(by('a', 'childSpouse').termKey).toBe('INLAW_CHILD_HUSBAND');
    expect(by('a', 'spouseChild').termKey).toBe('STEP_CHILD_SON');
    expect(by('a', 'stepParent').termKey).toBe('STEP_PARENT_FATHER');
  });

  test('full label coverage returns deterministic non-empty terms', () => {
    const persons: PersonNode[] = [person('a', 'A', 'male'), person('b', 'B', 'female'), person('c', 'C', 'male')];
    const relationships: RelationshipEdge[] = [
      edge('r1', 'a', 'b', 'SPOUSE'),
      edge('r2', 'a', 'c', 'SIBLING'),
      edge('r3', 'c', 'b', 'INLAW'),
      edge('r4', 'b', 'a', 'PARENT'),
    ];

    const labels: RelationshipClassification[] = [
      { label: 'Self', paths: [['a']], multiplePaths: false, cycleDetected: false },
      { label: 'Unrelated', paths: [], multiplePaths: false, cycleDetected: false },
      { label: 'Spouse', paths: [['a', 'b']], multiplePaths: false, cycleDetected: false },
      { label: 'Parent', paths: [['a', 'b']], multiplePaths: false, cycleDetected: false },
      { label: 'Child', paths: [['a', 'b']], multiplePaths: false, cycleDetected: false },
      { label: 'Sibling', paths: [['a', 'c']], multiplePaths: false, cycleDetected: false },
      { label: 'Uncle/Aunt', paths: [['a', 'b', 'c']], multiplePaths: false, cycleDetected: false },
      { label: 'Niece/Nephew', paths: [['a', 'b', 'c']], multiplePaths: false, cycleDetected: false },
      { label: 'Grandparent', paths: [['a', 'b', 'c']], multiplePaths: false, cycleDetected: false },
      { label: 'Great-Grandparent', paths: [['a', 'b', 'c', 'a']], multiplePaths: false, cycleDetected: false },
      { label: 'Grandchild', paths: [['a', 'b', 'c']], multiplePaths: false, cycleDetected: false },
      { label: 'Great-Great-Grandchild', paths: [['a', 'b', 'c', 'a', 'b']], multiplePaths: false, cycleDetected: false },
      { label: 'Cousin', degree: 1, removal: 0, paths: [['a', 'b', 'c']], multiplePaths: false, cycleDetected: false },
      { label: 'Cousin', degree: 2, removal: 1, paths: [['a', 'b', 'c', 'a']], multiplePaths: false, cycleDetected: false },
      { label: 'In-law', paths: [['a', 'b', 'c']], multiplePaths: false, cycleDetected: false },
      { label: 'Relative', paths: [['a', 'c']], multiplePaths: false, cycleDetected: false },
    ];

    for (const classification of labels) {
      const term = resolver.resolve({ personAId: 'a', personBId: 'b', persons, relationships, classification });
      expect(term).toBeTruthy();
      expect(term.termKey.length).toBeGreaterThan(0);
      expect(term.en.length).toBeGreaterThan(0);
      expect(term.te.length).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(term.confidence);
    }
  });
});
