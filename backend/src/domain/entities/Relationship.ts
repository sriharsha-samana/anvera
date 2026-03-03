import { RelationshipType } from '@prisma/client';

export class RelationshipEntity {
  constructor(
    public readonly id: string,
    public readonly familyId: string,
    public readonly fromPersonId: string,
    public readonly toPersonId: string,
    public readonly type: RelationshipType,
    public readonly metadataJson: string,
  ) {}
}
