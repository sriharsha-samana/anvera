import type { Prisma, PrismaClient } from '@prisma/client';
import type { Snapshot } from '../../shared/types';

export class SnapshotService {
  public async getCurrentSnapshot(
    db: PrismaClient | Prisma.TransactionClient,
    familyId: string,
  ): Promise<Snapshot> {
    const [persons, relationships] = await Promise.all([
      db.person.findMany({ where: { familyId }, orderBy: { id: 'asc' } }),
      db.relationship.findMany({ where: { familyId }, orderBy: { id: 'asc' } }),
    ]);

    return { persons, relationships };
  }
}
