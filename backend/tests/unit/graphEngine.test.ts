import { GraphEngine } from '../../src/domain/services/GraphEngine';
import type { PersonNode, RelationshipEdge } from '../../src/shared/types';

const persons: PersonNode[] = [
  { id: 'gp', familyId: 'f1', name: 'Grandparent', gender: 'f', dateOfBirth: null, metadataJson: '{}' },
  { id: 'p1', familyId: 'f1', name: 'Parent1', gender: 'm', dateOfBirth: null, metadataJson: '{}' },
  { id: 'p2', familyId: 'f1', name: 'Parent2', gender: 'f', dateOfBirth: null, metadataJson: '{}' },
  { id: 'c1', familyId: 'f1', name: 'Child1', gender: 'm', dateOfBirth: null, metadataJson: '{}' },
  { id: 'c2', familyId: 'f1', name: 'Child2', gender: 'f', dateOfBirth: null, metadataJson: '{}' },
  { id: 'sp', familyId: 'f1', name: 'Spouse', gender: 'f', dateOfBirth: null, metadataJson: '{}' },
];

const relationships: RelationshipEdge[] = [
  { id: 'r1', familyId: 'f1', fromPersonId: 'gp', toPersonId: 'p1', type: 'PARENT', metadataJson: '{}' },
  { id: 'r2', familyId: 'f1', fromPersonId: 'gp', toPersonId: 'p2', type: 'PARENT', metadataJson: '{}' },
  { id: 'r3', familyId: 'f1', fromPersonId: 'p1', toPersonId: 'c1', type: 'PARENT', metadataJson: '{}' },
  { id: 'r4', familyId: 'f1', fromPersonId: 'p2', toPersonId: 'c2', type: 'PARENT', metadataJson: '{}' },
  { id: 'r5', familyId: 'f1', fromPersonId: 'c1', toPersonId: 'sp', type: 'SPOUSE', metadataJson: '{}' },
  { id: 'r6', familyId: 'f1', fromPersonId: 'p1', toPersonId: 'p2', type: 'SIBLING', metadataJson: '{}' },
];

describe('GraphEngine', () => {
  const engine = new GraphEngine();

  test('buildAdjacencyMap produces deterministic sorted adjacency', () => {
    const map = engine.buildAdjacencyMap(persons, relationships);
    const p1Edges = map.get('p1');
    expect(p1Edges?.map((e) => e.to)).toEqual(['c1', 'gp', 'p2']);
  });

  test('bfsAllShortestPaths returns all shortest paths', () => {
    const map = engine.buildAdjacencyMap(persons, relationships);
    const paths = engine.bfsAllShortestPaths(map, 'gp', 'c2', 6);
    expect(paths).toContainEqual(['gp', 'p2', 'c2']);
    expect(paths.length).toBeGreaterThanOrEqual(1);
  });

  test('detectMultiplePaths identifies more than one path', () => {
    expect(engine.detectMultiplePaths([['a', 'b'], ['a', 'c', 'b']])).toBe(true);
    expect(engine.detectMultiplePaths([['a', 'b']])).toBe(false);
  });

  test('computeLowestCommonAncestor returns nearest common ancestor', () => {
    const lca = engine.computeLowestCommonAncestor('c1', 'c2', relationships, 8);
    expect(lca?.ancestorId).toBe('gp');
    expect(lca?.depthA).toBe(2);
    expect(lca?.depthB).toBe(2);
  });

  test('classifyRelationship supports cousin and in-law', () => {
    const cousin = engine.classifyRelationship('c1', 'c2', persons, relationships, 8);
    expect(cousin.label).toBe('Cousin');
    expect(cousin.degree).toBe(1);

    const inLaw = engine.classifyRelationship('p1', 'sp', persons, relationships, 8);
    expect(inLaw.label).toBe('In-law');
  });

  test('cycle detection flags parent cycles', () => {
    const cyclical: RelationshipEdge[] = [
      ...relationships,
      { id: 'r7', familyId: 'f1', fromPersonId: 'c1', toPersonId: 'gp', type: 'PARENT', metadataJson: '{}' },
    ];
    const relationship = engine.classifyRelationship('gp', 'c1', persons, cyclical, 8);
    expect(relationship.cycleDetected).toBe(true);
  });
});
