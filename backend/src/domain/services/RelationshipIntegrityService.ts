import { RelationshipType } from '@prisma/client';
import { AppError } from '../../shared/errors';
import type { RelationshipEdge, PersonNode } from '../../shared/types';

const BIDIRECTIONAL_TYPES = new Set<RelationshipType>([
  RelationshipType.SPOUSE,
  RelationshipType.SIBLING,
  RelationshipType.INLAW,
]);

export class RelationshipIntegrityService {
  public validateOrThrow(
    persons: PersonNode[],
    relationships: RelationshipEdge[],
    candidate: Pick<RelationshipEdge, 'id' | 'familyId' | 'fromPersonId' | 'toPersonId' | 'type'>,
    excludeRelationshipId?: string,
  ): void {
    const personIds = new Set(persons.map((p) => p.id));
    if (!personIds.has(candidate.fromPersonId) || !personIds.has(candidate.toPersonId)) {
      throw new AppError('Relationship persons not found in family', 400);
    }

    if (candidate.fromPersonId === candidate.toPersonId) {
      throw new AppError('A relationship cannot reference the same person on both sides', 400);
    }

    const existing = relationships.filter((r) => r.id !== excludeRelationshipId);
    this.assertNoContradictoryPair(existing, candidate);
    this.assertNoDuplicate(existing, candidate);

    if (candidate.type === RelationshipType.PARENT) {
      this.assertParentSpecificRules(existing, candidate);
      return;
    }

    if (candidate.type === RelationshipType.SPOUSE) {
      this.assertSpouseSpecificRules(existing, candidate);
    }
  }

  private assertNoContradictoryPair(
    relationships: RelationshipEdge[],
    candidate: Pick<RelationshipEdge, 'fromPersonId' | 'toPersonId' | 'type'>,
  ): void {
    const existingTypes = new Set<RelationshipType>();
    for (const rel of relationships) {
      if (!this.isSameUnorderedPair(rel.fromPersonId, rel.toPersonId, candidate.fromPersonId, candidate.toPersonId)) {
        continue;
      }
      existingTypes.add(rel.type);
    }

    if (existingTypes.size === 0) return;
    if (existingTypes.size === 1 && existingTypes.has(candidate.type)) return;

    const sorted = [...existingTypes].sort((a, b) => a.localeCompare(b)).join(', ');
    throw new AppError(
      `Conflicting relationship already exists between these people (existing: ${sorted}, requested: ${candidate.type})`,
      400,
    );
  }

  private assertNoDuplicate(
    relationships: RelationshipEdge[],
    candidate: Pick<RelationshipEdge, 'fromPersonId' | 'toPersonId' | 'type'>,
  ): void {
    if (BIDIRECTIONAL_TYPES.has(candidate.type)) {
      const duplicate = relationships.some(
        (r) =>
          r.type === candidate.type &&
          this.isSameUnorderedPair(r.fromPersonId, r.toPersonId, candidate.fromPersonId, candidate.toPersonId),
      );
      if (duplicate) {
        throw new AppError(`Duplicate ${candidate.type} relationship`, 400);
      }
      return;
    }

    const duplicate = relationships.some(
      (r) =>
        r.type === candidate.type &&
        r.fromPersonId === candidate.fromPersonId &&
        r.toPersonId === candidate.toPersonId,
    );
    if (duplicate) {
      throw new AppError(`Duplicate ${candidate.type} relationship`, 400);
    }
  }

  private assertParentSpecificRules(
    relationships: RelationshipEdge[],
    candidate: Pick<RelationshipEdge, 'fromPersonId' | 'toPersonId'>,
  ): void {
    const reverseParent = relationships.some(
      (r) =>
        r.type === RelationshipType.PARENT &&
        r.fromPersonId === candidate.toPersonId &&
        r.toPersonId === candidate.fromPersonId,
    );
    if (reverseParent) {
      throw new AppError('Invalid parent relationship: reverse parent edge already exists', 400);
    }

    const existingParents = new Set(
      relationships
        .filter((r) => r.type === RelationshipType.PARENT && r.toPersonId === candidate.toPersonId)
        .map((r) => r.fromPersonId),
    );
    if (!existingParents.has(candidate.fromPersonId) && existingParents.size >= 2) {
      throw new AppError('A child cannot have more than two parents', 400);
    }

    if (this.hasDescendantPath(relationships, candidate.toPersonId, candidate.fromPersonId)) {
      throw new AppError('Invalid parent relationship: this would create an ancestry cycle', 400);
    }
  }

  private assertSpouseSpecificRules(
    relationships: RelationshipEdge[],
    candidate: Pick<RelationshipEdge, 'fromPersonId' | 'toPersonId'>,
  ): void {
    if (this.hasDescendantPath(relationships, candidate.fromPersonId, candidate.toPersonId)) {
      throw new AppError('Invalid spouse relationship: spouse cannot be your descendant', 400);
    }

    if (this.hasDescendantPath(relationships, candidate.toPersonId, candidate.fromPersonId)) {
      throw new AppError('Invalid spouse relationship: spouse cannot be your ancestor', 400);
    }
  }

  private hasDescendantPath(relationships: RelationshipEdge[], startId: string, targetId: string): boolean {
    if (startId === targetId) return true;
    const childrenByParent = new Map<string, string[]>();
    for (const rel of relationships) {
      if (rel.type !== RelationshipType.PARENT) continue;
      const children = childrenByParent.get(rel.fromPersonId) ?? [];
      children.push(rel.toPersonId);
      childrenByParent.set(rel.fromPersonId, children);
    }
    for (const [, children] of childrenByParent) {
      children.sort((a, b) => a.localeCompare(b));
    }

    const queue: string[] = [startId];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      for (const child of childrenByParent.get(current) ?? []) {
        if (child === targetId) return true;
        if (visited.has(child)) continue;
        visited.add(child);
        queue.push(child);
      }
    }

    return false;
  }

  private isSameUnorderedPair(a1: string, b1: string, a2: string, b2: string): boolean {
    return (a1 === a2 && b1 === b2) || (a1 === b2 && b1 === a2);
  }
}
