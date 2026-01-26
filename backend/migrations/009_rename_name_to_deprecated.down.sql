-- Rollback: Restore name column

-- Step 1: Validate no NULL values exist before adding constraint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE name_deprecated IS NULL) THEN
        RAISE EXCEPTION 'Cannot rollback: name_deprecated contains NULL values. Data cleanup required.';
    END IF;
END $$;

-- Step 2: Add NOT NULL constraint back
ALTER TABLE users ALTER COLUMN name_deprecated SET NOT NULL;

-- Step 3: Rename back to name
ALTER TABLE users RENAME COLUMN name_deprecated TO name;

-- Step 4: Restore comment
COMMENT ON COLUMN users.name IS 'User display name';
