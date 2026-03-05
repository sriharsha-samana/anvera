import { ProposalType } from '@prisma/client';
import type { AddPersonPayload, AddRelationshipPayload, Snapshot } from '../../shared/types';
import { AppError } from '../../shared/errors';

export type ProposalDiffSummary = {
  addedPersons: number;
  addedRelationships: number;
  impacts: string[];
};

export class ProposalService {
  private resolvePersonName(payload: AddPersonPayload): string {
    if (payload.name?.trim()) {
      return payload.name.trim();
    }
    const given = payload.givenName?.trim() ?? '';
    const family = payload.familyName?.trim() ?? '';
    return `${given} ${family}`.trim();
  }

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
      ...(payload.profilePictureDataUrl
        ? { profilePictureDataUrl: payload.profilePictureDataUrl }
        : {}),
    };
  }

  public simulateProposal(
    currentSnapshot: Snapshot,
    type: ProposalType,
    payload: AddPersonPayload | AddRelationshipPayload,
  ): { simulated: Snapshot; diff: ProposalDiffSummary } {
    const persons = [...currentSnapshot.persons];
    const relationships = [...currentSnapshot.relationships];
    const impacts: string[] = [];

    if (type === ProposalType.ADD_PERSON) {
      const personPayload = payload as AddPersonPayload;
      const resolvedName = this.resolvePersonName(personPayload);
      persons.push({
        id: `sim-${resolvedName.toLowerCase().replace(/\s+/g, '-')}`,
        familyId: currentSnapshot.persons[0]?.familyId ?? '',
        name: resolvedName,
        givenName: personPayload.givenName?.trim() ?? null,
        familyName: personPayload.familyName?.trim() ?? null,
        gender: personPayload.gender,
        dateOfBirth: personPayload.dateOfBirth ?? null,
        email: personPayload.email?.trim().toLowerCase() ?? null,
        phone: personPayload.phone?.replace(/[\s\-()]/g, '') ?? null,
        profilePictureUrl:
          personPayload.profilePictureDataUrl ?? personPayload.profilePictureUrl ?? null,
        metadataJson: JSON.stringify(this.buildPersonMetadata(personPayload)),
      });
      impacts.push(`Adds person ${resolvedName}`);
      return {
        simulated: { persons, relationships },
        diff: { addedPersons: 1, addedRelationships: 0, impacts },
      };
    }

    if (type === ProposalType.ADD_RELATIONSHIP) {
      const relPayload = payload as AddRelationshipPayload;
      const personIds = new Set(currentSnapshot.persons.map((p) => p.id));
      if (!personIds.has(relPayload.fromPersonId) || !personIds.has(relPayload.toPersonId)) {
        throw new AppError('Relationship payload references unknown person', 400);
      }
      relationships.push({
        id: `sim-${relPayload.fromPersonId}-${relPayload.toPersonId}-${relPayload.type}`,
        familyId: currentSnapshot.persons[0]?.familyId ?? '',
        fromPersonId: relPayload.fromPersonId,
        toPersonId: relPayload.toPersonId,
        type: relPayload.type,
        metadataJson: JSON.stringify(relPayload.metadata ?? {}),
      });
      impacts.push(
        `Adds relationship ${relPayload.type} between ${relPayload.fromPersonId} and ${relPayload.toPersonId}`,
      );
      return {
        simulated: { persons, relationships },
        diff: { addedPersons: 0, addedRelationships: 1, impacts },
      };
    }

    throw new AppError('Unsupported proposal type', 400);
  }
}
