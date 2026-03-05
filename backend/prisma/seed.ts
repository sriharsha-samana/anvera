import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  ProposalType,
  RelationshipType,
  UserRole,
  VersionSourceType,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const ownerPassword = await bcrypt.hash('owner123', 10);
  const memberPassword = await bcrypt.hash('member123', 10);

  const owner = await prisma.user.upsert({
    where: { username: 'owner' },
    update: {
      email: 'owner@example.com',
      phone: '+919900000001',
      givenName: 'Owner',
      familyName: 'User',
      gender: 'unknown',
    },
    create: {
      username: 'owner',
      email: 'owner@example.com',
      phone: '+919900000001',
      givenName: 'Owner',
      familyName: 'User',
      gender: 'unknown',
      passwordHash: ownerPassword,
      role: UserRole.OWNER,
    },
  });

  const member = await prisma.user.upsert({
    where: { username: 'member' },
    update: {
      email: 'member@example.com',
      phone: '+919900000002',
      givenName: 'Member',
      familyName: 'User',
      gender: 'unknown',
    },
    create: {
      username: 'member',
      email: 'member@example.com',
      phone: '+919900000002',
      givenName: 'Member',
      familyName: 'User',
      gender: 'unknown',
      passwordHash: memberPassword,
      role: UserRole.MEMBER,
    },
  });

  const family = await prisma.family.create({
    data: {
      name: 'Samana Family',
      ownerId: owner.id,
      members: {
        create: [{ userId: owner.id }, { userId: member.id }],
      },
    },
  });

  const [identityGrandparent, identityParent, identityChild] = await Promise.all([
    prisma.personIdentity.create({
      data: {
        id: 'seed-identity-grandparent',
        givenName: 'Grand',
        familyName: 'Parent',
        gender: 'female',
        email: 'grandparent@example.com',
      },
    }),
    prisma.personIdentity.create({
      data: {
        id: 'seed-identity-parent',
        givenName: 'Parent',
        familyName: 'One',
        gender: 'male',
        email: 'parent@example.com',
      },
    }),
    prisma.personIdentity.create({
      data: {
        id: 'seed-identity-child',
        givenName: 'Child',
        familyName: 'One',
        gender: 'female',
        email: 'child@example.com',
      },
    }),
  ]);

  const [p1, p2, p3] = await Promise.all([
    prisma.person.create({
      data: {
        id: 'seed-grandparent',
        familyId: family.id,
        identityId: identityGrandparent.id,
        name: 'Grandparent',
        givenName: 'Grand',
        familyName: 'Parent',
        gender: 'female',
        email: 'grandparent@example.com',
        metadataJson: JSON.stringify({}),
      },
    }),
    prisma.person.create({
      data: {
        id: 'seed-parent',
        familyId: family.id,
        identityId: identityParent.id,
        name: 'Parent',
        givenName: 'Parent',
        familyName: 'One',
        gender: 'male',
        email: 'parent@example.com',
        metadataJson: JSON.stringify({}),
      },
    }),
    prisma.person.create({
      data: {
        id: 'seed-child',
        familyId: family.id,
        identityId: identityChild.id,
        name: 'Child',
        givenName: 'Child',
        familyName: 'One',
        gender: 'female',
        email: 'child@example.com',
        metadataJson: JSON.stringify({}),
      },
    }),
  ]);

  await prisma.relationship.createMany({
    data: [
      {
        familyId: family.id,
        fromPersonId: p1.id,
        toPersonId: p2.id,
        type: RelationshipType.PARENT,
        metadataJson: JSON.stringify({}),
      },
      {
        familyId: family.id,
        fromPersonId: p2.id,
        toPersonId: p3.id,
        type: RelationshipType.PARENT,
        metadataJson: JSON.stringify({}),
      },
    ],
  });

  const snapshot = {
    persons: [p1, p2, p3],
    relationships: await prisma.relationship.findMany({ where: { familyId: family.id } }),
  };

  await prisma.familyVersion.create({
    data: {
      familyId: family.id,
      versionNumber: 1,
      snapshotJson: JSON.stringify(snapshot),
      createdById: owner.id,
      sourceType: VersionSourceType.MANUAL_EDIT,
      message: 'Initial seeded snapshot',
    },
  });

  await prisma.proposal.create({
    data: {
      familyId: family.id,
      type: ProposalType.ADD_PERSON,
      payloadJson: JSON.stringify({
        name: 'Proposed Person',
        givenName: 'Proposed',
        familyName: 'Person',
        gender: 'male',
        email: 'proposed.person@example.com',
        metadata: {},
      }),
      previewJson: JSON.stringify({}),
      createdById: member.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
