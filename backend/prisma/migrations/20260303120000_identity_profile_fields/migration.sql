-- User identity/profile columns
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "givenName" TEXT;
ALTER TABLE "User" ADD COLUMN "familyName" TEXT;
ALTER TABLE "User" ADD COLUMN "gender" TEXT;
ALTER TABLE "User" ADD COLUMN "dateOfBirth" TEXT;
ALTER TABLE "User" ADD COLUMN "placeOfBirth" TEXT;
ALTER TABLE "User" ADD COLUMN "occupation" TEXT;
ALTER TABLE "User" ADD COLUMN "notes" TEXT;
ALTER TABLE "User" ADD COLUMN "profilePictureUrl" TEXT;

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- Person identity/profile columns
ALTER TABLE "Person" ADD COLUMN "givenName" TEXT;
ALTER TABLE "Person" ADD COLUMN "familyName" TEXT;
ALTER TABLE "Person" ADD COLUMN "email" TEXT;
ALTER TABLE "Person" ADD COLUMN "phone" TEXT;
ALTER TABLE "Person" ADD COLUMN "profilePictureUrl" TEXT;

CREATE UNIQUE INDEX "Person_familyId_email_key" ON "Person"("familyId", "email");
CREATE UNIQUE INDEX "Person_familyId_phone_key" ON "Person"("familyId", "phone");
