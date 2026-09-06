-- Add authentication/profile fields that exist in the current Prisma schema.
ALTER TABLE "User"
ADD COLUMN "name" TEXT,
ADD COLUMN "passwordHash" TEXT;
