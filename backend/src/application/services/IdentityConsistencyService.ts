import type { PersonIdentity, Prisma, User } from '@prisma/client';
import { ConflictError } from '../../shared/errors';

type IdentityDetails = {
  givenName: string | null;
  familyName: string | null;
  gender: string;
  dateOfBirth: string | null;
  email: string | null;
  phone: string | null;
  placeOfBirth: string | null;
  occupation: string | null;
  notes: string | null;
  profilePictureUrl: string | null;
};

type ResolveMode = 'create' | 'update';

type ResolveInput = {
  mode: ResolveMode;
  familyId: string;
  email: string | null;
  phone: string | null;
  givenName: string | null;
  familyName: string | null;
  gender: string;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  occupation: string | null;
  notes: string | null;
  profilePictureUrl: string | null;
};

type ResolveResult = {
  details: IdentityDetails;
  linkedUserId: string | null;
  identityId: string | null;
};

export class IdentityConsistencyService {
  private normalizeString(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeLower(value: string | null | undefined): string | null {
    const normalized = this.normalizeString(value);
    return normalized ? normalized.toLowerCase() : null;
  }

  private canonicalName(details: IdentityDetails): string {
    const given = details.givenName ?? '';
    const family = details.familyName ?? '';
    return `${given} ${family}`.trim();
  }

  private parseMetadata(json: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private fromIdentity(
    identity: Pick<
      PersonIdentity,
      | 'givenName'
      | 'familyName'
      | 'gender'
      | 'dateOfBirth'
      | 'email'
      | 'phone'
      | 'placeOfBirth'
      | 'occupation'
      | 'notes'
      | 'profilePictureUrl'
    >,
  ): IdentityDetails {
    return {
      givenName: this.normalizeString(identity.givenName),
      familyName: this.normalizeString(identity.familyName),
      gender: this.normalizeString(identity.gender) ?? 'unknown',
      dateOfBirth: this.normalizeString(identity.dateOfBirth),
      email: this.normalizeLower(identity.email),
      phone: this.normalizeString(identity.phone),
      placeOfBirth: this.normalizeString(identity.placeOfBirth),
      occupation: this.normalizeString(identity.occupation),
      notes: this.normalizeString(identity.notes),
      profilePictureUrl: this.normalizeString(identity.profilePictureUrl),
    };
  }

  private fromUser(user: User): IdentityDetails {
    return {
      givenName: this.normalizeString(user.givenName),
      familyName: this.normalizeString(user.familyName),
      gender: this.normalizeString(user.gender) ?? 'unknown',
      dateOfBirth: this.normalizeString(user.dateOfBirth),
      email: this.normalizeLower(user.email),
      phone: this.normalizeString(user.phone),
      placeOfBirth: this.normalizeString(user.placeOfBirth),
      occupation: this.normalizeString(user.occupation),
      notes: this.normalizeString(user.notes),
      profilePictureUrl: this.normalizeString(user.profilePictureUrl),
    };
  }

  private fieldMismatch(
    field: keyof Pick<
      IdentityDetails,
      | 'givenName'
      | 'familyName'
      | 'gender'
      | 'dateOfBirth'
      | 'placeOfBirth'
      | 'occupation'
      | 'notes'
      | 'profilePictureUrl'
    >,
    input: IdentityDetails,
    canonical: IdentityDetails,
  ): boolean {
    const incoming = input[field];
    const existing = canonical[field];
    return incoming !== null && existing !== null && incoming !== existing;
  }

  private ensureNoCreateMismatch(input: IdentityDetails, canonical: IdentityDetails): void {
    const fields: Array<
      keyof Pick<
        IdentityDetails,
        | 'givenName'
        | 'familyName'
        | 'gender'
        | 'dateOfBirth'
        | 'placeOfBirth'
        | 'occupation'
        | 'notes'
        | 'profilePictureUrl'
      >
    > = [
      'givenName',
      'familyName',
      'gender',
      'dateOfBirth',
      'placeOfBirth',
      'occupation',
      'notes',
      'profilePictureUrl',
    ];

    for (const field of fields) {
      if (this.fieldMismatch(field, input, canonical)) {
        throw new ConflictError(
          `Identity mismatch for ${field}. This email/phone already maps to an existing person profile.`,
        );
      }
    }
  }

  private mergeWithCanonical(
    mode: ResolveMode,
    input: IdentityDetails,
    canonical: IdentityDetails,
  ): IdentityDetails {
    if (mode === 'create') {
      this.ensureNoCreateMismatch(input, canonical);
    }

    const preferInput = mode === 'update';
    return {
      givenName: preferInput
        ? (input.givenName ?? canonical.givenName)
        : (canonical.givenName ?? input.givenName),
      familyName: preferInput
        ? (input.familyName ?? canonical.familyName)
        : (canonical.familyName ?? input.familyName),
      gender: preferInput ? (input.gender ?? canonical.gender) : (canonical.gender ?? input.gender),
      dateOfBirth: preferInput
        ? (input.dateOfBirth ?? canonical.dateOfBirth)
        : (canonical.dateOfBirth ?? input.dateOfBirth),
      email: canonical.email ?? input.email,
      phone: canonical.phone ?? input.phone,
      placeOfBirth: preferInput
        ? (input.placeOfBirth ?? canonical.placeOfBirth)
        : (canonical.placeOfBirth ?? input.placeOfBirth),
      occupation: preferInput
        ? (input.occupation ?? canonical.occupation)
        : (canonical.occupation ?? input.occupation),
      notes: preferInput ? (input.notes ?? canonical.notes) : (canonical.notes ?? input.notes),
      profilePictureUrl: preferInput
        ? (input.profilePictureUrl ?? canonical.profilePictureUrl)
        : (canonical.profilePictureUrl ?? input.profilePictureUrl),
    };
  }

  private buildIdentityMetadata(existingMetadataJson: string, details: IdentityDetails): string {
    const metadata = this.parseMetadata(existingMetadataJson);
    const mutable = { ...metadata };
    const setOrDelete = (key: string, value: string | null): void => {
      if (value === null) {
        delete mutable[key];
        return;
      }
      mutable[key] = value;
    };

    setOrDelete('givenName', details.givenName);
    setOrDelete('familyName', details.familyName);
    setOrDelete('email', details.email);
    setOrDelete('phone', details.phone);
    setOrDelete('placeOfBirth', details.placeOfBirth);
    setOrDelete('occupation', details.occupation);
    setOrDelete('notes', details.notes);
    setOrDelete('profilePictureUrl', details.profilePictureUrl);
    return JSON.stringify(mutable);
  }

  private async findLinkedUser(
    tx: Prisma.TransactionClient,
    email: string | null,
    phone: string | null,
  ): Promise<User | null> {
    if (!email && !phone) return null;
    const [emailUser, phoneUser] = await Promise.all([
      email ? tx.user.findUnique({ where: { email } }) : Promise.resolve(null),
      phone ? tx.user.findUnique({ where: { phone } }) : Promise.resolve(null),
    ]);
    if (emailUser && phoneUser && emailUser.id !== phoneUser.id) {
      throw new ConflictError('Provided email and phone map to different users');
    }
    return emailUser ?? phoneUser;
  }

  private async findIdentity(
    tx: Prisma.TransactionClient,
    email: string | null,
    phone: string | null,
  ): Promise<PersonIdentity | null> {
    if (!email && !phone) return null;
    const [emailIdentity, phoneIdentity] = await Promise.all([
      email ? tx.personIdentity.findUnique({ where: { email } }) : Promise.resolve(null),
      phone ? tx.personIdentity.findUnique({ where: { phone } }) : Promise.resolve(null),
    ]);
    if (emailIdentity && phoneIdentity && emailIdentity.id !== phoneIdentity.id) {
      throw new ConflictError('Provided email and phone map to different identities');
    }
    return emailIdentity ?? phoneIdentity;
  }

  public async resolveIdentity(
    tx: Prisma.TransactionClient,
    input: ResolveInput,
  ): Promise<ResolveResult> {
    void input.familyId;
    const draft: IdentityDetails = {
      givenName: this.normalizeString(input.givenName),
      familyName: this.normalizeString(input.familyName),
      gender: this.normalizeString(input.gender) ?? 'unknown',
      dateOfBirth: this.normalizeString(input.dateOfBirth),
      email: this.normalizeLower(input.email),
      phone: this.normalizeString(input.phone),
      placeOfBirth: this.normalizeString(input.placeOfBirth),
      occupation: this.normalizeString(input.occupation),
      notes: this.normalizeString(input.notes),
      profilePictureUrl: this.normalizeString(input.profilePictureUrl),
    };

    const [linkedUser, existingIdentity] = await Promise.all([
      this.findLinkedUser(tx, draft.email, draft.phone),
      this.findIdentity(tx, draft.email, draft.phone),
    ]);

    if (
      linkedUser?.identityId &&
      existingIdentity &&
      linkedUser.identityId !== existingIdentity.id
    ) {
      throw new ConflictError('Provided email/phone map to conflicting identity records');
    }

    if (existingIdentity) {
      return {
        details: this.mergeWithCanonical(input.mode, draft, this.fromIdentity(existingIdentity)),
        linkedUserId: linkedUser?.id ?? null,
        identityId: existingIdentity.id,
      };
    }

    if (linkedUser) {
      return {
        details: this.mergeWithCanonical(input.mode, draft, this.fromUser(linkedUser)),
        linkedUserId: linkedUser.id,
        identityId: linkedUser.identityId ?? null,
      };
    }

    return { details: draft, linkedUserId: null, identityId: null };
  }

  public async syncIdentityEverywhere(
    tx: Prisma.TransactionClient,
    details: IdentityDetails,
    linkedUserId: string | null,
    existingIdentityId: string | null = null,
  ): Promise<string> {
    let identityId = existingIdentityId;

    if (!identityId) {
      const matched = await this.findIdentity(tx, details.email, details.phone);
      identityId = matched?.id ?? null;
    }

    if (identityId) {
      await tx.personIdentity.update({
        where: { id: identityId },
        data: {
          email: details.email,
          phone: details.phone,
          givenName: details.givenName,
          familyName: details.familyName,
          gender: details.gender,
          dateOfBirth: details.dateOfBirth,
          placeOfBirth: details.placeOfBirth,
          occupation: details.occupation,
          notes: details.notes,
          profilePictureUrl: details.profilePictureUrl,
        },
      });
    } else {
      const created = await tx.personIdentity.create({
        data: {
          email: details.email,
          phone: details.phone,
          givenName: details.givenName,
          familyName: details.familyName,
          gender: details.gender,
          dateOfBirth: details.dateOfBirth,
          placeOfBirth: details.placeOfBirth,
          occupation: details.occupation,
          notes: details.notes,
          profilePictureUrl: details.profilePictureUrl,
        },
      });
      identityId = created.id;
    }

    if (linkedUserId) {
      await tx.user.update({
        where: { id: linkedUserId },
        data: {
          identityId,
          email: details.email,
          phone: details.phone,
          username: details.email ?? undefined,
          givenName: details.givenName,
          familyName: details.familyName,
          gender: details.gender,
          dateOfBirth: details.dateOfBirth,
          placeOfBirth: details.placeOfBirth,
          occupation: details.occupation,
          notes: details.notes,
          profilePictureUrl: details.profilePictureUrl,
        },
      });
    }

    const persons = await tx.person.findMany({
      where: {
        OR: [
          ...(identityId ? [{ identityId }] : []),
          ...(details.email ? [{ email: details.email }] : []),
          ...(details.phone ? [{ phone: details.phone }] : []),
        ],
      },
      select: { id: true, metadataJson: true },
    });

    for (const person of persons) {
      await tx.person.update({
        where: { id: person.id },
        data: {
          identityId,
          name: this.canonicalName(details),
          givenName: details.givenName,
          familyName: details.familyName,
          gender: details.gender,
          dateOfBirth: details.dateOfBirth,
          email: details.email,
          phone: details.phone,
          profilePictureUrl: details.profilePictureUrl,
          metadataJson: this.buildIdentityMetadata(person.metadataJson, details),
        },
      });
    }

    return identityId;
  }

  public buildName(details: IdentityDetails): string {
    return this.canonicalName(details);
  }

  public buildMetadata(inputMetadataJson: string, details: IdentityDetails): string {
    return this.buildIdentityMetadata(inputMetadataJson, details);
  }
}
