import { GraphEngine } from '../../domain/services/GraphEngine';
import { TeluguKinshipResolver, type KinshipTerm } from '../../domain/services/TeluguKinshipResolver';
import { prisma } from '../../infrastructure/db/prisma';
import { NotFoundError } from '../../shared/errors';
import type { RelationshipClassification } from '../../shared/types';

type RelationshipResult = RelationshipClassification & { term?: KinshipTerm };

export class RelationshipService {
  private readonly graphEngine = new GraphEngine();
  private readonly teluguResolver = new TeluguKinshipResolver();

  public async getRelationship(
    familyId: string,
    personA: string,
    personB: string,
    options?: { culture?: string; locale?: string },
  ): Promise<RelationshipResult> {
    const [persons, relationships] = await Promise.all([
      prisma.person.findMany({ where: { familyId }, orderBy: { id: 'asc' } }),
      prisma.relationship.findMany({ where: { familyId }, orderBy: { id: 'asc' } }),
    ]);

    const personIds = new Set(persons.map((p) => p.id));
    if (!personIds.has(personA) || !personIds.has(personB)) {
      throw new NotFoundError('One or both persons not found in family');
    }

    const classification = this.graphEngine.classifyRelationship(personA, personB, persons, relationships, 10);
    if (!this.isTeluguRequested(options?.culture, options?.locale)) {
      return classification;
    }

    const term = this.teluguResolver.resolve({
      personAId: personA,
      personBId: personB,
      persons,
      relationships,
      classification,
    });

    return term ? { ...classification, term } : classification;
  }

  private isTeluguRequested(culture?: string, locale?: string): boolean {
    const values = [culture, locale].filter((value): value is string => Boolean(value));
    return values.some((value) => value.trim().toLowerCase().startsWith('te'));
  }
}
