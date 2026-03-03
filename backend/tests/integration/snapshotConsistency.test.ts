import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { FamilyService } from '../../src/application/services/FamilyService';
import { VersionService } from '../../src/application/services/VersionService';
import { prisma } from '../../src/infrastructure/db/prisma';

describe('Snapshot consistency', () => {
  test('latest version snapshot equals current graph state', async () => {
    const owner = await prisma.user.create({
      data: {
        username: 'owner3',
        email: 'owner3@example.com',
        givenName: 'Owner',
        familyName: 'Three',
        gender: 'unknown',
        passwordHash: await bcrypt.hash('owner3', 10),
        role: UserRole.OWNER,
      },
    });

    const familyService = new FamilyService();
    const family = (await familyService.createFamily('Family 3', owner.id)) as { id: string };

    const personA = (await familyService.addPerson(family.id, owner.id, {
      name: 'A',
      givenName: 'A',
      familyName: 'Person',
      gender: 'male',
      email: 'a.person@example.com',
    })) as { id: string };

    const personB = (await familyService.addPerson(family.id, owner.id, {
      name: 'B',
      givenName: 'B',
      familyName: 'Person',
      gender: 'female',
      email: 'b.person@example.com',
    })) as { id: string };

    await familyService.addRelationship(family.id, owner.id, {
      fromPersonId: personA.id,
      toPersonId: personB.id,
      type: 'SPOUSE',
    });

    const versionService = new VersionService();
    const versions = await versionService.listVersions(family.id);
    const latest = versions[0];

    const snapshot = JSON.parse(latest.snapshotJson) as {
      persons: Array<{ id: string }>;
      relationships: Array<{ id: string }>;
    };

    const [dbPersons, dbRelationships] = await Promise.all([
      prisma.person.findMany({ where: { familyId: family.id } }),
      prisma.relationship.findMany({ where: { familyId: family.id } }),
    ]);

    expect(snapshot.persons.length).toBe(dbPersons.length);
    expect(snapshot.relationships.length).toBe(dbRelationships.length);

    const snapshotPersonIds = snapshot.persons.map((p) => p.id).sort();
    const dbPersonIds = dbPersons.map((p) => p.id).sort();
    expect(snapshotPersonIds).toEqual(dbPersonIds);
  });
});
