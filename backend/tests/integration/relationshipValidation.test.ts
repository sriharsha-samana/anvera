import bcrypt from 'bcryptjs';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { app } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

describe('Relationship validation', () => {
  test('prevents cyclic parent edits and invalid relationship proposals', async () => {
    const owner = await prisma.user.create({
      data: {
        username: 'owner-valid',
        email: 'owner-valid@example.com',
        givenName: 'Owner',
        familyName: 'Valid',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('owner123', 10),
        role: UserRole.OWNER,
      },
    });
    const member = await prisma.user.create({
      data: {
        username: 'member-valid',
        email: 'member-valid@example.com',
        givenName: 'Member',
        familyName: 'Valid',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('member123', 10),
        role: UserRole.MEMBER,
      },
    });

    const ownerLogin = await request(app)
      .post('/auth/login')
      .send({ identifier: owner.username, password: 'owner123' })
      .expect(200);
    const memberLogin = await request(app)
      .post('/auth/login')
      .send({ identifier: member.username, password: 'member123' })
      .expect(200);
    const ownerToken = ownerLogin.body.token as string;
    const memberToken = memberLogin.body.token as string;

    const familyResponse = await request(app)
      .post('/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Validation Family' })
      .expect(201);
    const familyId = familyResponse.body.id as string;

    await prisma.familyMember.create({
      data: {
        familyId,
        userId: member.id,
      },
    });

    const a = await request(app)
      .post(`/families/${familyId}/persons`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Alex One', givenName: 'Alex', familyName: 'One', gender: 'male', email: 'alex.valid@example.com' })
      .expect(201);
    const b = await request(app)
      .post(`/families/${familyId}/persons`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Bella One', givenName: 'Bella', familyName: 'One', gender: 'female', email: 'bella.valid@example.com' })
      .expect(201);
    const c = await request(app)
      .post(`/families/${familyId}/persons`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Cyrus One', givenName: 'Cyrus', familyName: 'One', gender: 'male', email: 'cyrus.valid@example.com' })
      .expect(201);

    await request(app)
      .post(`/families/${familyId}/relationships`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ fromPersonId: a.body.id, toPersonId: b.body.id, type: 'PARENT' })
      .expect(201);
    const bToC = await request(app)
      .post(`/families/${familyId}/relationships`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ fromPersonId: b.body.id, toPersonId: c.body.id, type: 'PARENT' })
      .expect(201);

    const updateCycle = await request(app)
      .put(`/families/${familyId}/relationships/${bToC.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ fromPersonId: c.body.id, toPersonId: a.body.id, type: 'PARENT' })
      .expect(400);
    expect(updateCycle.body.message).toContain('create an ancestry cycle');

    const invalidProposal = await request(app)
      .post(`/families/${familyId}/proposals`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        type: 'ADD_RELATIONSHIP',
        data: { fromPersonId: b.body.id, toPersonId: a.body.id, type: 'PARENT' },
      })
      .expect(400);
    expect(invalidProposal.body.message).toContain('Invalid parent relationship');
  });
});
