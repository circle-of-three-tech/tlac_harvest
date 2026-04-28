-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SMSType" ADD VALUE 'SOULSTATE_UNBELIEVER';
ALTER TYPE "SMSType" ADD VALUE 'SOULSTATE_NEW_CONVERT';
ALTER TYPE "SMSType" ADD VALUE 'SOULSTATE_UNCHURCHED_BELIEVER';
ALTER TYPE "SMSType" ADD VALUE 'SOULSTATE_HUNGRY_BELIEVER';
ALTER TYPE "SMSType" ADD VALUE 'INACTIVITY_REMINDER_FOLLOWUP';
ALTER TYPE "SMSType" ADD VALUE 'INACTIVITY_REMINDER_EVANGELIST';
