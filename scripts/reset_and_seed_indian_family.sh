#!/usr/bin/env bash
set -euo pipefail

echo "Resetting existing demo data and seeding large Indian family tree..."

docker-compose exec -T backend node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

(async () => {
  const prisma = new PrismaClient();

  const ownerHash = await bcrypt.hash('owner123', 10);
  const memberHash = await bcrypt.hash('member123', 10);

  const owner = await prisma.user.upsert({
    where: { username: 'owner' },
    update: {
      passwordHash: ownerHash,
      role: 'OWNER',
      email: 'owner@example.com',
      phone: '+919900000001',
      givenName: 'Owner',
      familyName: 'User',
      gender: 'unknown',
    },
    create: {
      username: 'owner',
      passwordHash: ownerHash,
      role: 'OWNER',
      email: 'owner@example.com',
      phone: '+919900000001',
      givenName: 'Owner',
      familyName: 'User',
      gender: 'unknown',
    },
  });

  const member = await prisma.user.upsert({
    where: { username: 'member' },
    update: {
      passwordHash: memberHash,
      role: 'MEMBER',
      email: 'member@example.com',
      phone: '+919900000002',
      givenName: 'Member',
      familyName: 'User',
      gender: 'unknown',
    },
    create: {
      username: 'member',
      passwordHash: memberHash,
      role: 'MEMBER',
      email: 'member@example.com',
      phone: '+919900000002',
      givenName: 'Member',
      familyName: 'User',
      gender: 'unknown',
    },
  });

  // Delete all existing demo data.
  await prisma.auditLog.deleteMany();
  await prisma.familyVersion.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.relationship.deleteMany();
  await prisma.person.deleteMany();
  await prisma.familyMember.deleteMany();
  await prisma.family.deleteMany();
  await prisma.personIdentity.deleteMany();

  const family = await prisma.family.create({
    data: {
      name: 'Sharma-Venkatesh Parivar Legacy Tree',
      ownerId: owner.id,
      members: {
        create: [{ userId: owner.id }, { userId: member.id }],
      },
    },
  });

  const createPerson = async (name, gender) => {
    const [givenName, ...tail] = String(name).split(' ');
    const familyName = tail.join(' ');
    const emailSafe = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\\.+|\\.+$/g, '');
    const identity = await prisma.personIdentity.create({
      data: {
        givenName,
        familyName: familyName || null,
        gender,
        email: `${emailSafe}@family.local`,
      },
    });
    const p = await prisma.person.create({
      data: {
        familyId: family.id,
        identityId: identity.id,
        name,
        givenName,
        familyName,
        gender,
        email: `${emailSafe}@family.local`,
        metadataJson: JSON.stringify({ seeded: true }),
      },
    });
    return p.id;
  };

  const ids = {};

  // Generation 1
  ids.raghunath = await createPerson('Raghunath Sharma', 'male');
  ids.savitri = await createPerson('Savitri Sharma', 'female');

  // Generation 2
  ids.mahesh = await createPerson('Mahesh Sharma', 'male');
  ids.anjali = await createPerson('Anjali Sharma', 'female');
  ids.suresh = await createPerson('Suresh Sharma', 'male');
  ids.meena = await createPerson('Meena Sharma', 'female');
  ids.rekha = await createPerson('Rekha Iyer', 'female');
  ids.prakash = await createPerson('Prakash Iyer', 'male');

  // Generation 3
  ids.arjun = await createPerson('Arjun Sharma', 'male');
  ids.priya = await createPerson('Priya Sharma', 'female');
  ids.kavya = await createPerson('Kavya Nair', 'female');
  ids.rohit = await createPerson('Rohit Nair', 'male');
  ids.nikhil = await createPerson('Nikhil Sharma', 'male');
  ids.sneha = await createPerson('Sneha Sharma', 'female');

  ids.vivek = await createPerson('Vivek Sharma', 'male');
  ids.neha = await createPerson('Neha Sharma', 'female');
  ids.pooja = await createPerson('Pooja Bhat', 'female');
  ids.karan = await createPerson('Karan Bhat', 'male');

  ids.deepa = await createPerson('Deepa Menon', 'female');
  ids.ajay = await createPerson('Ajay Menon', 'male');
  ids.manish = await createPerson('Manish Iyer', 'male');
  ids.ritu = await createPerson('Ritu Iyer', 'female');

  // Generation 4
  ids.ishan = await createPerson('Ishan Sharma', 'male');
  ids.tara = await createPerson('Tara Sharma', 'female');
  ids.diya = await createPerson('Diya Nair', 'female');
  ids.aarav = await createPerson('Aarav Sharma', 'male');
  ids.myra = await createPerson('Myra Sharma', 'female');
  ids.rohan = await createPerson('Rohan Sharma', 'male');
  ids.siya = await createPerson('Siya Bhat', 'female');
  ids.kabir = await createPerson('Kabir Bhat', 'male');
  ids.anaya = await createPerson('Anaya Menon', 'female');
  ids.veer = await createPerson('Veer Iyer', 'male');

  // Generation 5
  ids.aditi = await createPerson('Aditi Sharma', 'female');
  ids.reyansh = await createPerson('Reyansh Sharma', 'male');
  ids.ira = await createPerson('Ira Sharma', 'female');
  ids.advik = await createPerson('Advik Sharma', 'male');
  ids.harsh = await createPerson('Harsh Nair', 'male');
  ids.kiara = await createPerson('Kiara Nair', 'female');

  const rel = [];
  const addParent = (p, c) => rel.push({ familyId: family.id, fromPersonId: ids[p], toPersonId: ids[c], type: 'PARENT', metadataJson: '{}' });
  const addSpouse = (a, b) => rel.push({ familyId: family.id, fromPersonId: ids[a], toPersonId: ids[b], type: 'SPOUSE', metadataJson: '{}' });

  // Founders and children
  addSpouse('raghunath', 'savitri');
  addParent('raghunath', 'mahesh'); addParent('savitri', 'mahesh');
  addParent('raghunath', 'suresh'); addParent('savitri', 'suresh');
  addParent('raghunath', 'rekha'); addParent('savitri', 'rekha');

  // Couples generation 2
  addSpouse('mahesh', 'anjali');
  addSpouse('suresh', 'meena');
  addSpouse('rekha', 'prakash');

  // Gen 3 children
  addParent('mahesh', 'arjun'); addParent('anjali', 'arjun');
  addParent('mahesh', 'kavya'); addParent('anjali', 'kavya');
  addParent('mahesh', 'nikhil'); addParent('anjali', 'nikhil');

  addParent('suresh', 'vivek'); addParent('meena', 'vivek');
  addParent('suresh', 'pooja'); addParent('meena', 'pooja');

  addParent('rekha', 'deepa'); addParent('prakash', 'deepa');
  addParent('rekha', 'manish'); addParent('prakash', 'manish');

  // Couples generation 3
  addSpouse('arjun', 'priya');
  addSpouse('kavya', 'rohit');
  addSpouse('nikhil', 'sneha');
  addSpouse('vivek', 'neha');
  addSpouse('pooja', 'karan');
  addSpouse('deepa', 'ajay');
  addSpouse('manish', 'ritu');

  // Gen 4 children
  addParent('arjun', 'ishan'); addParent('priya', 'ishan');
  addParent('arjun', 'tara'); addParent('priya', 'tara');

  addParent('kavya', 'diya'); addParent('rohit', 'diya');

  addParent('nikhil', 'aarav'); addParent('sneha', 'aarav');
  addParent('nikhil', 'myra'); addParent('sneha', 'myra');

  addParent('vivek', 'rohan'); addParent('neha', 'rohan');

  addParent('pooja', 'siya'); addParent('karan', 'siya');
  addParent('pooja', 'kabir'); addParent('karan', 'kabir');

  addParent('deepa', 'anaya'); addParent('ajay', 'anaya');
  addParent('manish', 'veer'); addParent('ritu', 'veer');

  // Couples generation 4
  addSpouse('ishan', 'aditi');
  addSpouse('rohan', 'ira');
  addSpouse('diya', 'harsh');

  // Gen 5 children
  addParent('ishan', 'reyansh'); addParent('aditi', 'reyansh');
  addParent('rohan', 'advik'); addParent('ira', 'advik');
  addParent('diya', 'kiara'); addParent('harsh', 'kiara');

  await prisma.relationship.createMany({ data: rel });

  // Initial snapshot version
  const snapshot = {
    persons: await prisma.person.findMany({ where: { familyId: family.id }, orderBy: { name: 'asc' } }),
    relationships: await prisma.relationship.findMany({ where: { familyId: family.id }, orderBy: { createdAt: 'asc' } }),
  };

  await prisma.familyVersion.create({
    data: {
      familyId: family.id,
      versionNumber: 1,
      snapshotJson: JSON.stringify(snapshot),
      createdById: owner.id,
      sourceType: 'MANUAL_EDIT',
      message: 'Initial seeded Indian legacy family tree',
    },
  });

  // Create proposals for UI testing
  const pending = await prisma.proposal.create({
    data: {
      familyId: family.id,
      type: 'ADD_PERSON',
      payloadJson: JSON.stringify({ name: 'Anushka Sharma', givenName: 'Anushka', familyName: 'Sharma', gender: 'female', email: 'anushka.sharma@family.local' }),
      previewJson: JSON.stringify({ diff: { addedPersons: 1, addedRelationships: 0, impacts: ['Adds person Anushka Sharma'] } }),
      createdById: member.id,
    },
  });

  const approveTarget = await prisma.proposal.create({
    data: {
      familyId: family.id,
      type: 'ADD_PERSON',
      payloadJson: JSON.stringify({ name: 'Dev Sharma', givenName: 'Dev', familyName: 'Sharma', gender: 'male', email: 'dev.sharma@family.local' }),
      previewJson: JSON.stringify({ diff: { addedPersons: 1, addedRelationships: 0, impacts: ['Adds person Dev Sharma'] } }),
      createdById: member.id,
      status: 'APPROVED',
      appliedVersionNumber: 2,
      reviewedById: owner.id,
    },
  });

  const rejected = await prisma.proposal.create({
    data: {
      familyId: family.id,
      type: 'ADD_PERSON',
      payloadJson: JSON.stringify({ name: 'Invalid Entry', givenName: 'Invalid', familyName: 'Entry', gender: 'male', email: 'invalid.entry@family.local' }),
      previewJson: JSON.stringify({ diff: { addedPersons: 1, addedRelationships: 0, impacts: ['Adds person Invalid Entry'] } }),
      createdById: member.id,
      status: 'REJECTED',
      reviewedById: owner.id,
      reviewReason: 'Duplicate branch data',
    },
  });

  console.log(JSON.stringify({
    familyId: family.id,
    familyName: family.name,
    people: snapshot.persons.length,
    relationships: snapshot.relationships.length,
    proposals: {
      pending: pending.id,
      approved: approveTarget.id,
      rejected: rejected.id,
    },
  }));

  await prisma.\$disconnect();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
"
