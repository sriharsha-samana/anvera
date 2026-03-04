export type UserRole = 'OWNER' | 'MEMBER';

export type Family = {
  id: string;
  name: string;
  ownerId: string;
  ownerName?: string;
  totalMembers?: number;
  createdAt?: string;
  owner?: {
    id: string;
    username: string;
    givenName?: string | null;
    familyName?: string | null;
    email?: string | null;
    phone?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
  };
  myRole?: UserRole;
};

export type Person = {
  id: string;
  familyId: string;
  name: string;
  givenName?: string | null;
  familyName?: string | null;
  gender: 'male' | 'female' | 'other' | 'unknown' | string;
  dateOfBirth?: string | null;
  email?: string | null;
  phone?: string | null;
  profilePictureUrl?: string | null;
  metadataJson: string;
};

export type Proposal = {
  id: string;
  familyId: string;
  type:
    | 'ADD_PERSON'
    | 'ADD_RELATIONSHIP'
    | 'IMPORT_FROM_FAMILY'
    | 'EDIT_PERSON'
    | 'DELETE_PERSON'
    | 'EDIT_RELATIONSHIP'
    | 'DELETE_RELATIONSHIP';
  payloadJson: string;
  previewJson: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  appliedVersionNumber?: number | null;
  overriddenByVersionNumber?: number | null;
  reviewReason?: string | null;
  createdAt: string;
};

export type FamilyVersion = {
  id: string;
  familyId: string;
  versionNumber: number;
  message: string;
  sourceType: 'MANUAL_EDIT' | 'PROPOSAL' | 'ROLLBACK';
  rollbackFromVersion?: number | null;
  createdAt: string;
};

export type RelationshipResult = {
  label: string;
  degree?: number;
  removal?: number;
  commonAncestorId?: string;
  paths: string[][];
  multiplePaths: boolean;
  cycleDetected: boolean;
};

export type AiRelationshipAskResponse = {
  family: {
    id: string;
    name: string;
  };
  answer: string;
  aiAvailable: boolean;
  resolved: {
    subject: {
      id: string;
      name: string;
    };
    object: {
      id: string;
      name: string;
      isMe: boolean;
    };
  };
  relationship: RelationshipResult & {
    pathsByName: string[][];
  };
  relatedPeople?: Array<{
    id: string;
    name: string;
    relationLabel: string;
  }>;
};
