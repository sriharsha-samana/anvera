import request from 'supertest';
import { app } from '../../src/app';

describe('GET /relationship culture-aware kinship', () => {
  beforeAll(() => {
    if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-secret';
  });

  test('returns kinship payload for culture=te', async () => {
    const unique = Date.now();
    const email = `owner-rel-culture-${unique}@example.com`;
    const register = await request(app).post('/auth/register').send({
      givenName: 'Owner',
      familyName: 'Culture',
      gender: 'male',
      email,
      password: 'owner123',
    }).expect(201);
    const ownerToken = register.body.token as string;

    const family = await request(app)
      .post('/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Culture Family' })
      .expect(201);

    const familyId = family.body.id as string;

    const me = await request(app)
      .post(`/families/${familyId}/persons`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ givenName: 'Me', familyName: 'User', gender: 'male', email: 'me.rel.culture@example.com' })
      .expect(201);

    const mother = await request(app)
      .post(`/families/${familyId}/persons`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ givenName: 'Mother', familyName: 'User', gender: 'female', email: 'mother.rel.culture@example.com' })
      .expect(201);

    const mb = await request(app)
      .post(`/families/${familyId}/persons`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ givenName: 'Maternal', familyName: 'Uncle', gender: 'male', email: 'mb.rel.culture@example.com' })
      .expect(201);

    await request(app)
      .post(`/families/${familyId}/relationships`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ fromPersonId: mother.body.id as string, toPersonId: me.body.id as string, type: 'PARENT' })
      .expect(201);

    await request(app)
      .post(`/families/${familyId}/relationships`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ fromPersonId: mother.body.id as string, toPersonId: mb.body.id as string, type: 'SIBLING' })
      .expect(201);

    const response = await request(app)
      .get('/relationship')
      .query({
        familyId,
        personA: me.body.id,
        personB: mb.body.id,
        culture: 'te',
      })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(typeof response.body.label).toBe('string');
    expect(response.body.kinship).toBeTruthy();
    expect(response.body.kinship.culture).toBe('te');
    expect(response.body.kinship.code).toBe('MB');
    expect(typeof response.body.kinship.confidence).toBe('string');
    expect(response.body.kinship.termTe).toBe('మామ');
  });
});
