import bcrypt from 'bcryptjs';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { app } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

describe('REST API', () => {
  test('login + create family + submit and list proposals', async () => {
    const owner = await prisma.user.create({
      data: {
        username: 'owner-api',
        email: 'owner-api@example.com',
        givenName: 'Owner',
        familyName: 'Api',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('owner123', 10),
        role: UserRole.OWNER,
      },
    });

    const member = await prisma.user.create({
      data: {
        username: 'member-api',
        email: 'member-api@example.com',
        givenName: 'Member',
        familyName: 'Api',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('member123', 10),
        role: UserRole.MEMBER,
      },
    });

    const loginOwner = await request(app)
      .post('/auth/login')
      .send({ identifier: owner.username, password: 'owner123' })
      .expect(200);
    const ownerToken = loginOwner.body.token as string;

    const familyResponse = await request(app)
      .post('/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'API Family' })
      .expect(201);

    const familyId = familyResponse.body.id as string;
    await prisma.familyMember.create({ data: { familyId, userId: member.id } });

    const loginMember = await request(app)
      .post('/auth/login')
      .send({ identifier: member.username, password: 'member123' })
      .expect(200);

    await request(app)
      .post(`/families/${familyId}/proposals`)
      .set('Authorization', `Bearer ${loginMember.body.token as string}`)
      .send({
        type: 'ADD_PERSON',
        data: {
          name: 'Api Person',
          givenName: 'Api',
          familyName: 'Person',
          gender: 'male',
          email: 'api.person@example.com',
        },
      })
      .expect(201);

    const list = await request(app)
      .get(`/families/${familyId}/proposals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body[0].type).toBe('ADD_PERSON');
  });

  test('owner can clone an entire family dataset', async () => {
    const owner = await prisma.user.create({
      data: {
        username: 'owner-clone',
        email: 'owner-clone@example.com',
        givenName: 'Owner',
        familyName: 'Clone',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('owner123', 10),
        role: UserRole.OWNER,
      },
    });
    const member = await prisma.user.create({
      data: {
        username: 'member-clone',
        email: 'member-clone@example.com',
        givenName: 'Member',
        familyName: 'Clone',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('member123', 10),
        role: UserRole.MEMBER,
      },
    });

    const loginOwner = await request(app)
      .post('/auth/login')
      .send({ identifier: owner.username, password: 'owner123' })
      .expect(200);
    const ownerToken = loginOwner.body.token as string;

    const familyResponse = await request(app)
      .post('/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Source Family' })
      .expect(201);
    const sourceFamilyId = familyResponse.body.id as string;

    await prisma.familyMember.create({ data: { familyId: sourceFamilyId, userId: member.id } });

    const personOne = await request(app)
      .post(`/families/${sourceFamilyId}/persons`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        givenName: 'Arjun',
        familyName: 'Sharma',
        gender: 'male',
        email: 'arjun.clone@example.com',
      })
      .expect(201);
    const personTwo = await request(app)
      .post(`/families/${sourceFamilyId}/persons`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        givenName: 'Kavya',
        familyName: 'Sharma',
        gender: 'female',
        email: 'kavya.clone@example.com',
      })
      .expect(201);

    await request(app)
      .post(`/families/${sourceFamilyId}/relationships`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        fromPersonId: personOne.body.id as string,
        toPersonId: personTwo.body.id as string,
        type: 'SIBLING',
      })
      .expect(201);

    await request(app)
      .post(`/families/${sourceFamilyId}/proposals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'ADD_PERSON',
        data: {
          givenName: 'Pending',
          familyName: 'Proposal',
          gender: 'other',
          email: 'pending.clone@example.com',
        },
      })
      .expect(201);

    const cloneResponse = await request(app)
      .post(`/families/${sourceFamilyId}/clone`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Cloned Family Set' })
      .expect(201);

    const clonedFamilyId = cloneResponse.body.id as string;
    expect(clonedFamilyId).toBeTruthy();
    expect(clonedFamilyId).not.toBe(sourceFamilyId);
    expect(cloneResponse.body.name).toBe('Cloned Family Set');

    const [
      sourcePersons,
      clonedPersons,
      sourceRelationships,
      clonedRelationships,
      sourceProposals,
      clonedProposals,
      sourceVersions,
      clonedVersions,
      sourceMembers,
      clonedMembers,
    ] = await Promise.all([
      prisma.person.findMany({ where: { familyId: sourceFamilyId } }),
      prisma.person.findMany({ where: { familyId: clonedFamilyId } }),
      prisma.relationship.findMany({ where: { familyId: sourceFamilyId } }),
      prisma.relationship.findMany({ where: { familyId: clonedFamilyId } }),
      prisma.proposal.findMany({ where: { familyId: sourceFamilyId } }),
      prisma.proposal.findMany({ where: { familyId: clonedFamilyId } }),
      prisma.familyVersion.findMany({ where: { familyId: sourceFamilyId }, orderBy: { versionNumber: 'asc' } }),
      prisma.familyVersion.findMany({ where: { familyId: clonedFamilyId }, orderBy: { versionNumber: 'asc' } }),
      prisma.familyMember.findMany({ where: { familyId: sourceFamilyId } }),
      prisma.familyMember.findMany({ where: { familyId: clonedFamilyId } }),
    ]);

    expect(clonedPersons).toHaveLength(sourcePersons.length);
    expect(clonedRelationships).toHaveLength(sourceRelationships.length);
    expect(clonedProposals).toHaveLength(sourceProposals.length);
    expect(clonedVersions).toHaveLength(sourceVersions.length);
    expect(clonedMembers).toHaveLength(sourceMembers.length);

    sourcePersons.forEach((sourcePerson) => {
      expect(clonedPersons.some((clonedPerson) => clonedPerson.email === sourcePerson.email)).toBe(true);
      expect(clonedPersons.some((clonedPerson) => clonedPerson.id === sourcePerson.id)).toBe(false);
    });

    const clonedLatestSnapshot = JSON.parse(clonedVersions[clonedVersions.length - 1]!.snapshotJson) as {
      persons: Array<{ familyId: string; id: string }>;
      relationships: Array<{ familyId: string; fromPersonId: string; toPersonId: string }>;
    };
    expect(clonedLatestSnapshot.persons.every((person) => person.familyId === clonedFamilyId)).toBe(true);
    expect(
      clonedLatestSnapshot.relationships.every(
        (relationship) =>
          relationship.familyId === clonedFamilyId &&
          clonedPersons.some((person) => person.id === relationship.fromPersonId) &&
          clonedPersons.some((person) => person.id === relationship.toPersonId),
      ),
    ).toBe(true);
  });

  test('rejects creating same-email person with conflicting profile in another family', async () => {
    const ownerOne = await prisma.user.create({
      data: {
        username: 'owner-conflict-1',
        email: 'owner-conflict-1@example.com',
        givenName: 'Owner',
        familyName: 'One',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('owner123', 10),
        role: UserRole.OWNER,
      },
    });
    const ownerTwo = await prisma.user.create({
      data: {
        username: 'owner-conflict-2',
        email: 'owner-conflict-2@example.com',
        givenName: 'Owner',
        familyName: 'Two',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('owner123', 10),
        role: UserRole.OWNER,
      },
    });

    const ownerOneToken = (
      await request(app).post('/auth/login').send({ identifier: ownerOne.username, password: 'owner123' }).expect(200)
    ).body.token as string;
    const ownerTwoToken = (
      await request(app).post('/auth/login').send({ identifier: ownerTwo.username, password: 'owner123' }).expect(200)
    ).body.token as string;

    const familyOneId = (
      await request(app).post('/families').set('Authorization', `Bearer ${ownerOneToken}`).send({ name: 'Family One' }).expect(201)
    ).body.id as string;
    const familyTwoId = (
      await request(app).post('/families').set('Authorization', `Bearer ${ownerTwoToken}`).send({ name: 'Family Two' }).expect(201)
    ).body.id as string;

    await request(app)
      .post(`/families/${familyOneId}/persons`)
      .set('Authorization', `Bearer ${ownerOneToken}`)
      .send({
        givenName: 'Sita',
        familyName: 'Rao',
        gender: 'female',
        email: 'shared.identity@example.com',
        dateOfBirth: '1990-01-01',
      })
      .expect(201);

    const conflicting = await request(app)
      .post(`/families/${familyTwoId}/persons`)
      .set('Authorization', `Bearer ${ownerTwoToken}`)
      .send({
        givenName: 'Sita-Changed',
        familyName: 'Rao',
        gender: 'female',
        email: 'shared.identity@example.com',
        dateOfBirth: '1990-01-01',
      })
      .expect(409);

    expect((conflicting.body.message as string).toLowerCase()).toContain('identity mismatch');
  });

  test('updating one shared identity propagates to cloned family person profile', async () => {
    const owner = await prisma.user.create({
      data: {
        username: 'owner-sync',
        email: 'owner-sync@example.com',
        givenName: 'Owner',
        familyName: 'Sync',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('owner123', 10),
        role: UserRole.OWNER,
      },
    });

    const ownerToken = (
      await request(app).post('/auth/login').send({ identifier: owner.username, password: 'owner123' }).expect(200)
    ).body.token as string;

    const sourceFamilyId = (
      await request(app).post('/families').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Source Sync Family' }).expect(201)
    ).body.id as string;

    const sourcePersonId = (
      await request(app)
        .post(`/families/${sourceFamilyId}/persons`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          givenName: 'Aarav',
          familyName: 'Sharma',
          gender: 'male',
          email: 'sync.identity@example.com',
          dateOfBirth: '1995-02-10',
        })
        .expect(201)
    ).body.id as string;

    const clonedFamilyId = (
      await request(app)
        .post(`/families/${sourceFamilyId}/clone`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Clone Sync Family' })
        .expect(201)
    ).body.id as string;

    const clonedPerson = await prisma.person.findFirst({
      where: { familyId: clonedFamilyId, email: 'sync.identity@example.com' },
      select: { id: true, givenName: true, familyName: true },
    });
    expect(clonedPerson?.id).toBeTruthy();

    await request(app)
      .put(`/families/${clonedFamilyId}/persons/${clonedPerson!.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        givenName: 'Aarav Updated',
        familyName: 'Sharma',
        gender: 'male',
        email: 'sync.identity@example.com',
        dateOfBirth: '1995-02-10',
      })
      .expect(200);

    const [sourceAfter, cloneAfter] = await Promise.all([
      prisma.person.findUnique({ where: { id: sourcePersonId }, select: { givenName: true } }),
      prisma.person.findUnique({ where: { id: clonedPerson!.id }, select: { givenName: true } }),
    ]);

    expect(sourceAfter?.givenName).toBe('Aarav Updated');
    expect(cloneAfter?.givenName).toBe('Aarav Updated');
  });
});
