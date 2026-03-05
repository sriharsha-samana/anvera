import { ProposalStatus, VersionSourceType, type FamilyVersion } from '@prisma/client';
import { GovernanceService } from '../../domain/services/GovernanceService';
import { VersioningService } from '../../domain/services/VersioningService';
import { prisma } from '../../infrastructure/db/prisma';
import { NotFoundError } from '../../shared/errors';

export class VersionService {
  private readonly governance = new GovernanceService();
  private readonly versioning = new VersioningService();

  public async listVersions(familyId: string): Promise<FamilyVersion[]> {
    return prisma.familyVersion.findMany({
      where: { familyId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  public async rollbackToVersion(
    familyId: string,
    versionNumber: number,
    actorId: string,
  ): Promise<FamilyVersion> {
    return prisma.$transaction(async (tx) => {
      const family = await tx.family.findUnique({ where: { id: familyId } });
      if (!family) throw new NotFoundError('Family not found');
      this.governance.assertOwner(actorId, family.ownerId);

      const targetVersion = await tx.familyVersion.findUnique({
        where: {
          familyId_versionNumber: { familyId, versionNumber },
        },
      });

      if (!targetVersion) {
        throw new NotFoundError('Target version not found');
      }

      const snapshot = this.versioning.parseSnapshot(targetVersion.snapshotJson);

      await tx.relationship.deleteMany({ where: { familyId } });
      await tx.person.deleteMany({ where: { familyId } });

      if (snapshot.persons.length > 0) {
        const personRows = [];
        for (const person of snapshot.persons) {
          let identityId = person.identityId;
          if (!identityId) {
            const email = person.email ?? null;
            const phone = person.phone ?? null;
            const [emailIdentity, phoneIdentity] = await Promise.all([
              email
                ? tx.personIdentity.findUnique({ where: { email }, select: { id: true } })
                : Promise.resolve(null),
              phone
                ? tx.personIdentity.findUnique({ where: { phone }, select: { id: true } })
                : Promise.resolve(null),
            ]);
            if (emailIdentity && phoneIdentity && emailIdentity.id !== phoneIdentity.id) {
              throw new Error(
                'Snapshot identity conflict: email and phone map to different identities',
              );
            }
            if (emailIdentity || phoneIdentity) {
              identityId = (emailIdentity ?? phoneIdentity)!.id;
            } else {
              const createdIdentity = await tx.personIdentity.create({
                data: {
                  email,
                  phone,
                  givenName: person.givenName ?? null,
                  familyName: person.familyName ?? null,
                  gender: person.gender,
                  dateOfBirth: person.dateOfBirth ?? null,
                  profilePictureUrl: person.profilePictureUrl ?? null,
                },
              });
              identityId = createdIdentity.id;
            }
          }
          personRows.push({ ...person, identityId });
        }
        await tx.person.createMany({ data: personRows });
      }
      if (snapshot.relationships.length > 0) {
        await tx.relationship.createMany({ data: snapshot.relationships });
      }

      const versions = await tx.familyVersion.findMany({
        where: { familyId },
        select: { versionNumber: true },
      });
      const nextVersion = this.versioning.nextVersionNumber(versions.map((v) => v.versionNumber));

      await tx.proposal.updateMany({
        where: {
          familyId,
          status: ProposalStatus.APPROVED,
          appliedVersionNumber: { gt: versionNumber },
        },
        data: {
          overriddenByVersionNumber: nextVersion,
        },
      });

      const created = await tx.familyVersion.create({
        data: {
          familyId,
          versionNumber: nextVersion,
          snapshotJson: this.versioning.buildSnapshot(snapshot),
          createdById: actorId,
          sourceType: VersionSourceType.ROLLBACK,
          sourceId: targetVersion.id,
          message: `Rollback to version ${versionNumber}`,
          rollbackFromVersion: versionNumber,
        },
      });

      await tx.auditLog.create({
        data: {
          familyId,
          actorId,
          action: 'ROLLBACK_EXECUTED',
          metadataJson: JSON.stringify({ targetVersion: versionNumber, newVersion: nextVersion }),
        },
      });

      return created;
    });
  }
}
