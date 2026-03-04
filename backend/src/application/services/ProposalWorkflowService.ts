import {
  ProposalStatus,
  ProposalType,
  VersionSourceType,
  type Prisma,
  type Proposal,
} from '@prisma/client';
import type { UserRole } from '@prisma/client';
import { GraphEngine } from '../../domain/services/GraphEngine';
import { GovernanceService } from '../../domain/services/GovernanceService';
import { ProposalService } from '../../domain/services/ProposalService';
import { RelationshipIntegrityService } from '../../domain/services/RelationshipIntegrityService';
import { VersioningService } from '../../domain/services/VersioningService';
import { prisma } from '../../infrastructure/db/prisma';
import { AppError, ConflictError, NotFoundError } from '../../shared/errors';
import type { AddPersonPayload, AddRelationshipPayload } from '../../shared/types';
import { IdentityConsistencyService } from './IdentityConsistencyService';
import { SnapshotService } from './SnapshotService';

export class ProposalWorkflowService {
  private readonly governance = new GovernanceService();
  private readonly proposalDomain = new ProposalService();
  private readonly versioning = new VersioningService();
  private readonly snapshots = new SnapshotService();
  private readonly graphEngine = new GraphEngine();
  private readonly relationshipIntegrity = new RelationshipIntegrityService();
  private readonly identityConsistency = new IdentityConsistencyService();

