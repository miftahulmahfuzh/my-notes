-- Rollback: Restore name column

-- Step 1: Add NOT NULL constraint back
ALTER TABLE users ALTER COLUMN name_deprecated SET NOT NULL;

-- Step 2: Rename back to name
ALTER TABLE users RENAME COLUMN name_deprecated TO name;

-- Step 3: Restore comment
COMMENT ON COLUMN users.name IS 'User display name';
