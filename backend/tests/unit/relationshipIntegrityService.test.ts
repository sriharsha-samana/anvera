import { RelationshipType } from '@prisma/client';
import { RelationshipIntegrityService } from '../../src/domain/services/RelationshipIntegrityService';
import type { PersonNode, RelationshipEdge } from '../../src/shared/types';

const makePerson = (id: string): PersonNode => ({
  id,
  familyId: 'fam-1',
  name: id,
  gender: 'unknown',
  dateOfBirth: null,
  metadataJson: '{}',
});

const makeRelationship = (
  id: string,
  fromPersonId: string,
  toPersonId: string,
  type: RelationshipType,
): RelationshipEdge => ({
  id,
  familyId: 'fam-1',
  fromPersonId,
  toPersonId,
  type,
  metadataJson: '{}',
});

describe('RelationshipIntegrityService', () => {
  const service = new RelationshipIntegrityService();
  const persons = [makePerson('a'), makePerson('b'), makePerson('c')];

  test('rejects parent cycle', () => {
    const relationships = [makeRelationship('r1', 'a', 'b', RelationshipType.PARENT)];
    expect(() =>
      service.validateOrThrow(persons, relationships, {
        id: 'r2',
        familyId: 'fam-1',
        fromPersonId: 'b',
        toPersonId: 'a',
        type: RelationshipType.PARENT,
      }),
    ).toThrow('Invalid parent relationship');
  });

  test('rejects spouse between ancestor and descendant', () => {
    const relationships = [
      makeRelationship('r1', 'a', 'b', RelationshipType.PARENT),
      makeRelationship('r2', 'b', 'c', RelationshipType.PARENT),
    ];
    expect(() =>
      service.validateOrThrow(persons, relationships, {
        id: 'r3',
        familyId: 'fam-1',
        fromPersonId: 'a',
        toPersonId: 'c',
        type: RelationshipType.SPOUSE,
      }),
    ).toThrow('Invalid spouse relationship');
  });

  test('rejects contradictory type between same pair', () => {
    const relationships = [makeRelationship('r1', 'a', 'b', RelationshipType.SPOUSE)];
    expect(() =>
      service.validateOrThrow(persons, relationships, {
        id: 'r2',
        familyId: 'fam-1',
        fromPersonId: 'a',
        toPersonId: 'b',
        type: RelationshipType.PARENT,
      }),
    ).toThrow('Conflicting relationship already exists');
  });

  test('rejects duplicate bidirectional relationship', () => {
    const relationships = [makeRelationship('r1', 'a', 'b', RelationshipType.SPOUSE)];
    expect(() =>
      service.validateOrThrow(persons, relationships, {
        id: 'r2',
        familyId: 'fam-1',
        fromPersonId: 'b',
        toPersonId: 'a',
        type: RelationshipType.SPOUSE,
      }),
    ).toThrow('Duplicate SPOUSE relationship');
  });

  test('allows update when only excluded relationship matches', () => {
    const relationships = [makeRelationship('r1', 'a', 'b', RelationshipType.SPOUSE)];
    expect(() =>
      service.validateOrThrow(
        persons,
        relationships,
        {
          id: 'r1',
          familyId: 'fam-1',
          fromPersonId: 'a',
          toPersonId: 'b',
          type: RelationshipType.SPOUSE,
        },
        'r1',
      ),
    ).not.toThrow();
  });
});
