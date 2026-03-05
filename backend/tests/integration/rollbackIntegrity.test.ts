import bcrypt from 'bcryptjs';
import { ProposalType, UserRole, VersionSourceType } from '@prisma/client';
import { FamilyService } from '../../src/application/services/FamilyService';
import { ProposalWorkflowService } from '../../src/application/services/ProposalWorkflowService';
import { VersionService } from '../../src/application/services/VersionService';
import { prisma } from '../../src/infrastructure/db/prisma';

describe('Rollback integrity', () => {
  test('rollback creates new version and marks later approved proposals overridden', async () => {
    const owner = await prisma.user.create({
      data: {
        username: 'owner2',
        email: 'owner2@example.com',
        givenName: 'Owner',
        familyName: 'Two',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('owner2', 10),
        role: UserRole.OWNER,
      },
    });

    const member = await prisma.user.create({
      data: {
        username: 'member2',
        email: 'member2@example.com',
        givenName: 'Member',
        familyName: 'Two',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('member2', 10),
        role: UserRole.MEMBER,
      },
    });

    const familyService = new FamilyService();
    const family = (await familyService.createFamily('Family 2', owner.id)) as { id: string };
    await prisma.familyMember.create({ data: { familyId: family.id, userId: member.id } });

    const workflow = new ProposalWorkflowService();

    const proposal1 = await workflow.submitProposal(
      family.id,
      member.id,
      UserRole.MEMBER,
      ProposalType.ADD_PERSON,
      {
        name: 'P1',
        givenName: 'P',
        familyName: 'One',
        gender: 'male',
        email: 'p1@example.com',
      },
    );
    await workflow.approveProposal(proposal1.id, owner.id);

    const proposal2 = await workflow.submitProposal(
      family.id,
      member.id,
      UserRole.MEMBER,
      ProposalType.ADD_PERSON,
      {
        name: 'P2',
        givenName: 'P',
        familyName: 'Two',
        gender: 'female',
        email: 'p2@example.com',
      },
    );
    await workflow.approveProposal(proposal2.id, owner.id);

    const versionService = new VersionService();
    const rollbackVersion = await versionService.rollbackToVersion(family.id, 2, owner.id);

    expect(rollbackVersion.sourceType).toBe(VersionSourceType.ROLLBACK);
    expect(rollbackVersion.versionNumber).toBe(4);

    const p2 = await prisma.proposal.findUnique({ where: { id: proposal2.id } });
    expect(p2?.overriddenByVersionNumber).toBe(4);

    const persons = await prisma.person.findMany({
      where: { familyId: family.id },
      orderBy: { name: 'asc' },
    });
    expect(persons.map((p) => p.name)).toEqual(['P1']);
  });
});
