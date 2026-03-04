import { randomUUID } from 'crypto';
import { RelationshipType, UserRole, VersionSourceType, type Prisma } from '@prisma/client';
import { GovernanceService } from '../../domain/services/GovernanceService';
import { RelationshipIntegrityService } from '../../domain/services/RelationshipIntegrityService';
import { VersioningService } from '../../domain/services/VersioningService';
import { prisma } from '../../infrastructure/db/prisma';
import { AppError, ConflictError, NotFoundError } from '../../shared/errors';
import type { AddPersonPayload, AddRelationshipPayload } from '../../shared/types';
import { IdentityConsistencyService } from './IdentityConsistencyService';
import { SnapshotService } from './SnapshotService';

export class FamilyService {
  private readonly governanceService = new GovernanceService();
  private readonly relationshipIntegrity = new RelationshipIntegrityService();
  private readonly versioningService = new VersioningService();
  private readonly snapshotService = new SnapshotService();
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

  private mapEntityId(map: Map<string, string>, sourceId: string, prefix: string): string {
    const existing = map.get(sourceId);
    if (existing) return existing;
    const created = `${prefix}_${randomUUID()}`;
    map.set(sourceId, created);
    return created;
  }

  private remapSnapshotJson(
    snapshotJson: string,
    personIdMap: Map<string, string>,
    relationshipIdMap: Map<string, string>,
    targetFamilyId: string,
  ): string {
    const parsed = JSON.parse(snapshotJson) as {
      persons: Array<Record<string, unknown>>;
      relationships: Array<Record<string, unknown>>;
    };

    const persons = (parsed.persons ?? []).map((person) => {
      const sourceId = String(person.id ?? '');
      if (!sourceId) return person;
      const targetId = this.mapEntityId(personIdMap, sourceId, 'person');
      return {
        ...person,
        id: targetId,
        familyId: targetFamilyId,
      };
    });

    const relationships = (parsed.relationships ?? []).map((relationship) => {
      const sourceRelationshipId = String(relationship.id ?? '');
      const sourceFromId = String(relationship.fromPersonId ?? '');
      const sourceToId = String(relationship.toPersonId ?? '');
      const targetRelationshipId = sourceRelationshipId
        ? this.mapEntityId(relationshipIdMap, sourceRelationshipId, 'relationship')
        : sourceRelationshipId;
      const targetFromId = sourceFromId ? this.mapEntityId(personIdMap, sourceFromId, 'person') : sourceFromId;
      const targetToId = sourceToId ? this.mapEntityId(personIdMap, sourceToId, 'person') : sourceToId;

      return {
        ...relationship,
        id: targetRelationshipId,
        familyId: targetFamilyId,
        fromPersonId: targetFromId,
        toPersonId: targetToId,
      };
    });

    return JSON.stringify({ persons, relationships });
  }

