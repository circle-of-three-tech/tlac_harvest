-- Add UNBELIEVER to SoulState enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'UNBELIEVER'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SoulState')
  ) THEN
    ALTER TYPE "SoulState" ADD VALUE 'UNBELIEVER';
  END IF;
END
$$;
