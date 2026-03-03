import { ProposalStatus, ProposalType } from '@prisma/client';

export class ProposalEntity {
  constructor(
    public readonly id: string,
    public readonly familyId: string,
    public readonly type: ProposalType,
    public readonly payloadJson: string,
    public readonly status: ProposalStatus,
    public readonly createdById: string,
    public readonly appliedVersionNumber: number | null,
    public readonly overriddenByVersionNumber: number | null,
  ) {}

  public isPending(): boolean {
    return this.status === ProposalStatus.PENDING;
  }
}
