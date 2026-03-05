import bcrypt from 'bcryptjs';
import request from 'supertest';
import { RelationshipType, UserRole } from '@prisma/client';
import { app } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

describe('AI relationship question API', () => {
  test('answers "who is X to me" with computed relationship and fallback when Ollama is unavailable', async () => {
    const owner = await prisma.user.create({
      data: {
        username: 'owner-ai',
        email: 'owner-ai@example.com',
        givenName: 'Owner',
        familyName: 'AI',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('owner123', 10),
        role: UserRole.OWNER,
      },
    });

    const family = await prisma.family.create({
      data: {
        name: 'AI Family',
        ownerId: owner.id,
        members: { create: [{ userId: owner.id }] },
      },
    });

    const meIdentity = await prisma.personIdentity.create({
      data: {
        givenName: 'Harsha',
        familyName: 'AI',
        gender: 'male',
        email: 'harsha.ai@example.com',
      },
    });
    const fatherIdentity = await prisma.personIdentity.create({
      data: {
        givenName: 'Ramesh',
        familyName: 'AI',
        gender: 'male',
        email: 'ramesh.ai@example.com',
      },
    });

    const me = await prisma.person.create({
      data: {
        familyId: family.id,
        identityId: meIdentity.id,
        name: 'Harsha',
        givenName: 'Harsha',
        familyName: 'AI',
        gender: 'male',
        email: 'harsha.ai@example.com',
        metadataJson: '{}',
      },
    });
    const father = await prisma.person.create({
      data: {
        familyId: family.id,
        identityId: fatherIdentity.id,
        name: 'Ramesh',
        givenName: 'Ramesh',
        familyName: 'AI',
        gender: 'male',
        email: 'ramesh.ai@example.com',
        metadataJson: '{}',
      },
    });
    await prisma.relationship.create({
      data: {
        familyId: family.id,
        fromPersonId: father.id,
        toPersonId: me.id,
        type: RelationshipType.PARENT,
        metadataJson: '{}',
      },
    });

    const login = await request(app)
      .post('/auth/login')
      .send({ identifier: 'owner-ai', password: 'owner123' })
      .expect(200);

    const response = await request(app)
      .post('/ai/ask')
      .set('Authorization', `Bearer ${login.body.token as string}`)
      .send({
        familyId: family.id,
        mePersonId: me.id,
        question: 'Who is Ramesh to me?',
      })
      .expect(200);

    expect(response.body.relationship.label).toBe('Parent');
    expect(response.body.resolved.subject.name).toBe('Ramesh');
    expect(response.body.resolved.object.name).toBe('Harsha');
    expect(response.body.answer).toContain('Ramesh');
  });

  test('returns 400 when "to me" question is asked without me resolution', async () => {
    const owner = await prisma.user.create({
      data: {
        username: 'owner-ai-2',
        email: 'owner-ai-2@example.com',
        givenName: 'Owner',
        familyName: 'AITwo',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('owner123', 10),
        role: UserRole.OWNER,
      },
    });

    const family = await prisma.family.create({
      data: {
        name: 'AI Family 2',
        ownerId: owner.id,
        members: { create: [{ userId: owner.id }] },
      },
    });

    const rameshIdentity = await prisma.personIdentity.create({
      data: {
        givenName: 'Ramesh',
        familyName: 'Two',
        gender: 'male',
        email: 'ramesh.two@example.com',
      },
    });
    const sureshIdentity = await prisma.personIdentity.create({
      data: {
        givenName: 'Suresh',
        familyName: 'Two',
        gender: 'male',
        email: 'suresh.two@example.com',
      },
    });

    await prisma.person.createMany({
      data: [
        {
          identityId: rameshIdentity.id,
          familyId: family.id,
          name: 'Ramesh',
          givenName: 'Ramesh',
          familyName: 'Two',
          gender: 'male',
          email: 'ramesh.two@example.com',
          metadataJson: '{}',
        },
        {
          identityId: sureshIdentity.id,
          familyId: family.id,
          name: 'Suresh',
          givenName: 'Suresh',
          familyName: 'Two',
          gender: 'male',
          email: 'suresh.two@example.com',
          metadataJson: '{}',
        },
      ],
    });

    const login = await request(app)
      .post('/auth/login')
      .send({ identifier: 'owner-ai-2', password: 'owner123' })
      .expect(200);

    const response = await request(app)
      .post('/ai/ask')
      .set('Authorization', `Bearer ${login.body.token as string}`)
      .send({
        familyId: family.id,
        question: 'Who is Ramesh to me?',
      })
      .expect(400);

    expect(response.body.message).toContain('Please select "I am" person');
  });

  test('supports global assistant mode by resolving family context when familyId is omitted', async () => {
    const owner = await prisma.user.create({
      data: {
        username: 'owner-ai-global',
        email: 'owner-ai-global@example.com',
        givenName: 'Owner',
        familyName: 'Global',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('owner123', 10),
        role: UserRole.OWNER,
      },
    });

    const alphaFamily = await prisma.family.create({
      data: {
        name: 'Alpha Family',
        ownerId: owner.id,
        members: { create: [{ userId: owner.id }] },
      },
    });
    const betaFamily = await prisma.family.create({
      data: {
        name: 'Beta Family',
        ownerId: owner.id,
        members: { create: [{ userId: owner.id }] },
      },
    });

    const ownerIdentity = await prisma.personIdentity.create({
      data: {
        givenName: 'Global',
        familyName: 'Owner',
        gender: 'male',
        email: owner.email!,
      },
    });
    const rameshIdentity = await prisma.personIdentity.create({
      data: {
        givenName: 'Ramesh',
        familyName: 'Global',
        gender: 'male',
        email: 'ramesh.global@example.com',
      },
    });
    const otherIdentity = await prisma.personIdentity.create({
      data: {
        givenName: 'Other',
        familyName: 'Person',
        gender: 'male',
        email: 'other.global@example.com',
      },
    });

    const meInAlpha = await prisma.person.create({
      data: {
        familyId: alphaFamily.id,
        identityId: ownerIdentity.id,
        name: 'owner-ai-global',
        givenName: 'Global',
        familyName: 'Owner',
        gender: 'male',
        email: owner.email,
        metadataJson: '{}',
      },
    });
    const rameshInAlpha = await prisma.person.create({
      data: {
        familyId: alphaFamily.id,
        identityId: rameshIdentity.id,
        name: 'Ramesh',
        givenName: 'Ramesh',
        familyName: 'Global',
        gender: 'male',
        email: 'ramesh.global@example.com',
        metadataJson: '{}',
      },
    });
    await prisma.person.create({
      data: {
        familyId: betaFamily.id,
        identityId: otherIdentity.id,
        name: 'Other Person',
        givenName: 'Other',
        familyName: 'Person',
        gender: 'male',
        email: 'other.global@example.com',
        metadataJson: '{}',
      },
    });
    await prisma.relationship.create({
      data: {
        familyId: alphaFamily.id,
        fromPersonId: rameshInAlpha.id,
        toPersonId: meInAlpha.id,
        type: RelationshipType.PARENT,
        metadataJson: '{}',
      },
    });

    const login = await request(app)
      .post('/auth/login')
      .send({ identifier: 'owner-ai-global', password: 'owner123' })
      .expect(200);

    const response = await request(app)
      .post('/ai/ask')
      .set('Authorization', `Bearer ${login.body.token as string}`)
      .send({
        question: 'Who is Ramesh to me?',
      })
      .expect(200);

    expect(response.body.family.id).toBe(alphaFamily.id);
    expect(response.body.family.name).toBe('Alpha Family');
    expect(response.body.relationship.label).toBe('Parent');
    expect(response.body.resolved.subject.name).toBe('Ramesh');
  });
});
