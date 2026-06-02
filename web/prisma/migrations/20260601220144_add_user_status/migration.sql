-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable: add nullable first so existing rows are not forced to pending
ALTER TABLE "users" ADD COLUMN "status" "UserStatus";

-- Backfill: every existing user (including admin) becomes approved
UPDATE "users" SET "status" = 'approved' WHERE "status" IS NULL;

-- Enforce NOT NULL and set default pending for new registrations
ALTER TABLE "users" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'pending';
