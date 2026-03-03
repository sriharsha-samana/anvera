import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../infrastructure/db/prisma';
import { ConflictError, UnauthorizedError } from '../../shared/errors';
import { IdentityConsistencyService } from './IdentityConsistencyService';

type RegisterInput = {
  password: string;
  givenName: string;
  familyName: string;
  gender: string;
  dateOfBirth?: string;
  email: string;
  phone?: string;
  placeOfBirth?: string;
  occupation?: string;
  notes?: string;
  profilePictureUrl?: string;
  profilePictureDataUrl?: string;
};

export class AuthService {
  private readonly identityConsistency = new IdentityConsistencyService();

  private normalizePhone(value?: string): string | undefined {
    if (!value) return undefined;
    const normalized = value.replace(/[\s\-()]/g, '');
    return normalized.length > 0 ? normalized : undefined;
  }

  public async register(input: RegisterInput): Promise<{ token: string }> {
    const email = input.email.trim().toLowerCase();
    const phone = this.normalizePhone(input.phone);
    const profilePictureUrl = input.profilePictureDataUrl ?? input.profilePictureUrl;

    const [existingEmail, existingPhone] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      phone ? prisma.user.findUnique({ where: { phone } }) : Promise.resolve(null),
    ]);
    if (existingEmail) throw new ConflictError('Email already exists');
    if (existingPhone) throw new ConflictError('Phone already exists');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.$transaction(async (tx) => {
      const identityResolution = await this.identityConsistency.resolveIdentity(tx, {
        mode: 'create',
        familyId: '__registration__',
        email,
        phone: phone ?? null,
        givenName: input.givenName,
        familyName: input.familyName,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth ?? null,
        placeOfBirth: input.placeOfBirth ?? null,
        occupation: input.occupation ?? null,
        notes: input.notes ?? null,
        profilePictureUrl: profilePictureUrl ?? null,
      });
      const identity = identityResolution.details;
      const created = await tx.user.create({
        data: {
          username: identity.email ?? email,
          email: identity.email,
          phone: identity.phone,
          givenName: identity.givenName,
          familyName: identity.familyName,
          gender: identity.gender,
          dateOfBirth: identity.dateOfBirth,
          placeOfBirth: identity.placeOfBirth,
          occupation: identity.occupation,
          notes: identity.notes,
          profilePictureUrl: identity.profilePictureUrl,
          passwordHash,
          role: 'MEMBER',
        },
      });

      const linkedPeople = await tx.person.findMany({
        where: {
          OR: [
            ...(identity.email ? [{ email: identity.email }] : []),
            ...(identity.phone ? [{ phone: identity.phone }] : []),
          ],
        },
        select: { familyId: true },
        distinct: ['familyId'],
      });
      if (linkedPeople.length > 0) {
        for (const entry of linkedPeople) {
          await tx.familyMember.upsert({
            where: { familyId_userId: { familyId: entry.familyId, userId: created.id } },
            update: {},
            create: { familyId: entry.familyId, userId: created.id },
          });
        }
      }
      await this.identityConsistency.syncIdentityEverywhere(
        tx,
        identity,
        created.id,
        identityResolution.identityId,
      );

      return created;
    });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedError('JWT secret not configured');
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
      },
      secret,
      { expiresIn: '8h' },
    );

    return { token };
  }

  public async me(userId: string): Promise<{
    id: string;
    username: string;
    email: string | null;
    phone: string | null;
    givenName: string | null;
    familyName: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    profilePictureUrl: string | null;
    createdAt: Date;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        givenName: true,
        familyName: true,
        dateOfBirth: true,
        gender: true,
        profilePictureUrl: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new UnauthorizedError('Invalid token');
    }
    return user;
  }

  public async login(identifier: string, password: string): Promise<{ token: string }> {
    const normalizedIdentifier = identifier.trim();
    const normalizedPhone = this.normalizePhone(normalizedIdentifier);
    const normalizedEmail = normalizedIdentifier.toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: normalizedIdentifier },
          { email: normalizedEmail },
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ],
      },
    });
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedError('JWT secret not configured');
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
      },
      secret,
      { expiresIn: '8h' },
    );

    return { token };
  }
}