  private remapVersionSourceId(
    sourceType: VersionSourceType,
    sourceId: string | null,
    personIdMap: Map<string, string>,
    relationshipIdMap: Map<string, string>,
    proposalIdMap: Map<string, string>,
    versionIdMap: Map<string, string>,
  ): string | null {
    if (!sourceId) return null;
    if (sourceType === VersionSourceType.PROPOSAL) {
      return proposalIdMap.get(sourceId) ?? sourceId;
    }
    if (sourceType === VersionSourceType.ROLLBACK) {
      return versionIdMap.get(sourceId) ?? sourceId;
    }
    return personIdMap.get(sourceId) ?? relationshipIdMap.get(sourceId) ?? proposalIdMap.get(sourceId) ?? sourceId;
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

  private async assertUniquePersonIdentity(
    tx: Prisma.TransactionClient,
    familyId: string,
    email: string | undefined,
    phone: string | undefined,
    excludePersonId?: string,
  ): Promise<void> {
    const conditions: Array<Record<string, unknown>> = [];
    if (email) conditions.push({ email });
    if (phone) conditions.push({ phone });
    if (conditions.length === 0) return;

    const duplicate = await tx.person.findFirst({
      where: {
        familyId,
        OR: conditions as Prisma.PersonWhereInput[],
        ...(excludePersonId ? { id: { not: excludePersonId } } : {}),
      },
      select: { id: true, email: true, phone: true, name: true },
    });
    if (!duplicate) return;
    if (email && duplicate.email === email) {
      throw new ConflictError('Email already exists for another person in this family');
    }
    if (phone && duplicate.phone === phone) {
      throw new ConflictError('Phone already exists for another person in this family');
    }
  }

  public async listFamilies(userId: string): Promise<unknown[]> {
    const families = await prisma.family.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            givenName: true,
            familyName: true,
            email: true,
            phone: true,
            gender: true,
            dateOfBirth: true,
          },
        },
        _count: {
          select: {
            persons: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return families.map((family) => ({
      ...family,
      totalMembers: family._count?.persons ?? 0,
      ownerName:
        `${family.owner?.givenName ?? ''} ${family.owner?.familyName ?? ''}`.trim() ||
        family.owner?.username ||
        family.ownerId,
      myRole: family.ownerId === userId ? UserRole.OWNER : UserRole.MEMBER,
    }));
  }

  public async createFamily(name: string, ownerId: string): Promise<unknown> {
    return prisma.$transaction(async (tx) => {
      const family = await tx.family.create({
        data: {
          name,
          ownerId,
          members: { create: [{ userId: ownerId }] },
        },
      });

      const snapshot = await this.snapshotService.getCurrentSnapshot(tx, family.id);
      await tx.familyVersion.create({
        data: {
          familyId: family.id,
          versionNumber: 1,
          snapshotJson: this.versioningService.buildSnapshot(snapshot),
          createdById: ownerId,
          sourceType: VersionSourceType.MANUAL_EDIT,
          message: 'Initial family creation snapshot',
        },
      });

      return family;
    });
  }

  public async deleteFamily(familyId: string, actorId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const family = await tx.family.findUnique({ where: { id: familyId } });
      if (!family) throw new NotFoundError('Family not found');
      this.governanceService.assertOwner(actorId, family.ownerId);

      await tx.auditLog.deleteMany({ where: { familyId } });
      await tx.familyVersion.deleteMany({ where: { familyId } });
      await tx.proposal.deleteMany({ where: { familyId } });
      await tx.relationship.deleteMany({ where: { familyId } });
      await tx.person.deleteMany({ where: { familyId } });
      await tx.familyMember.deleteMany({ where: { familyId } });
      await tx.family.delete({ where: { id: familyId } });
    });
  }

  public async updateFamilyName(familyId: string, actorId: string, name: string): Promise<unknown> {
    return prisma.$transaction(async (tx) => {
      const family = await tx.family.findUnique({ where: { id: familyId } });
      if (!family) throw new NotFoundError('Family not found');
      this.governanceService.assertOwner(actorId, family.ownerId);

      const updated = await tx.family.update({
        where: { id: familyId },
        data: { name: name.trim() },
      });

      await tx.auditLog.create({
        data: {
          familyId,
          actorId,
          action: 'FAMILY_RENAMED',
          metadataJson: JSON.stringify({ oldName: family.name, newName: updated.name }),
        },
      });

      return updated;
    });
  }

  public async cloneFamily(sourceFamilyId: string, actorId: string, requestedName?: string): Promise<unknown> {
    return prisma.$transaction(async (tx) => {
      const sourceFamily = await tx.family.findUnique({ where: { id: sourceFamilyId } });
      if (!sourceFamily) throw new NotFoundError('Family not found');
      const actorMembership = await tx.familyMember.findUnique({
        where: { familyId_userId: { familyId: sourceFamilyId, userId: actorId } },
      });
      if (!actorMembership) {
        throw new NotFoundError('User is not a member of this family');
      }

      const cloneName = (requestedName?.trim() || `${sourceFamily.name} (Copy)`).slice(0, 120);

      const [members, persons, relationships, proposals, versions, audits] = await Promise.all([
        tx.familyMember.findMany({ where: { familyId: sourceFamilyId }, orderBy: { joinedAt: 'asc' } }),
        tx.person.findMany({ where: { familyId: sourceFamilyId }, orderBy: { createdAt: 'asc' } }),
        tx.relationship.findMany({ where: { familyId: sourceFamilyId }, orderBy: { createdAt: 'asc' } }),
        tx.proposal.findMany({ where: { familyId: sourceFamilyId }, orderBy: { createdAt: 'asc' } }),
        tx.familyVersion.findMany({ where: { familyId: sourceFamilyId }, orderBy: { versionNumber: 'asc' } }),
        tx.auditLog.findMany({ where: { familyId: sourceFamilyId }, orderBy: { createdAt: 'asc' } }),
      ]);

      const personIdMap = new Map<string, string>();
      const relationshipIdMap = new Map<string, string>();
      const proposalIdMap = new Map<string, string>();
      const versionIdMap = new Map<string, string>();

      persons.forEach((person) => {
        this.mapEntityId(personIdMap, person.id, 'person');
      });
      relationships.forEach((relationship) => {
        this.mapEntityId(relationshipIdMap, relationship.id, 'relationship');
        this.mapEntityId(personIdMap, relationship.fromPersonId, 'person');
        this.mapEntityId(personIdMap, relationship.toPersonId, 'person');
      });
      proposals.forEach((proposal) => {
        this.mapEntityId(proposalIdMap, proposal.id, 'proposal');
      });
      versions.forEach((version) => {
        this.mapEntityId(versionIdMap, version.id, 'version');
        this.remapSnapshotJson(version.snapshotJson, personIdMap, relationshipIdMap, '__pending__');
      });

      const clonedFamily = await tx.family.create({
        data: {
          name: cloneName,
          ownerId: actorId,
          members: { create: [{ userId: actorId }] },
        },
      });

      const additionalMembers = members.filter(
        (member) => member.userId !== actorId && member.userId !== clonedFamily.ownerId,
      );
      if (additionalMembers.length > 0) {
        await tx.familyMember.createMany({
          data: additionalMembers.map((member) => ({
            familyId: clonedFamily.id,
            userId: member.userId,
            joinedAt: member.joinedAt,
          })),
        });
      }

      if (persons.length > 0) {
        await tx.person.createMany({
          data: persons.map((person) => ({
            ...person,
            id: this.mapEntityId(personIdMap, person.id, 'person'),
            familyId: clonedFamily.id,
          })),
        });
      }

      if (relationships.length > 0) {
        await tx.relationship.createMany({
          data: relationships.map((relationship) => ({
            ...relationship,
            id: this.mapEntityId(relationshipIdMap, relationship.id, 'relationship'),
            familyId: clonedFamily.id,
            fromPersonId: this.mapEntityId(personIdMap, relationship.fromPersonId, 'person'),
            toPersonId: this.mapEntityId(personIdMap, relationship.toPersonId, 'person'),
          })),
        });
      }

      if (proposals.length > 0) {
        await tx.proposal.createMany({
          data: proposals.map((proposal) => ({
            ...proposal,
            id: this.mapEntityId(proposalIdMap, proposal.id, 'proposal'),
            familyId: clonedFamily.id,
          })),
        });
      }

      if (versions.length > 0) {
        await tx.familyVersion.createMany({
          data: versions.map((version) => ({
            ...version,
            id: this.mapEntityId(versionIdMap, version.id, 'version'),
            familyId: clonedFamily.id,
            snapshotJson: this.remapSnapshotJson(
              version.snapshotJson,
              personIdMap,
              relationshipIdMap,
              clonedFamily.id,
            ),
            sourceId: this.remapVersionSourceId(
              version.sourceType,
              version.sourceId,
              personIdMap,
              relationshipIdMap,
              proposalIdMap,
              versionIdMap,
            ),
          })),
        });
      }

      if (audits.length > 0) {
        await tx.auditLog.createMany({
          data: audits.map((audit) => ({
            ...audit,
            id: `audit_${randomUUID()}`,
            familyId: clonedFamily.id,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          familyId: sourceFamilyId,
          actorId,
          action: 'FAMILY_CLONED',
          metadataJson: JSON.stringify({ clonedFamilyId: clonedFamily.id }),
        },
      });
      await tx.auditLog.create({
        data: {
          familyId: clonedFamily.id,
          actorId,
          action: 'FAMILY_CLONED_FROM_SOURCE',
          metadataJson: JSON.stringify({ sourceFamilyId }),
        },
      });

      return clonedFamily;
    });
  }

  public async listPersons(familyId: string, userId: string): Promise<unknown[]> {
    await this.ensureFamilyMembership(familyId, userId);
    return prisma.person.findMany({ where: { familyId }, orderBy: { name: 'asc' } });
  }

  public async listRelationships(familyId: string, userId: string): Promise<unknown[]> {
    await this.ensureFamilyMembership(familyId, userId);
    return prisma.relationship.findMany({ where: { familyId }, orderBy: { createdAt: 'asc' } });
  }

  public async addPerson(familyId: string, actorId: string, payload: AddPersonPayload): Promise<unknown> {
    return prisma.$transaction(async (tx) => {
      const family = await tx.family.findUnique({ where: { id: familyId } });
      if (!family) throw new NotFoundError('Family not found');
      this.governanceService.assertOwner(actorId, family.ownerId);
      if (!payload.email?.trim()) {
        throw new AppError('Email is required', 400);
      }
      const email = this.normalizeEmail(payload.email);
      const phone = this.normalizePhone(payload.phone);
      await this.assertUniquePersonIdentity(tx, familyId, email, phone);
      const resolvedProfilePicture = payload.profilePictureDataUrl ?? payload.profilePictureUrl ?? null;
      const identityResolution = await this.identityConsistency.resolveIdentity(tx, {
        mode: 'create',
        familyId,
        email: email ?? null,
        phone: phone ?? null,
        givenName: payload.givenName ?? null,
        familyName: payload.familyName ?? null,
        gender: payload.gender,
        dateOfBirth: payload.dateOfBirth ?? null,
        placeOfBirth: payload.placeOfBirth ?? null,
        occupation: payload.occupation ?? null,
        notes: payload.notes ?? null,
        profilePictureUrl: resolvedProfilePicture,
      });
      const identity = identityResolution.details;
      const identityId = await this.identityConsistency.syncIdentityEverywhere(
        tx,
        identity,
        identityResolution.linkedUserId,
        identityResolution.identityId,
      );
      const metadataSeed = JSON.stringify(this.buildPersonMetadata(payload));

      const person = await tx.person.create({
        data: {
          familyId,
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
      await this.linkFamilyMembershipByPersonIdentity(tx, familyId, identity.email ?? undefined, identity.phone ?? undefined);

      await this.createVersion(tx, familyId, actorId, VersionSourceType.MANUAL_EDIT, person.id, `Owner added person ${person.name}`);
      return person;
    });
  }

  public async addRelationship(
    familyId: string,
    actorId: string,
    payload: AddRelationshipPayload,
  ): Promise<unknown> {
    return prisma.$transaction(async (tx) => {
      const family = await tx.family.findUnique({ where: { id: familyId } });
      if (!family) throw new NotFoundError('Family not found');
      this.governanceService.assertOwner(actorId, family.ownerId);

      const [fromPerson, toPerson, persons, relationships] = await Promise.all([
        tx.person.findUnique({ where: { id: payload.fromPersonId } }),
        tx.person.findUnique({ where: { id: payload.toPersonId } }),
        tx.person.findMany({ where: { familyId }, orderBy: { id: 'asc' } }),
        tx.relationship.findMany({ where: { familyId }, orderBy: { id: 'asc' } }),
      ]);
      if (!fromPerson || !toPerson || fromPerson.familyId !== familyId || toPerson.familyId !== familyId) {
        throw new NotFoundError('Relationship persons not found in family');
      }
      this.relationshipIntegrity.validateOrThrow(persons, relationships, {
        id: '__candidate__',
        familyId,
        fromPersonId: payload.fromPersonId,
        toPersonId: payload.toPersonId,
        type: payload.type as RelationshipType,
      });

      const relationship = await tx.relationship.create({
        data: {
          familyId,
          fromPersonId: payload.fromPersonId,
          toPersonId: payload.toPersonId,
          type: payload.type as RelationshipType,
          metadataJson: JSON.stringify(payload.metadata ?? {}),
        },
      });

      await this.createVersion(
        tx,
        familyId,
        actorId,
        VersionSourceType.MANUAL_EDIT,
        relationship.id,
        `Owner added relationship ${payload.type}`,
      );

      return relationship;
    });
  }

  public async updatePerson(
    familyId: string,
    personId: string,
    actorId: string,
    payload: AddPersonPayload,
  ): Promise<unknown> {
    return prisma.$transaction(async (tx) => {
      const family = await tx.family.findUnique({ where: { id: familyId } });
      if (!family) throw new NotFoundError('Family not found');
      this.governanceService.assertOwner(actorId, family.ownerId);

      const person = await tx.person.findUnique({ where: { id: personId } });
      if (!person || person.familyId !== familyId) {
        throw new NotFoundError('Person not found in family');
      }
      if (!payload.email?.trim()) {
        throw new AppError('Email is required', 400);
      }

      const email = this.normalizeEmail(payload.email);
      const phone = this.normalizePhone(payload.phone);
      await this.assertUniquePersonIdentity(tx, familyId, email, phone, personId);
      const resolvedProfilePicture = payload.profilePictureDataUrl ?? payload.profilePictureUrl ?? null;
      const identityResolution = await this.identityConsistency.resolveIdentity(tx, {
        mode: 'update',
        familyId,
        email: email ?? null,
        phone: phone ?? null,
        givenName: payload.givenName ?? null,
        familyName: payload.familyName ?? null,
        gender: payload.gender,
        dateOfBirth: payload.dateOfBirth ?? null,
        placeOfBirth: payload.placeOfBirth ?? null,
        occupation: payload.occupation ?? null,
        notes: payload.notes ?? null,
        profilePictureUrl: resolvedProfilePicture,
      });
      const identity = identityResolution.details;
      const identityId = await this.identityConsistency.syncIdentityEverywhere(
        tx,
        identity,
        identityResolution.linkedUserId,
        identityResolution.identityId,
      );
      const metadataSeed = JSON.stringify(this.buildPersonMetadata(payload));

      const updated = await tx.person.update({
        where: { id: personId },
        data: {
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
      await this.linkFamilyMembershipByPersonIdentity(tx, familyId, identity.email ?? undefined, identity.phone ?? undefined);

      await this.createVersion(
        tx,
        familyId,
        actorId,
        VersionSourceType.MANUAL_EDIT,
        updated.id,
        `Owner updated person ${updated.name}`,
      );

      return updated;
    });
  }

  public async deletePerson(familyId: string, personId: string, actorId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const family = await tx.family.findUnique({ where: { id: familyId } });
      if (!family) throw new NotFoundError('Family not found');
      this.governanceService.assertOwner(actorId, family.ownerId);

      const person = await tx.person.findUnique({ where: { id: personId } });
      if (!person || person.familyId !== familyId) {
        throw new NotFoundError('Person not found in family');
      }

      await tx.relationship.deleteMany({
        where: {
          familyId,
          OR: [{ fromPersonId: personId }, { toPersonId: personId }],
        },
      });
      await tx.person.delete({ where: { id: personId } });

      await this.createVersion(
        tx,
        familyId,
        actorId,
        VersionSourceType.MANUAL_EDIT,
        personId,
        `Owner deleted person ${person.name}`,
      );
    });
  }

  public async updateRelationship(
    familyId: string,
    relationshipId: string,
    actorId: string,
    payload: AddRelationshipPayload,
  ): Promise<unknown> {
    return prisma.$transaction(async (tx) => {
      const family = await tx.family.findUnique({ where: { id: familyId } });
      if (!family) throw new NotFoundError('Family not found');
      this.governanceService.assertOwner(actorId, family.ownerId);

      const relationship = await tx.relationship.findUnique({ where: { id: relationshipId } });
      if (!relationship || relationship.familyId !== familyId) {
        throw new NotFoundError('Relationship not found in family');
      }

      const [fromPerson, toPerson, persons, relationships] = await Promise.all([
        tx.person.findUnique({ where: { id: payload.fromPersonId } }),
        tx.person.findUnique({ where: { id: payload.toPersonId } }),
        tx.person.findMany({ where: { familyId }, orderBy: { id: 'asc' } }),
        tx.relationship.findMany({ where: { familyId }, orderBy: { id: 'asc' } }),
      ]);
      if (!fromPerson || !toPerson || fromPerson.familyId !== familyId || toPerson.familyId !== familyId) {
        throw new NotFoundError('Relationship persons not found in family');
      }
      this.relationshipIntegrity.validateOrThrow(
        persons,
        relationships,
        {
          id: relationshipId,
          familyId,
          fromPersonId: payload.fromPersonId,
          toPersonId: payload.toPersonId,
          type: payload.type as RelationshipType,
        },
        relationshipId,
      );

      const updated = await tx.relationship.update({
        where: { id: relationshipId },
        data: {
          fromPersonId: payload.fromPersonId,
          toPersonId: payload.toPersonId,
          type: payload.type as RelationshipType,
          metadataJson: JSON.stringify(payload.metadata ?? {}),
        },
      });

      await this.createVersion(
        tx,
        familyId,
        actorId,
        VersionSourceType.MANUAL_EDIT,
        updated.id,
        `Owner updated relationship ${updated.type}`,
      );

      return updated;
    });
  }

  public async deleteRelationship(familyId: string, relationshipId: string, actorId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const family = await tx.family.findUnique({ where: { id: familyId } });
      if (!family) throw new NotFoundError('Family not found');
      this.governanceService.assertOwner(actorId, family.ownerId);

      const relationship = await tx.relationship.findUnique({ where: { id: relationshipId } });
      if (!relationship || relationship.familyId !== familyId) {
        throw new NotFoundError('Relationship not found in family');
      }

      await tx.relationship.delete({ where: { id: relationshipId } });

      await this.createVersion(
        tx,
        familyId,
        actorId,
        VersionSourceType.MANUAL_EDIT,
        relationshipId,
        `Owner deleted relationship ${relationship.type}`,
      );
    });
  }

  private async createVersion(
    tx: Prisma.TransactionClient,
    familyId: string,
    actorId: string,
    sourceType: VersionSourceType,
    sourceId: string,
    message: string,
  ): Promise<void> {
    const versions = await tx.familyVersion.findMany({ where: { familyId }, select: { versionNumber: true } });
    const nextVersion = this.versioningService.nextVersionNumber(versions.map((v) => v.versionNumber));
    const snapshot = await this.snapshotService.getCurrentSnapshot(tx, familyId);

    await tx.familyVersion.create({
      data: {
        familyId,
        versionNumber: nextVersion,
        snapshotJson: this.versioningService.buildSnapshot(snapshot),
        createdById: actorId,
        sourceType,
        sourceId,
        message,
      },
    });

    await tx.auditLog.create({
      data: {
        familyId,
        actorId,
        action: 'VERSION_CREATED',
        metadataJson: JSON.stringify({ nextVersion, sourceType, sourceId, message }),
      },
    });
  }

  public async ensureFamilyMembership(familyId: string, userId: string): Promise<{ ownerId: string; role: UserRole }> {
    const family = await prisma.family.findUnique({ where: { id: familyId } });
    if (!family) throw new NotFoundError('Family not found');

    const membership = await prisma.familyMember.findUnique({
      where: {
        familyId_userId: { familyId, userId },
      },
    });

    if (!membership) {
      throw new NotFoundError('User is not a member of this family');
    }

    const role = family.ownerId === userId ? UserRole.OWNER : UserRole.MEMBER;
    return { ownerId: family.ownerId, role };
  }
}
