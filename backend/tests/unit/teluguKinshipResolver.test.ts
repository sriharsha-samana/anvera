import { GraphEngine } from '../../src/domain/services/GraphEngine';
import { TeluguKinshipResolver } from '../../src/domain/services/TeluguKinshipResolver';
import type { PersonNode, RelationshipEdge } from '../../src/shared/types';

const persons: PersonNode[] = [
  { id: 'a', familyId: 'f1', name: 'You', gender: 'male', dateOfBirth: '1990-01-01', metadataJson: '{}' },
  { id: 'mother', familyId: 'f1', name: 'Mother', gender: 'female', dateOfBirth: '1968-01-01', metadataJson: '{}' },
  { id: 'father', familyId: 'f1', name: 'Father', gender: 'male', dateOfBirth: '1966-01-01', metadataJson: '{}' },
  { id: 'maternalUncle', familyId: 'f1', name: 'Maternal Uncle', gender: 'male', dateOfBirth: '1964-01-01', metadataJson: '{}' },
  { id: 'paternalUncle', familyId: 'f1', name: 'Paternal Uncle', gender: 'male', dateOfBirth: '1962-01-01', metadataJson: '{}' },
  { id: 'maternalAunt', familyId: 'f1', name: 'Maternal Aunt', gender: 'female', dateOfBirth: '1970-01-01', metadataJson: '{}' },
  { id: 'paternalAunt', familyId: 'f1', name: 'Paternal Aunt', gender: 'female', dateOfBirth: '1969-01-01', metadataJson: '{}' },
  { id: 'spouse', familyId: 'f1', name: 'Spouse', gender: 'female', dateOfBirth: '1991-01-01', metadataJson: '{}' },
  { id: 'spouseBrother', familyId: 'f1', name: "Spouse's Brother", gender: 'male', dateOfBirth: '1988-01-01', metadataJson: '{}' },
  {
    id: 'spouseBrotherWife',
    familyId: 'f1',
    name: "Spouse's Brother's Wife",
    gender: 'female',
    dateOfBirth: '1989-01-01',
    metadataJson: '{}',
  },
];

const relationships: RelationshipEdge[] = [
  { id: 'r1', familyId: 'f1', fromPersonId: 'mother', toPersonId: 'a', type: 'PARENT', metadataJson: '{}' },
  { id: 'r2', familyId: 'f1', fromPersonId: 'father', toPersonId: 'a', type: 'PARENT', metadataJson: '{}' },
  { id: 'r3', familyId: 'f1', fromPersonId: 'mother', toPersonId: 'maternalUncle', type: 'SIBLING', metadataJson: '{}' },
  { id: 'r4', familyId: 'f1', fromPersonId: 'mother', toPersonId: 'maternalAunt', type: 'SIBLING', metadataJson: '{}' },
  { id: 'r5', familyId: 'f1', fromPersonId: 'father', toPersonId: 'paternalUncle', type: 'SIBLING', metadataJson: '{}' },
  { id: 'r6', familyId: 'f1', fromPersonId: 'father', toPersonId: 'paternalAunt', type: 'SIBLING', metadataJson: '{}' },
  { id: 'r7', familyId: 'f1', fromPersonId: 'a', toPersonId: 'spouse', type: 'SPOUSE', metadataJson: '{}' },
  { id: 'r8', familyId: 'f1', fromPersonId: 'spouse', toPersonId: 'spouseBrother', type: 'SIBLING', metadataJson: '{}' },
  {
    id: 'r9',
    familyId: 'f1',
    fromPersonId: 'spouseBrother',
    toPersonId: 'spouseBrotherWife',
    type: 'SPOUSE',
    metadataJson: '{}',
  },
];

describe('TeluguKinshipResolver', () => {
  const engine = new GraphEngine();
  const resolver = new TeluguKinshipResolver();

  test('A -> maternal uncle resolves to మామ', () => {
    const classification = engine.classifyRelationship('a', 'maternalUncle', persons, relationships, 8);
    const term = resolver.resolve({
      personAId: 'a',
      personBId: 'maternalUncle',
      persons,
      relationships,
      classification,
    });
    expect(term?.te).toBe('మామ');
  });

  test('A -> paternal uncle resolves to బాబాయి', () => {
    const classification = engine.classifyRelationship('a', 'paternalUncle', persons, relationships, 8);
    const term = resolver.resolve({
      personAId: 'a',
      personBId: 'paternalUncle',
      persons,
      relationships,
      classification,
    });
    expect(term?.te).toBe('బాబాయి');
  });

  test('A -> maternal aunt resolves to పిన్ని', () => {
    const classification = engine.classifyRelationship('a', 'maternalAunt', persons, relationships, 8);
    const term = resolver.resolve({
      personAId: 'a',
      personBId: 'maternalAunt',
      persons,
      relationships,
      classification,
    });
    expect(term?.te).toBe('పిన్ని');
  });

  test('A -> paternal aunt resolves to అత్త', () => {
    const classification = engine.classifyRelationship('a', 'paternalAunt', persons, relationships, 8);
    const term = resolver.resolve({
      personAId: 'a',
      personBId: 'paternalAunt',
      persons,
      relationships,
      classification,
    });
    expect(term?.te).toBe('అత్త');
  });

  test("A -> spouse's brother resolves to బావ", () => {
    const classification = engine.classifyRelationship('a', 'spouseBrother', persons, relationships, 8);
    const term = resolver.resolve({
      personAId: 'a',
      personBId: 'spouseBrother',
      persons,
      relationships,
      classification,
    });
    expect(term?.te).toBe('బావ');
  });

  test("A -> spouse's brother's wife resolves to వదిన", () => {
    const classification = engine.classifyRelationship('a', 'spouseBrotherWife', persons, relationships, 8);
    const term = resolver.resolve({
      personAId: 'a',
      personBId: 'spouseBrotherWife',
      persons,
      relationships,
      classification,
    });
    expect(term?.te).toBe('వదిన');
  });
});