  private buildPersonMetadata(payload: AddPersonPayload): Record<string, unknown> {
    return {
      ...(payload.metadata ?? {}),
      ...(payload.givenName ? { givenName: payload.givenName } : {}),
      ...(payload.familyName ? { familyName: payload.familyName } : {}),
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.phone ? { phone: payload.phone } : {}),
      ...(payload.placeOfBirth ? { placeOfBirth: payload.placeOfBirth } : {}),
      ...(payload.occupation ? { occupation: payload.occupation } : {}),
      ...(payload.notes ? { notes: payload.notes } : {}),
      ...(payload.profilePictureUrl ? { profilePictureUrl: payload.profilePictureUrl } : {}),
      ...(payload.profilePictureDataUrl ? { profilePictureDataUrl: payload.profilePictureDataUrl } : {}),
    };
  }

  private normalizeEmail(value?: string): string | undefined {
    if (!value) return undefined;
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizePhone(value?: string): string | undefined {
    if (!value) return undefined;
    const normalized = value.replace(/[\s\-()]/g, '');
    return normalized.length > 0 ? normalized : undefined;
  }

  private async linkFamilyMembershipByPersonIdentity(
    tx: Prisma.TransactionClient,
    familyId: string,
    email: string | undefined,
    phone: string | undefined,
  ): Promise<void> {
    if (!email && !phone) return;
    const [emailUser, phoneUser] = await Promise.all([
      email ? tx.user.findUnique({ where: { email }, select: { id: true } }) : Promise.resolve(null),
      phone ? tx.user.findUnique({ where: { phone }, select: { id: true } }) : Promise.resolve(null),
    ]);
    if (emailUser && phoneUser && emailUser.id !== phoneUser.id) {
      throw new ConflictError('Provided email and phone map to different existing users');
    }
    const user = emailUser ?? phoneUser;
    if (!user) return;
    await tx.familyMember.upsert({
      where: { familyId_userId: { familyId, userId: user.id } },
      update: {},
      create: { familyId, userId: user.id },
    });
  }

  public async submitProposal(
    familyId: string,
    createdById: string,
    actorRole: UserRole,
    type: ProposalType,
    data: AddPersonPayload | AddRelationshipPayload,
  ): Promise<Proposal> {
    this.governance.assertProposalAllowed(actorRole);

    return prisma.$transaction(async (tx) => {
      const current = await this.snapshots.getCurrentSnapshot(tx, familyId);
      if (type === ProposalType.ADD_PERSON) {
        const personPayload = data as AddPersonPayload;
        if (!personPayload.email?.trim()) {
          throw new AppError('Email is required', 400);
        }
        const email = this.normalizeEmail(personPayload.email);
        const phone = this.normalizePhone(personPayload.phone);
        const duplicate = await tx.person.findFirst({
          where: {
            familyId,
            OR: [
              ...(email ? [{ email }] : []),
              ...(phone ? [{ phone }] : []),
            ],
          },
          select: { id: true, email: true, phone: true },
        });
        if (duplicate) {
          if (email && duplicate.email === email) {
            throw new ConflictError('Email already exists for another person in this family');
          }
          if (phone && duplicate.phone === phone) {
            throw new ConflictError('Phone already exists for another person in this family');
          }
        }
        await this.identityConsistency.resolveIdentity(tx, {
          mode: 'create',
          familyId,
          email: email ?? null,
          phone: phone ?? null,
          givenName: personPayload.givenName ?? null,
          familyName: personPayload.familyName ?? null,
          gender: personPayload.gender,
          dateOfBirth: personPayload.dateOfBirth ?? null,
          placeOfBirth: personPayload.placeOfBirth ?? null,
          occupation: personPayload.occupation ?? null,
          notes: personPayload.notes ?? null,
          profilePictureUrl: personPayload.profilePictureDataUrl ?? personPayload.profilePictureUrl ?? null,
        });
      }
      if (type === ProposalType.ADD_RELATIONSHIP) {
        const payload = data as AddRelationshipPayload;
        this.relationshipIntegrity.validateOrThrow(current.persons, current.relationships, {
          id: '__proposal__',
          familyId,
          fromPersonId: payload.fromPersonId,
          toPersonId: payload.toPersonId,
          type: payload.type,
        });
      }
      const simulation = this.proposalDomain.simulateProposal(current, type, data);

      const impact =
        type === ProposalType.ADD_RELATIONSHIP
          ? this.graphEngine.classifyRelationship(
              (data as AddRelationshipPayload).fromPersonId,
              (data as AddRelationshipPayload).toPersonId,
              simulation.simulated.persons,
              simulation.simulated.relationships,
            )
          : null;

      return tx.proposal.create({
        data: {
          familyId,
          type,
          payloadJson: JSON.stringify(data),
          previewJson: JSON.stringify({ diff: simulation.diff, impact }),
          createdById,
        },
      });
    });
  }

  public async listProposals(familyId: string): Promise<Proposal[]> {
    return prisma.proposal.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async approveProposal(proposalId: string, reviewerId: string): Promise<Proposal> {
    return prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findUnique({ where: { id: proposalId } });
      if (!proposal) throw new NotFoundError('Proposal not found');
      if (proposal.status !== ProposalStatus.PENDING) {
        throw new AppError('Proposal is not pending', 400);
      }

      const family = await tx.family.findUnique({ where: { id: proposal.familyId } });
      if (!family) throw new NotFoundError('Family not found');
      this.governance.assertOwner(reviewerId, family.ownerId);

      const payload = JSON.parse(proposal.payloadJson) as AddPersonPayload | AddRelationshipPayload;
      if (proposal.type === ProposalType.ADD_PERSON) {
        const personPayload = payload as AddPersonPayload;
        if (!personPayload.email?.trim()) {
          throw new AppError('Email is required', 400);
        }
        const email = this.normalizeEmail(personPayload.email);
        const phone = this.normalizePhone(personPayload.phone);
        const duplicate = await tx.person.findFirst({
          where: {
            familyId: proposal.familyId,
            OR: [
              ...(email ? [{ email }] : []),
              ...(phone ? [{ phone }] : []),
            ],
          },
          select: { id: true, email: true, phone: true },
        });
        if (duplicate) {
          if (email && duplicate.email === email) {
            throw new ConflictError('Email already exists for another person in this family');
          }
          if (phone && duplicate.phone === phone) {
            throw new ConflictError('Phone already exists for another person in this family');
          }
        }
        const identityResolution = await this.identityConsistency.resolveIdentity(tx, {
          mode: 'create',
          familyId: proposal.familyId,
          email: email ?? null,
          phone: phone ?? null,
          givenName: personPayload.givenName ?? null,
          familyName: personPayload.familyName ?? null,
          gender: personPayload.gender,
          dateOfBirth: personPayload.dateOfBirth ?? null,
          placeOfBirth: personPayload.placeOfBirth ?? null,
          occupation: personPayload.occupation ?? null,
          notes: personPayload.notes ?? null,
          profilePictureUrl: personPayload.profilePictureDataUrl ?? personPayload.profilePictureUrl ?? null,
        });
        const identity = identityResolution.details;
        const identityId = await this.identityConsistency.syncIdentityEverywhere(
          tx,
          identity,
          identityResolution.linkedUserId,
          identityResolution.identityId,
        );
        const metadataSeed = JSON.stringify(this.buildPersonMetadata(personPayload));
        await tx.person.create({
          data: {
            familyId: proposal.familyId,
            identityId,
            name: this.identityConsistency.buildName(identity),
            givenName: identity.givenName,
            familyName: identity.familyName,
            gender: identity.gender,
            dateOfBirth: identity.dateOfBirth,
            email: identity.email,
            phone: identity.phone,
            profilePictureUrl: identity.profilePictureUrl,
            metadataJson: this.identityConsistency.buildMetadata(metadataSeed, identity),
          },
        });
        await this.linkFamilyMembershipByPersonIdentity(
          tx,
          proposal.familyId,
          identity.email ?? undefined,
          identity.phone ?? undefined,
        );
      }

      if (proposal.type === ProposalType.ADD_RELATIONSHIP) {
        const relationshipPayload = payload as AddRelationshipPayload;
        const [persons, relationships] = await Promise.all([
          tx.person.findMany({ where: { familyId: proposal.familyId }, orderBy: { id: 'asc' } }),
          tx.relationship.findMany({ where: { familyId: proposal.familyId }, orderBy: { id: 'asc' } }),
        ]);
        this.relationshipIntegrity.validateOrThrow(persons, relationships, {
          id: '__approved_proposal__',
          familyId: proposal.familyId,
          fromPersonId: relationshipPayload.fromPersonId,
          toPersonId: relationshipPayload.toPersonId,
          type: relationshipPayload.type,
        });
        await tx.relationship.create({
          data: {
            familyId: proposal.familyId,
            fromPersonId: relationshipPayload.fromPersonId,
            toPersonId: relationshipPayload.toPersonId,
            type: relationshipPayload.type,
            metadataJson: JSON.stringify(relationshipPayload.metadata ?? {}),
          },
        });
      }

      const versionNumber = await this.createVersion(
        tx,
        proposal.familyId,
        reviewerId,
        VersionSourceType.PROPOSAL,
        proposal.id,
        `Approved proposal ${proposal.id}`,
      );

      const updated = await tx.proposal.update({
        where: { id: proposal.id },
        data: {
          status: ProposalStatus.APPROVED,
          reviewedById: reviewerId,
          appliedVersionNumber: versionNumber,
        },
      });

      await tx.auditLog.create({
        data: {
          familyId: proposal.familyId,
          actorId: reviewerId,
          action: 'PROPOSAL_APPROVED',
          metadataJson: JSON.stringify({ proposalId: proposal.id, versionNumber }),
        },
      });

      return updated;
    });
  }

  public async rejectProposal(proposalId: string, reviewerId: string, reason: string): Promise<Proposal> {
    return prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findUnique({ where: { id: proposalId } });
      if (!proposal) throw new NotFoundError('Proposal not found');
      if (proposal.status !== ProposalStatus.PENDING) {
        throw new AppError('Proposal is not pending', 400);
      }

      const family = await tx.family.findUnique({ where: { id: proposal.familyId } });
      if (!family) throw new NotFoundError('Family not found');
      this.governance.assertOwner(reviewerId, family.ownerId);

      const updated = await tx.proposal.update({
        where: { id: proposal.id },
        data: {
          status: ProposalStatus.REJECTED,
          reviewedById: reviewerId,
          reviewReason: reason,
        },
      });

      await tx.auditLog.create({
        data: {
          familyId: proposal.familyId,
          actorId: reviewerId,
          action: 'PROPOSAL_REJECTED',
          metadataJson: JSON.stringify({ proposalId: proposal.id, reason }),
        },
      });

      return updated;
    });
  }

  private async createVersion(
    tx: Prisma.TransactionClient,
    familyId: string,
    actorId: string,
    sourceType: VersionSourceType,
    sourceId: string,
    message: string,
  ): Promise<number> {
    const versions = await tx.familyVersion.findMany({ where: { familyId }, select: { versionNumber: true } });
    const nextVersion = this.versioning.nextVersionNumber(versions.map((v) => v.versionNumber));
    const snapshot = await this.snapshots.getCurrentSnapshot(tx, familyId);

    await tx.familyVersion.create({
      data: {
        familyId,
        versionNumber: nextVersion,
        snapshotJson: this.versioning.buildSnapshot(snapshot),
        createdById: actorId,
        sourceType,
        sourceId,
        message,
      },
    });

    return nextVersion;
  }
}
