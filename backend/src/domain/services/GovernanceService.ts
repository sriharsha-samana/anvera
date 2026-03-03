import { UserRole } from '@prisma/client';
import { ForbiddenError } from '../../shared/errors';

export class GovernanceService {
  public assertOwner(actorId: string, ownerId: string): void {
    if (actorId !== ownerId) {
      throw new ForbiddenError('Only the family owner can directly mutate the family graph');
    }
  }

  public assertProposalAllowed(actorRole: UserRole): void {
    if (![UserRole.OWNER, UserRole.MEMBER].includes(actorRole)) {
      throw new ForbiddenError('User role is not allowed to submit proposals');
    }
  }
}
