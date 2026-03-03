import type { Snapshot } from '../../shared/types';

export class VersioningService {
  public nextVersionNumber(existingVersions: number[]): number {
    if (existingVersions.length === 0) return 1;
    return Math.max(...existingVersions) + 1;
  }

  public buildSnapshot(snapshot: Snapshot): string {
    return JSON.stringify(snapshot);
  }

  public parseSnapshot(snapshotJson: string): Snapshot {
    const parsed = JSON.parse(snapshotJson) as Snapshot;
    return {
      persons: parsed.persons,
      relationships: parsed.relationships,
    };
  }
}
