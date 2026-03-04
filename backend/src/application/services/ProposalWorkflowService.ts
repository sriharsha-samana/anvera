import {
  ProposalStatus,
  ProposalType,
  VersionSourceType,
  type Person,
  type Relationship,
  type RelationshipType,
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
import type { AddPersonPayload, AddRelationshipPayload, ImportFromFamilyPayload, PersonNode, RelationshipEdge } from '../../shared/types';
import { IdentityConsistencyService } from './IdentityConsistencyService';
import { SnapshotService } from './SnapshotService';

type ImportPersonPlan = {
  sourcePerson: Person;
  targetPersonId: string | null;
  matchReason: 'email' | 'phone' | 'email+phone' | null;
};

type ImportRelationshipPlan = {
  sourceRelationship: Relationship;
  fromTargetId: string;
  toTargetId: string;
  existsAlready: boolean;
};

type ImportPlan = {
  sourceFamilyId: string;
  sourceFamilyName: string;
  selectedSourcePersonIds: Set<string>;
  includeRelationships: boolean;
  personPlans: ImportPersonPlan[];
  relationshipPlans: ImportRelationshipPlan[];
  conflicts: string[];
  simulated: {
    persons: PersonNode[];
    relationships: RelationshipEdge[];
    proposedPersonIds: string[];
    proposedRelationshipKeys: string[];
  };
};

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

  private parseMetadata(raw: string | null | undefined): Record<string, unknown> {
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private relationshipKey(fromPersonId: string, toPersonId: string, type: RelationshipType): string {
    return `${fromPersonId}|${toPersonId}|${type}`;
  }

  private uniquePersonSelection(
    sourcePersons: Person[],
    selectedPersonIds?: string[],
  ): Set<string> {
    if (!selectedPersonIds || selectedPersonIds.length === 0) {
      return new Set(sourcePersons.map((person) => person.id));
    }
    const existingIds = new Set(sourcePersons.map((person) => person.id));
    const requested = new Set<string>();
    for (const id of selectedPersonIds) {
      if (!existingIds.has(id)) {
        throw new AppError('Selected members contain unknown source member ids', 400);
      }
      requested.add(id);
    }
    if (requested.size === 0) {
      throw new AppError('Select at least one member to import', 400);
    }
    return requested;
  }

  private toPersonNode(person: Person): PersonNode {
    return {
      id: person.id,
      familyId: person.familyId,
      identityId: person.identityId,
      name: person.name,
      givenName: person.givenName,
      familyName: person.familyName,
      gender: person.gender,
      dateOfBirth: person.dateOfBirth ?? null,
      email: person.email ?? null,
      phone: person.phone ?? null,
      profilePictureUrl: person.profilePictureUrl ?? null,
      metadataJson: person.metadataJson,
    };
  }

  private toRelationshipEdge(relationship: Relationship): RelationshipEdge {
    return {
      id: relationship.id,
      familyId: relationship.familyId,
      fromPersonId: relationship.fromPersonId,
      toPersonId: relationship.toPersonId,
      type: relationship.type,
      metadataJson: relationship.metadataJson,
    };
  }

  private async ensureSourceFamilyMembership(
    tx: Prisma.TransactionClient,
    sourceFamilyId: string,
    userId: string,
  ): Promise<{ id: string; name: string }> {
    const sourceFamily = await tx.family.findUnique({
      where: { id: sourceFamilyId },
      select: { id: true, name: true },
    });
    if (!sourceFamily) throw new NotFoundError('Source family not found');
    const sourceMembership = await tx.familyMember.findUnique({
      where: { familyId_userId: { familyId: sourceFamilyId, userId } },
      select: { id: true },
    });
    if (!sourceMembership) throw new NotFoundError('User is not a member of source family');
    return sourceFamily;
  }

  private async buildImportPlan(
    tx: Prisma.TransactionClient,
    targetFamilyId: string,
    requestorId: string,
    payload: ImportFromFamilyPayload,
  ): Promise<ImportPlan> {
    const sourceFamilyId = payload.sourceFamilyId;
    if (!sourceFamilyId.trim()) {
      throw new AppError('sourceFamilyId is required', 400);
    }
    if (sourceFamilyId === targetFamilyId) {
      throw new AppError('Source and target family must be different', 400);
    }
    const sourceFamily = await this.ensureSourceFamilyMembership(tx, sourceFamilyId, requestorId);
    const includeRelationships = payload.includeRelationships !== false;

    const [sourcePersons, sourceRelationships, targetPersons, targetRelationships] = await Promise.all([
      tx.person.findMany({ where: { familyId: sourceFamilyId }, orderBy: { id: 'asc' } }),
      tx.relationship.findMany({ where: { familyId: sourceFamilyId }, orderBy: { id: 'asc' } }),
      tx.person.findMany({ where: { familyId: targetFamilyId }, orderBy: { id: 'asc' } }),
      tx.relationship.findMany({ where: { familyId: targetFamilyId }, orderBy: { id: 'asc' } }),
    ]);

    const selectedSourcePersonIds = this.uniquePersonSelection(sourcePersons, payload.selectedPersonIds);
    const selectedSourcePersons = sourcePersons.filter((person) => selectedSourcePersonIds.has(person.id));

    const emailToTarget = new Map<string, Person>();
    const phoneToTarget = new Map<string, Person>();
    for (const targetPerson of targetPersons) {
      const email = this.normalizeEmail(targetPerson.email ?? undefined);
      if (email && !emailToTarget.has(email)) emailToTarget.set(email, targetPerson);
      const phone = this.normalizePhone(targetPerson.phone ?? undefined);
      if (phone && !phoneToTarget.has(phone)) phoneToTarget.set(phone, targetPerson);
    }

    const conflicts: string[] = [];
    const personPlans: ImportPersonPlan[] = [];
    const sourceToSimulatedTargetId = new Map<string, string>();

    for (const sourcePerson of selectedSourcePersons) {
      const email = this.normalizeEmail(sourcePerson.email ?? undefined);
      const phone = this.normalizePhone(sourcePerson.phone ?? undefined);
      const byEmail = email ? emailToTarget.get(email) ?? null : null;
      const byPhone = phone ? phoneToTarget.get(phone) ?? null : null;

      if (byEmail && byPhone && byEmail.id !== byPhone.id) {
        conflicts.push(
          `Person ${sourcePerson.name} has email and phone matching different target members`,
        );
      }

      const match = byEmail ?? byPhone ?? null;
      let matchReason: ImportPersonPlan['matchReason'] = null;
      if (byEmail && byPhone && byEmail.id === byPhone.id) matchReason = 'email+phone';
      else if (byEmail) matchReason = 'email';
      else if (byPhone) matchReason = 'phone';

      personPlans.push({
        sourcePerson,
        targetPersonId: match?.id ?? null,
        matchReason,
      });

      if (match) {
        sourceToSimulatedTargetId.set(sourcePerson.id, match.id);
      } else {
        sourceToSimulatedTargetId.set(sourcePerson.id, `sim-import-${sourcePerson.id}`);
      }
    }

    const targetRelationshipKeys = new Set(
      targetRelationships.map((relationship) =>
        this.relationshipKey(relationship.fromPersonId, relationship.toPersonId, relationship.type),
      ),
    );

    const sourceRelationshipCandidates = includeRelationships
      ? sourceRelationships.filter(
          (relationship) =>
            selectedSourcePersonIds.has(relationship.fromPersonId) &&
            selectedSourcePersonIds.has(relationship.toPersonId),
        )
      : [];

    const relationshipPlans: ImportRelationshipPlan[] = [];
    const proposedRelationshipKeys = new Set<string>();
    const simulatedRelationships = targetRelationships.map((relationship) => this.toRelationshipEdge(relationship));

    for (const relationship of sourceRelationshipCandidates) {
      const fromTargetId = sourceToSimulatedTargetId.get(relationship.fromPersonId);
      const toTargetId = sourceToSimulatedTargetId.get(relationship.toPersonId);
      if (!fromTargetId || !toTargetId) continue;

      const key = this.relationshipKey(fromTargetId, toTargetId, relationship.type);
      const existsAlready = targetRelationshipKeys.has(key) || proposedRelationshipKeys.has(key);
      relationshipPlans.push({
        sourceRelationship: relationship,
        fromTargetId,
        toTargetId,
        existsAlready,
      });
      if (!existsAlready) {
        proposedRelationshipKeys.add(key);
        simulatedRelationships.push({
          id: `sim-import-${relationship.id}`,
          familyId: targetFamilyId,
          fromPersonId: fromTargetId,
          toPersonId: toTargetId,
          type: relationship.type,
          metadataJson: relationship.metadataJson,
        });
      }
    }

    const simulatedPersons = [
      ...targetPersons.map((person) => this.toPersonNode(person)),
      ...personPlans
        .filter((plan) => !plan.targetPersonId)
        .map((plan) => {
          const simulatedId = sourceToSimulatedTargetId.get(plan.sourcePerson.id)!;
          const source = plan.sourcePerson;
          return {
            id: simulatedId,
            familyId: targetFamilyId,
            identityId: source.identityId,
            name: source.name,
            givenName: source.givenName,
            familyName: source.familyName,
            gender: source.gender,
            dateOfBirth: source.dateOfBirth ?? null,
            email: source.email ?? null,
            phone: source.phone ?? null,
            profilePictureUrl: source.profilePictureUrl ?? null,
            metadataJson: source.metadataJson,
          } satisfies PersonNode;
        }),
    ];

    return {
      sourceFamilyId,
      sourceFamilyName: sourceFamily.name,
      selectedSourcePersonIds,
      includeRelationships,
      personPlans,
      relationshipPlans,
      conflicts,
      simulated: {
        persons: simulatedPersons,
        relationships: simulatedRelationships,
        proposedPersonIds: personPlans
          .filter((plan) => !plan.targetPersonId)
          .map((plan) => sourceToSimulatedTargetId.get(plan.sourcePerson.id)!)
          .filter(Boolean),
        proposedRelationshipKeys: [...proposedRelationshipKeys],
      },
    };
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
    data: AddPersonPayload | AddRelationshipPayload | ImportFromFamilyPayload,
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
      if (type === ProposalType.IMPORT_FROM_FAMILY) {
        const importPayload = data as ImportFromFamilyPayload;
        const normalizedPayload: ImportFromFamilyPayload = {
          sourceFamilyId: importPayload.sourceFamilyId,
          includeRelationships: importPayload.includeRelationships !== false,
          selectedPersonIds: importPayload.selectedPersonIds?.filter((value) => value.trim().length > 0),
        };
        const plan = await this.buildImportPlan(tx, familyId, createdById, normalizedPayload);
        if (plan.conflicts.length > 0) {
          throw new ConflictError(plan.conflicts.join('; '));
        }
        const addedPersons = plan.personPlans.filter((entry) => !entry.targetPersonId).length;
        const addedRelationships = plan.relationshipPlans.filter((entry) => !entry.existsAlready).length;
        const impacts = [
          `Import source family: ${plan.sourceFamilyName}`,
          `Selected members: ${plan.selectedSourcePersonIds.size}`,
          `Will add members: ${addedPersons}`,
          `Will add relationships: ${addedRelationships}`,
          `Will match existing members: ${plan.personPlans.filter((entry) => entry.targetPersonId).length}`,
        ];
        return tx.proposal.create({
          data: {
            familyId,
            type,
            payloadJson: JSON.stringify(normalizedPayload),
            previewJson: JSON.stringify({
              diff: { addedPersons, addedRelationships, impacts },
              impact: null,
              importPreview: {
                sourceFamilyId: plan.sourceFamilyId,
                sourceFamilyName: plan.sourceFamilyName,
                selectedPersonCount: plan.selectedSourcePersonIds.size,
                includeRelationships: plan.includeRelationships,
                conflicts: plan.conflicts,
                matchedMembers: plan.personPlans
                  .filter((entry) => entry.targetPersonId)
                  .map((entry) => ({
                    sourcePersonId: entry.sourcePerson.id,
                    sourceName: entry.sourcePerson.name,
                    targetPersonId: entry.targetPersonId!,
                    targetName: current.persons.find((person) => person.id === entry.targetPersonId)?.name ?? entry.targetPersonId,
                    reason: entry.matchReason,
                  })),
                newMembers: plan.personPlans
                  .filter((entry) => !entry.targetPersonId)
                  .map((entry) => ({
                    sourcePersonId: entry.sourcePerson.id,
                    name: entry.sourcePerson.name,
                    email: entry.sourcePerson.email,
                    phone: entry.sourcePerson.phone,
                  })),
                relationshipAdds: plan.relationshipPlans
                  .filter((entry) => !entry.existsAlready)
                  .map((entry) => ({
                    fromPersonId: entry.fromTargetId,
                    toPersonId: entry.toTargetId,
                    type: entry.sourceRelationship.type,
                  })),
                relationshipSkips: plan.relationshipPlans
                  .filter((entry) => entry.existsAlready)
                  .map((entry) => ({
                    fromPersonId: entry.fromTargetId,
                    toPersonId: entry.toTargetId,
                    type: entry.sourceRelationship.type,
                    reason: 'Already exists',
                  })),
                simulated: {
                  persons: plan.simulated.persons,
                  relationships: plan.simulated.relationships,
                  proposedPersonIds: plan.simulated.proposedPersonIds,
                  proposedRelationshipKeys: plan.simulated.proposedRelationshipKeys,
                },
              },
            }),
            createdById,
          },
        });
      }
      const simulation = this.proposalDomain.simulateProposal(
        current,
        type,
        data as AddPersonPayload | AddRelationshipPayload,
      );

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

      const payload = JSON.parse(proposal.payloadJson) as AddPersonPayload | AddRelationshipPayload | ImportFromFamilyPayload;
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

      if (proposal.type === ProposalType.IMPORT_FROM_FAMILY) {
        const importPayload = payload as ImportFromFamilyPayload;
        const plan = await this.buildImportPlan(tx, proposal.familyId, reviewerId, importPayload);
        if (plan.conflicts.length > 0) {
          throw new ConflictError(plan.conflicts.join('; '));
        }

        const sourceToTarget = new Map<string, string>();
        for (const personPlan of plan.personPlans) {
          if (personPlan.targetPersonId) {
            sourceToTarget.set(personPlan.sourcePerson.id, personPlan.targetPersonId);
          }
        }

        for (const personPlan of plan.personPlans.filter((entry) => !entry.targetPersonId)) {
          const source = personPlan.sourcePerson;
          const email = this.normalizeEmail(source.email ?? undefined);
          const phone = this.normalizePhone(source.phone ?? undefined);
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
            if (email && phone) {
              const emailMatches = duplicate.email === email;
              const phoneMatches = duplicate.phone === phone;
              if (!emailMatches && !phoneMatches) {
                throw new ConflictError(`Identity conflict while importing ${source.name}`);
              }
            }
            sourceToTarget.set(source.id, duplicate.id);
            continue;
          }

          const identityResolution = await this.identityConsistency.resolveIdentity(tx, {
            mode: 'create',
            familyId: proposal.familyId,
            email: email ?? null,
            phone: phone ?? null,
            givenName: source.givenName ?? source.name,
            familyName: source.familyName ?? null,
            gender: source.gender || 'unknown',
            dateOfBirth: source.dateOfBirth ?? null,
            placeOfBirth: null,
            occupation: null,
            notes: null,
            profilePictureUrl: source.profilePictureUrl ?? null,
          });
          const identity = identityResolution.details;
          const identityId = await this.identityConsistency.syncIdentityEverywhere(
            tx,
            identity,
            identityResolution.linkedUserId,
            identityResolution.identityId,
          );
          const sourceMetadata = this.parseMetadata(source.metadataJson);
          const metadataSeed = JSON.stringify({
            ...sourceMetadata,
            importedFromFamilyId: plan.sourceFamilyId,
            importedFromPersonId: source.id,
          });
          const createdPerson = await tx.person.create({
            data: {
              familyId: proposal.familyId,
              identityId,
              name: this.identityConsistency.buildName(identity) || source.name,
              givenName: identity.givenName ?? source.givenName,
              familyName: identity.familyName ?? source.familyName,
              gender: identity.gender || source.gender || 'unknown',
              dateOfBirth: identity.dateOfBirth ?? source.dateOfBirth,
              email: identity.email ?? email ?? null,
              phone: identity.phone ?? phone ?? null,
              profilePictureUrl: identity.profilePictureUrl ?? source.profilePictureUrl,
              metadataJson: this.identityConsistency.buildMetadata(metadataSeed, identity),
            },
          });
          sourceToTarget.set(source.id, createdPerson.id);
          await this.linkFamilyMembershipByPersonIdentity(
            tx,
            proposal.familyId,
            createdPerson.email ?? undefined,
            createdPerson.phone ?? undefined,
          );
        }

        const [persons, relationships] = await Promise.all([
          tx.person.findMany({ where: { familyId: proposal.familyId }, orderBy: { id: 'asc' } }),
          tx.relationship.findMany({ where: { familyId: proposal.familyId }, orderBy: { id: 'asc' } }),
        ]);
        const relSet = new Set(
          relationships.map((relationship) =>
            this.relationshipKey(relationship.fromPersonId, relationship.toPersonId, relationship.type),
          ),
        );

        for (const relationshipPlan of plan.relationshipPlans) {
          if (relationshipPlan.existsAlready) continue;
          const fromTargetId = sourceToTarget.get(relationshipPlan.sourceRelationship.fromPersonId);
          const toTargetId = sourceToTarget.get(relationshipPlan.sourceRelationship.toPersonId);
          if (!fromTargetId || !toTargetId) continue;

          const key = this.relationshipKey(fromTargetId, toTargetId, relationshipPlan.sourceRelationship.type);
          if (relSet.has(key)) continue;

          this.relationshipIntegrity.validateOrThrow(persons, relationships, {
            id: '__approved_import__',
            familyId: proposal.familyId,
            fromPersonId: fromTargetId,
            toPersonId: toTargetId,
            type: relationshipPlan.sourceRelationship.type,
          });

          const createdRelationship = await tx.relationship.create({
            data: {
              familyId: proposal.familyId,
              fromPersonId: fromTargetId,
              toPersonId: toTargetId,
              type: relationshipPlan.sourceRelationship.type,
              metadataJson: JSON.stringify({
                importedFromFamilyId: plan.sourceFamilyId,
                importedFromRelationshipId: relationshipPlan.sourceRelationship.id,
              }),
            },
          });
          relationships.push(createdRelationship);
          relSet.add(key);
        }
      }

      const versionNumber = await this.createVersion(
        tx,
        proposal.familyId,
        reviewerId,
        VersionSourceType.PROPOSAL,
        proposal.id,
        proposal.type === ProposalType.IMPORT_FROM_FAMILY
          ? `Approved import proposal ${proposal.id}`
          : `Approved proposal ${proposal.id}`,
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
