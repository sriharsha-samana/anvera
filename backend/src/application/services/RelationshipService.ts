import { GraphEngine } from '../../domain/services/GraphEngine';
import { KinshipResolverV2, type KinshipPayload } from '../../domain/kinship/KinshipResolverV2';
import { prisma } from '../../infrastructure/db/prisma';
import { NotFoundError } from '../../shared/errors';
import type { RelationshipClassification } from '../../shared/types';

type RelationshipResult = RelationshipClassification & { kinship?: KinshipPayload | null };

export class RelationshipService {
  private readonly graphEngine = new GraphEngine();
  private readonly kinshipResolverV2 = new KinshipResolverV2();

  public async getRelationship(
    familyId: string,
    personA: string,
    personB: string,
    options?: { culture?: string; locale?: string; language?: string },
  ): Promise<RelationshipResult> {
    const [persons, relationships] = await Promise.all([
      prisma.person.findMany({ where: { familyId }, orderBy: { id: 'asc' } }),
      prisma.relationship.findMany({ where: { familyId }, orderBy: { id: 'asc' } }),
    ]);

    const personIds = new Set(persons.map((p) => p.id));
    if (!personIds.has(personA) || !personIds.has(personB)) {
      throw new NotFoundError('One or both persons not found in family');
    }

    const classification = this.graphEngine.classifyRelationship(
      personA,
      personB,
      persons,
      relationships,
      10,
    );
    if (!this.isTeluguRequested(options?.culture, options?.locale, options?.language)) {
      return classification;
    }

    const primaryPath = classification.paths?.[0] ?? [];
    const kinship = this.kinshipResolverV2.resolve({
      personAId: personA,
      personBId: personB,
      persons,
      relationships,
      primaryPath,
    });

    return { ...classification, kinship };
  }

  private isTeluguRequested(culture?: string, locale?: string, language?: string): boolean {
    const values = [culture, locale, language].filter((value): value is string => Boolean(value));
    return values.some((value) => {
      const normalized = value.trim().toLowerCase();
      return normalized === 'telugu' || normalized.startsWith('te');
    });
  }
}
