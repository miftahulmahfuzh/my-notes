-- Migration: Rename name column to name_deprecated (safe, non-breaking change)
-- This preserves data while removing the field from application code

-- Step 1: Rename the column (if not already renamed)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'name'
    ) THEN
        ALTER TABLE users RENAME COLUMN name TO name_deprecated;
    END IF;
END $$;

-- Step 2: Remove the NOT NULL constraint (allows ignoring the field)
ALTER TABLE users ALTER COLUMN name_deprecated DROP NOT NULL;

-- Step 3: Update comment
COMMENT ON COLUMN users.name_deprecated IS 'Deprecated user display name - to be removed in next migration';
