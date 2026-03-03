import { GraphEngine } from '../../domain/services/GraphEngine';
import { prisma } from '../../infrastructure/db/prisma';
import { NotFoundError } from '../../shared/errors';
import type { RelationshipClassification } from '../../shared/types';

export class RelationshipService {
  private readonly graphEngine = new GraphEngine();

  public async getRelationship(
    familyId: string,
    personA: string,
    personB: string,
  ): Promise<RelationshipClassification> {
    const [persons, relationships] = await Promise.all([
      prisma.person.findMany({ where: { familyId }, orderBy: { id: 'asc' } }),
      prisma.relationship.findMany({ where: { familyId }, orderBy: { id: 'asc' } }),
    ]);

    const personIds = new Set(persons.map((p) => p.id));
    if (!personIds.has(personA) || !personIds.has(personB)) {
      throw new NotFoundError('One or both persons not found in family');
    }

    return this.graphEngine.classifyRelationship(personA, personB, persons, relationships, 10);
  }
}
