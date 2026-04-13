-- Migration: Add roles array field to User and populate from existing role
-- Run this against your PostgreSQL database after deploying the updated schema

-- Step 1: Add the roles column (empty array default)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "roles" TEXT[] NOT NULL DEFAULT '{}';

-- Step 2: Populate roles from the existing role field for all existing users
UPDATE "User" SET "roles" = ARRAY[role::text] WHERE array_length("roles", 1) IS NULL OR array_length("roles", 1) = 0;
