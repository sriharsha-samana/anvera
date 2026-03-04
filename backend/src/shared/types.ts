import type { ProposalType, RelationshipType } from '@prisma/client';

export type PersonNode = {
  id: string;
  familyId: string;
  identityId?: string;
  name: string;
  givenName?: string | null;
  familyName?: string | null;
  gender: string;
  dateOfBirth: string | null;
  email?: string | null;
  phone?: string | null;
  profilePictureUrl?: string | null;
  metadataJson: string;
};

export type RelationshipEdge = {
  id: string;
  familyId: string;
  fromPersonId: string;
  toPersonId: string;
  type: RelationshipType;
  metadataJson: string;
};

export type Snapshot = {
  persons: PersonNode[];
  relationships: RelationshipEdge[];
};

export type AddPersonPayload = {
  name?: string;
  givenName?: string;
  familyName?: string;
  gender: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  placeOfBirth?: string;
  occupation?: string;
  notes?: string;
  profilePictureUrl?: string;
  profilePictureDataUrl?: string;
  metadata?: Record<string, unknown>;
};

export type AddRelationshipPayload = {
  fromPersonId: string;
  toPersonId: string;
  type: RelationshipType;
  metadata?: Record<string, unknown>;
};

export type ImportFromFamilyPayload = {
  sourceFamilyId: string;
  selectedPersonIds?: string[];
  includeRelationships?: boolean;
};

export type EditPersonPayload = {
  personId: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  gender?: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  placeOfBirth?: string;
  occupation?: string;
  notes?: string;
  profilePictureUrl?: string;
  profilePictureDataUrl?: string;
  metadata?: Record<string, unknown>;
};

export type DeletePersonPayload = {
  personId: string;
};

export type EditRelationshipPayload = {
  relationshipId: string;
  type: RelationshipType;
  metadata?: Record<string, unknown>;
};

export type DeleteRelationshipPayload = {
  relationshipId: string;
};

export type ProposalPayload = {
  type: ProposalType;
  data:
    | AddPersonPayload
    | AddRelationshipPayload
    | ImportFromFamilyPayload
    | EditPersonPayload
    | DeletePersonPayload
    | EditRelationshipPayload
    | DeleteRelationshipPayload;
};

export type RelationshipClassification = {
  label: string;
  degree?: number;
  removal?: number;
  commonAncestorId?: string;
  paths: string[][];
  multiplePaths: boolean;
  cycleDetected: boolean;
};
