import { ProposalType, RelationshipType } from '@prisma/client';
import { z } from 'zod';

const normalizeOptionalString = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const optionalTrimmedString = (max: number) =>
  z.preprocess((value) => normalizeOptionalString(value), z.string().max(max).optional());

const optionalPhoneE164 = z.preprocess((value) => normalizeOptionalString(value), z.string().optional()).transform((value) => {
  if (!value) return undefined;
  const normalized = value.replace(/[\s\-()]/g, '');
  return normalized;
}).refine((value) => {
  if (!value) return true;
  return /^\+[1-9]\d{7,14}$/.test(value);
}, 'phone must be in international format, e.g. +919876543210');

const optionalProfilePicture = z.preprocess((value) => normalizeOptionalString(value), z.string().optional()).refine((value) => {
  if (!value) return true;
  if (value.startsWith('data:image/')) {
    return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= 2_000_000;
  }
  return /^https?:\/\/[^\s]+$/i.test(value);
}, 'profile picture must be an image URL or image data URL');

const optionalDateYmd = z
  .preprocess((value) => normalizeOptionalString(value), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional())
  .refine((value) => {
    if (!value) return true;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return date.getTime() <= todayUtc.getTime();
  }, 'dateOfBirth cannot be in the future');

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  password: z.string().min(6).max(120),
  givenName: z.string().min(2).max(60),
  familyName: z.string().min(2).max(60),
  gender: z.enum(['male', 'female', 'other', 'unknown']),
  dateOfBirth: optionalDateYmd,
  email: z.string().email().max(160),
  phone: optionalPhoneE164,
  placeOfBirth: optionalTrimmedString(120),
  occupation: optionalTrimmedString(120),
  notes: optionalTrimmedString(500),
  profilePictureUrl: optionalProfilePicture,
  profilePictureDataUrl: optionalProfilePicture,
});

export const createFamilySchema = z.object({
  name: z.string().min(1).max(120),
});

export const cloneFamilySchema = z.object({
  name: z.preprocess((value) => normalizeOptionalString(value), z.string().min(1).max(120).optional()),
});

export const updateFamilySchema = z.object({
  name: z.string().min(1).max(120),
});

const personPayloadSchema = z
  .object({
    name: z.preprocess((v) => normalizeOptionalString(v), z.string().min(2).max(120).optional()),
    givenName: optionalTrimmedString(60),
    familyName: optionalTrimmedString(60),
    gender: z.enum(['male', 'female', 'other', 'unknown']),
    dateOfBirth: optionalDateYmd,
    email: z.preprocess((v) => normalizeOptionalString(v), z.string().email().max(160)),
    phone: optionalPhoneE164,
    placeOfBirth: optionalTrimmedString(120),
    occupation: optionalTrimmedString(120),
    notes: optionalTrimmedString(500),
    profilePictureUrl: optionalProfilePicture,
    profilePictureDataUrl: optionalProfilePicture,
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    const hasSplitName = Boolean(value.givenName && value.familyName);
    const hasLegacyName = Boolean(value.name);
    if (!hasSplitName && !hasLegacyName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either name or both givenName and familyName',
        path: ['name'],
      });
    }
    if (!value.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Email is required',
        path: ['email'],
      });
    }
  });

export const addPersonSchema = personPayloadSchema;
export const updatePersonSchema = personPayloadSchema;

export const addRelationshipSchema = z.object({
  fromPersonId: z.string().min(1),
  toPersonId: z.string().min(1),
  type: z.nativeEnum(RelationshipType),
  metadata: z.record(z.unknown()).optional(),
});

export const importFromFamilySchema = z.object({
  sourceFamilyId: z.string().min(1),
  selectedPersonIds: z.array(z.string().min(1)).optional(),
  includeRelationships: z.boolean().optional(),
});

export const updateRelationshipSchema = z.object({
  fromPersonId: z.string().min(1),
  toPersonId: z.string().min(1),
  type: z.nativeEnum(RelationshipType),
  metadata: z.record(z.unknown()).optional(),
});

export const editPersonProposalSchema = z.object({
  personId: z.string().min(1),
  name: z.preprocess((v) => normalizeOptionalString(v), z.string().min(2).max(120).optional()),
  givenName: optionalTrimmedString(60),
  familyName: optionalTrimmedString(60),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  dateOfBirth: optionalDateYmd,
  email: z.preprocess((v) => normalizeOptionalString(v), z.string().email().max(160).optional()),
  phone: optionalPhoneE164,
  placeOfBirth: optionalTrimmedString(120),
  occupation: optionalTrimmedString(120),
  notes: optionalTrimmedString(500),
  profilePictureUrl: optionalProfilePicture,
  profilePictureDataUrl: optionalProfilePicture,
  metadata: z.record(z.unknown()).optional(),
});

export const deletePersonProposalSchema = z.object({
  personId: z.string().min(1),
});

export const deleteRelationshipProposalSchema = z.object({
  relationshipId: z.string().min(1),
});

export const proposalSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(ProposalType.ADD_PERSON),
    data: addPersonSchema,
  }),
  z.object({
    type: z.literal(ProposalType.ADD_RELATIONSHIP),
    data: addRelationshipSchema,
  }),
  z.object({
    type: z.literal(ProposalType.IMPORT_FROM_FAMILY),
    data: importFromFamilySchema,
  }),
  z.object({
    type: z.literal(ProposalType.EDIT_PERSON),
    data: editPersonProposalSchema,
  }),
  z.object({
    type: z.literal(ProposalType.DELETE_PERSON),
    data: deletePersonProposalSchema,
  }),
  z.object({
    type: z.literal(ProposalType.DELETE_RELATIONSHIP),
    data: deleteRelationshipProposalSchema,
  }),
]);

export const rejectProposalSchema = z.object({
  reason: z.string().min(3),
});

export const aiExplainSchema = z.object({
  classification: z.string().min(1),
  paths: z.array(z.array(z.string())),
  commonAncestorId: z.string().optional(),
});

export const aiAskSchema = z.object({
  familyId: z.string().min(1).optional(),
  question: z.string().min(3).max(240),
  mePersonId: z.string().min(1).optional(),
});
