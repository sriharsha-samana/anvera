import { prisma } from '../src/infrastructure/db/prisma';

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.familyVersion.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.relationship.deleteMany();
  await prisma.person.deleteMany();
  await prisma.familyMember.deleteMany();
  await prisma.family.deleteMany();
  await prisma.user.deleteMany();
  await prisma.personIdentity.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
