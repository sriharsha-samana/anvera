import type { VersionSourceType } from '@prisma/client';

export class VersionEntity {
  constructor(
    public readonly id: string,
    public readonly familyId: string,
    public readonly versionNumber: number,
    public readonly snapshotJson: string,
    public readonly sourceType: VersionSourceType,
    public readonly sourceId: string | null,
  ) {}
}
