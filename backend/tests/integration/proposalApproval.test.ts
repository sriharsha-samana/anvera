import bcrypt from 'bcryptjs';
import { ProposalType, UserRole, VersionSourceType } from '@prisma/client';
import { prisma } from '../../src/infrastructure/db/prisma';
import { ProposalWorkflowService } from '../../src/application/services/ProposalWorkflowService';

describe('Proposal approval transaction flow', () => {
  test('approving a proposal applies mutation and creates immutable snapshot version', async () => {
    const owner = await prisma.user.create({
      data: {
        username: 'owner1',
        email: 'owner1@example.com',
        givenName: 'Owner',
        familyName: 'One',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('owner1', 10),
        role: UserRole.OWNER,
      },
    });

    const member = await prisma.user.create({
      data: {
        username: 'member1',
        email: 'member1@example.com',
        givenName: 'Member',
        familyName: 'One',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('member1', 10),
        role: UserRole.MEMBER,
      },
    });

    const family = await prisma.family.create({
      data: {
        name: 'Family 1',
        ownerId: owner.id,
        members: { create: [{ userId: owner.id }, { userId: member.id }] },
      },
    });

    await prisma.familyVersion.create({
      data: {
        familyId: family.id,
        versionNumber: 1,
        snapshotJson: JSON.stringify({ persons: [], relationships: [] }),
        createdById: owner.id,
        sourceType: VersionSourceType.MANUAL_EDIT,
        message: 'init',
      },
    });

    const workflow = new ProposalWorkflowService();
    const proposal = await workflow.submitProposal(family.id, member.id, UserRole.MEMBER, ProposalType.ADD_PERSON, {
      name: 'New Person',
      givenName: 'New',
      familyName: 'Person',
      gender: 'female',
      email: 'new.person@example.com',
      metadata: { branch: 'x' },
    });

    const approved = await workflow.approveProposal(proposal.id, owner.id);

    expect(approved.status).toBe('APPROVED');
    expect(approved.appliedVersionNumber).toBe(2);

    const person = await prisma.person.findFirst({ where: { familyId: family.id, name: 'New Person' } });
    expect(person).toBeTruthy();

    const version = await prisma.familyVersion.findUnique({
      where: { familyId_versionNumber: { familyId: family.id, versionNumber: 2 } },
    });
    expect(version).toBeTruthy();
    expect(version?.sourceType).toBe('PROPOSAL');
    const snapshot = JSON.parse(version!.snapshotJson) as { persons: Array<{ name: string }> };
    expect(snapshot.persons.some((p) => p.name === 'New Person')).toBe(true);
  });
});
