-- CreateTable
CREATE TABLE "PersonIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "phone" TEXT,
    "givenName" TEXT,
    "familyName" TEXT,
    "gender" TEXT NOT NULL,
    "dateOfBirth" TEXT,
    "placeOfBirth" TEXT,
    "occupation" TEXT,
    "notes" TEXT,
    "profilePictureUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "PersonIdentity_email_key" ON "PersonIdentity"("email");
CREATE UNIQUE INDEX "PersonIdentity_phone_key" ON "PersonIdentity"("phone");

ALTER TABLE "User" ADD COLUMN "identityId" TEXT;
ALTER TABLE "Person" ADD COLUMN "identityId" TEXT;

-- Seed one identity per global person key (email first, then phone, otherwise person id)
WITH person_groups AS (
  SELECT
    CASE
      WHEN "email" IS NOT NULL THEN 'email:' || lower("email")
      WHEN "phone" IS NOT NULL THEN 'phone:' || "phone"
      ELSE 'person:' || "id"
    END AS identityKey,
    MIN("id") AS seedPersonId
  FROM "Person"
  GROUP BY 1
)
INSERT INTO "PersonIdentity" (
  "id", "email", "phone", "givenName", "familyName", "gender", "dateOfBirth",
  "placeOfBirth", "occupation", "notes", "profilePictureUrl", "createdAt", "updatedAt"
)
SELECT
  'pid_' || replace(substr(seed."id", 1, 24), '-', '') AS "id",
  lower(seed."email") AS "email",
  seed."phone" AS "phone",
  seed."givenName" AS "givenName",
  seed."familyName" AS "familyName",
  seed."gender" AS "gender",
  seed."dateOfBirth" AS "dateOfBirth",
  json_extract(seed."metadataJson", '$.placeOfBirth') AS "placeOfBirth",
  json_extract(seed."metadataJson", '$.occupation') AS "occupation",
  json_extract(seed."metadataJson", '$.notes') AS "notes",
  seed."profilePictureUrl" AS "profilePictureUrl",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM person_groups grp
JOIN "Person" seed ON seed."id" = grp.seedPersonId;

-- Link each person row to a canonical identity
UPDATE "Person"
SET "identityId" = (
  SELECT pi."id"
  FROM "PersonIdentity" pi
  WHERE
    ("Person"."email" IS NOT NULL AND pi."email" = lower("Person"."email"))
    OR ("Person"."email" IS NULL AND "Person"."phone" IS NOT NULL AND pi."phone" = "Person"."phone")
    OR (
      "Person"."email" IS NULL
      AND "Person"."phone" IS NULL
      AND pi."id" = ('pid_' || replace(substr("Person"."id", 1, 24), '-', ''))
    )
  LIMIT 1
);

-- Backfill any missing person identity rows
INSERT INTO "PersonIdentity" (
  "id", "email", "phone", "givenName", "familyName", "gender", "dateOfBirth",
  "placeOfBirth", "occupation", "notes", "profilePictureUrl", "createdAt", "updatedAt"
)
SELECT
  'pid_' || replace(substr(p."id", 1, 24), '-', '') AS "id",
  lower(p."email") AS "email",
  p."phone" AS "phone",
  p."givenName" AS "givenName",
  p."familyName" AS "familyName",
  p."gender" AS "gender",
  p."dateOfBirth" AS "dateOfBirth",
  json_extract(p."metadataJson", '$.placeOfBirth') AS "placeOfBirth",
  json_extract(p."metadataJson", '$.occupation') AS "occupation",
  json_extract(p."metadataJson", '$.notes') AS "notes",
  p."profilePictureUrl" AS "profilePictureUrl",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Person" p
WHERE p."identityId" IS NULL;

UPDATE "Person"
SET "identityId" = ('pid_' || replace(substr("id", 1, 24), '-', ''))
WHERE "identityId" IS NULL;

-- Link users to existing identities first
UPDATE "User"
SET "identityId" = (
  SELECT pi."id"
  FROM "PersonIdentity" pi
  WHERE
    ("User"."email" IS NOT NULL AND pi."email" = lower("User"."email"))
    OR ("User"."email" IS NULL AND "User"."phone" IS NOT NULL AND pi."phone" = "User"."phone")
  LIMIT 1
)
WHERE "identityId" IS NULL;

-- Create a dedicated identity for users not matched by person records
INSERT INTO "PersonIdentity" (
  "id", "email", "phone", "givenName", "familyName", "gender", "dateOfBirth",
  "placeOfBirth", "occupation", "notes", "profilePictureUrl", "createdAt", "updatedAt"
)
SELECT
  'uid_' || replace(substr(u."id", 1, 24), '-', '') AS "id",
  lower(u."email") AS "email",
  u."phone" AS "phone",
  u."givenName" AS "givenName",
  u."familyName" AS "familyName",
  COALESCE(u."gender", 'unknown') AS "gender",
  u."dateOfBirth" AS "dateOfBirth",
  u."placeOfBirth" AS "placeOfBirth",
  u."occupation" AS "occupation",
  u."notes" AS "notes",
  u."profilePictureUrl" AS "profilePictureUrl",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
WHERE u."identityId" IS NULL;

UPDATE "User"
SET "identityId" = ('uid_' || replace(substr("id", 1, 24), '-', ''))
WHERE "identityId" IS NULL;

PRAGMA foreign_keys=OFF;

-- Redefine User with foreign key to PersonIdentity
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "givenName" TEXT,
    "familyName" TEXT,
    "gender" TEXT,
    "dateOfBirth" TEXT,
    "placeOfBirth" TEXT,
    "occupation" TEXT,
    "notes" TEXT,
    "profilePictureUrl" TEXT,
    "identityId" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "PersonIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_User" (
  "id", "username", "email", "phone", "givenName", "familyName", "gender", "dateOfBirth", "placeOfBirth",
  "occupation", "notes", "profilePictureUrl", "identityId", "passwordHash", "role", "createdAt", "updatedAt"
)
SELECT
  "id", "username", "email", "phone", "givenName", "familyName", "gender", "dateOfBirth", "placeOfBirth",
  "occupation", "notes", "profilePictureUrl", "identityId", "passwordHash", "role", "createdAt", "updatedAt"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_identityId_key" ON "User"("identityId");

-- Redefine Person with required identity FK and family-level uniqueness
CREATE TABLE "new_Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "givenName" TEXT,
    "familyName" TEXT,
    "gender" TEXT NOT NULL,
    "dateOfBirth" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "profilePictureUrl" TEXT,
    "metadataJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Person_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Person_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "PersonIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Person" (
  "id", "familyId", "identityId", "name", "givenName", "familyName", "gender", "dateOfBirth",
  "email", "phone", "profilePictureUrl", "metadataJson", "createdAt", "updatedAt"
)
SELECT
  "id", "familyId", "identityId", "name", "givenName", "familyName", "gender", "dateOfBirth",
  "email", "phone", "profilePictureUrl", "metadataJson", "createdAt", "updatedAt"
FROM "Person";

DROP TABLE "Person";
ALTER TABLE "new_Person" RENAME TO "Person";

CREATE UNIQUE INDEX "Person_familyId_identityId_key" ON "Person"("familyId", "identityId");

PRAGMA foreign_keys=ON;
