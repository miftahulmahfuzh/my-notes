# Frontend GitHub CI/CD Guide

**Last Updated:** 2026-01-29

**Related Files:**
- `.github/workflows/ci.yml` - GitHub Actions workflow configuration
- `extension/jest.config.js` - Jest test configuration
- `extension/package.json` - NPM dependencies and scripts
- `extension/babel.config.js` - Babel transpilation configuration

---

## Table of Contents

1. [Overview](#overview)
2. [Current CI/CD Setup](#current-cicd-setup)
3. [Working Patterns](#working-patterns)
4. [Adding New Test Cases](#adding-new-test-cases)
5. [Best Practices](#best-practices)
6. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This guide explains how to incrementally add frontend test cases to the GitHub Actions CI/CD pipeline. The frontend tests use **Jest** with **jsdom** environment for React component testing in the Chrome Extension codebase.

### Key Principles

1. **Incremental Approach**: Add tests one at a time, verify each passes before adding more
2. **Isolation**: Each test file should be runnable independently
3. **CI-First**: Ensure tests pass in CI environment, not just locally
4. **Dependency Management**: All Babel presets and dependencies must be explicitly declared

---

## Current CI/CD Setup

### GitHub Actions Workflow Location
`.github/workflows/ci.yml`

### Current Jobs

| Job Name | Purpose | Runtime |
|----------|---------|---------|
| `backend-test` | Runs Go backend tests | Go 1.24.4 on ubuntu-latest |
| `frontend-test` | Runs frontend Jest tests | Node.js 20.x on ubuntu-latest |

### Workflow Triggers

```yaml
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
```

**Note:** The workflow runs on push to `main` or `develop` branches, and on PRs to `main`.

---

## Working Patterns

### Pattern 1: Current Single Test Execution

**File:** `.github/workflows/ci.yml` (lines 43-45)

```yaml
- name: Run single frontend test
  working-directory: ./extension
  run: npx jest src/components/__tests__/iconRendering.test.tsx
```

**Characteristics:**
- Runs ONE specific test file
- Uses full path from extension directory
- Fails fast if that single test fails
- Easy to debug when issues arise

**When to use:**
- Initial CI setup (current state)
- Debugging a specific failing test
- Verifying a new test works before adding more

---

### Pattern 2: Running Multiple Specific Tests

**Future pattern** (not yet implemented):

```yaml
- name: Run multiple frontend tests
  working-directory: ./extension
  run: |
    npx jest src/components/__tests__/iconRendering.test.tsx
    npx jest tests/components/LoginForm.test.tsx
    npx jest tests/components/NoteEditor.test.tsx
```

**When to use:**
- Incrementally adding validated tests
- Grouping related tests together
- Maintaining control over test execution order

---

### Pattern 3: Running All Tests (Eventual Goal)

**Future pattern** (after all tests are CI-validated):

```yaml
- name: Run all frontend tests
  working-directory: ./extension
  run: npx jest --config=jest.config.js
```

**When to use:**
- All tests have been validated in CI
- Full regression testing is desired
- Test suite is stable and reliable

**Alternatively**, using the existing test script:

```yaml
- name: Run all frontend tests
  working-directory: ./extension
  run: npm test
```

---

## Running Tests from Different Directories

### From Project Root

When running tests from the project root, you **must specify the jest config path**:

```bash
# From project root (/my-notes)
npx jest --config=extension/jest.config.js tests/utils/config.test.ts
```

**Why:** Jest won't find `extension/jest.config.js` from the project root. Without `--config`, you'll get errors like:
```
SyntaxError: Cannot use import statement outside a module
```
or
```
Support for the experimental syntax 'jsx' isn't currently enabled
```

These errors occur because Jest isn't loading the ts-jest transform and Babel presets from the config.

---

### From Extension Directory

When running from within the `extension/` directory, Jest finds the config automatically:

```bash
# From extension directory
cd extension
npx jest tests/utils/config.test.ts
```

**Why:** Jest searches for `jest.config.js` in the current directory, which it finds in `extension/`.

---

### In CI Environment

In GitHub Actions, with `working-directory: ./extension`, the config is found automatically:

```yaml
- name: Run frontend tests
  working-directory: ./extension
  run: npx jest tests/utils/config.test.ts
```

**Why:** The working directory is already `extension/`, so Jest finds the config file.

---

### Quick Reference

| Context | Command |
|---------|---------|
| Project root | `npx jest --config=extension/jest.config.js <test-path>` |
| Extension dir | `npx jest <test-path>` |
| CI (with working-directory) | `npx jest <test-path>` |

---

## Adding New Test Cases

### Step 1: Ensure Test Exists and Passes Locally

Before adding to CI, verify the test passes locally:

```bash
# From project root
cd extension
npm test -- path/to/test.test.tsx

# Example
npm test -- src/components/__tests__/iconRendering.test.tsx
```

**Why:** If a test doesn't pass locally, it won't pass in CI. Debug locally first.

---

### Step 2: Check Test File Location

Tests can be in two directories (per `jest.config.js`):

```
extension/
├── src/
│   └── **/__tests__/*.test.ts*    # Component tests near source
└── tests/
    ├── components/*.test.tsx      # Component tests (centralized)
    ├── api.test.ts                # API tests
    ├── auth.test.ts               # Auth tests
    └── ...
```

**Both locations work.** Choose based on your preference:
- `src/**/__tests__/` - Tests co-located with components
- `tests/` - Centralized test directory

---

### Step 3: Add Test to CI Workflow

**Option A: Replace Current Test (Incremental)**

Edit `.github/workflows/ci.yml`, line 45:

```yaml
# Before
run: npx jest src/components/__tests__/iconRendering.test.tsx

# After - add new test
run: |
  npx jest src/components/__tests__/iconRendering.test.tsx
  npx jest tests/components/LoginForm.test.tsx
```

**Option B: Create New Test Step**

Add a new step after the current test:

```yaml
- name: Run single frontend test
  working-directory: ./extension
  run: npx jest src/components/__tests__/iconRendering.test.tsx

- name: Run LoginForm test
  working-directory: ./extension
  run: npx jest tests/components/LoginForm.test.tsx
```

---

### Step 4: Commit and Push

```bash
git add .github/workflows/ci.yml
git commit -m "feat(ci): add LoginForm test to CI workflow"
git push
```

---

### Step 5: Verify on GitHub Actions

1. Navigate to: `https://github.com/YOUR_USERNAME/my-notes/actions`
2. Click on the latest workflow run
3. Verify the new test passes
4. Check test output for any warnings

**Green checkmark = Success!** Continue to next test.

**Red X = Failure:** Read the error message and debug locally.

---

## Best Practices

### 1. Dependency Declaration

**CRITICAL:** All Babel presets and plugins must be in `package.json`.

**Check `babel.config.js`:**
```javascript
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    ['@babel/preset-typescript'],  // <-- Must be in package.json!
  ],
};
```

**Verify corresponding entries in `extension/package.json`:**

```json
{
  "devDependencies": {
    "@babel/preset-env": "^7.28.6",
    "@babel/preset-react": "^7.28.5",
    "@babel/preset-typescript": "^7.28.5"  // <-- Must be present!
  }
}
```

**Lesson learned:** The preset-typescript was missing and caused CI failure.

---

### 2. Use `npm ci` in CI, Not `npm install`

**Current workflow (line 41):**
```yaml
- name: Install dependencies
  working-directory: ./extension
  run: npm ci
```

**Why:**
- `npm ci` installs from `package-lock.json` (faster, reproducible)
- `npm install` may update lock file (inconsistent across runs)
- CI environments should be deterministic

---

### 3. Use Absolute Paths for Tests

**Good:**
```yaml
run: npx jest src/components/__tests__/iconRendering.test.tsx
```

**Avoid:**
```yaml
run: npx jest iconRendering.test.tsx  # May not resolve correctly
```

**Why:** CI working directory context may differ from local. Use full paths from `extension/` directory.

---

### 4. Cache npm Dependencies

**Current workflow (lines 36-37):**
```yaml
cache: 'npm'
cache-dependency-path: extension/package-lock.json
```

**Why:**
- Speeds up CI builds (3-10x faster)
- Reduces npm registry load
- Cached dependencies are reused across runs

---

### 5. Test File Naming Convention

**Jest config pattern (lines 27-32):**
```javascript
testMatch: [
  '<rootDir>/tests/**/*.test.ts',
  '<rootDir>/tests/**/*.test.tsx',
  '<rootDir>/src/**/*.test.ts',
  '<rootDir>/src/**/*.test.tsx',
],
```

**Use `.test.ts` or `.test.tsx` suffix:**
- `LoginForm.test.tsx` - Component test
- `api.test.ts` - API utility test
- `auth.test.ts` - Auth service test

**Avoid:**
- `LoginForm.spec.tsx` - Won't be picked up
- `LoginForm.test.js` - Wrong extension
- `test-LoginForm.tsx` - Wrong pattern

---

### 6. Keep Tests Isolated

Each test file should:
- Run independently without side effects
- Not depend on other test files
- Clean up after itself (if using mocks)
- Be runnable in any order

---

## Common Pitfalls and Solutions

### Pitfall 1: Jest Config Not Being Loaded

**Error:**
```
SyntaxError: Cannot use import statement outside a module
```
or
```
Support for the experimental syntax 'jsx' isn't currently enabled
```
or
```
If you already added the plugin for this syntax to your config,
it's possible that your config isn't being loaded.
```

**Cause:** Running Jest from the project root without specifying the config file path. Jest doesn't find `extension/jest.config.js` and falls back to defaults without ts-jest transforms.

**Solution:** Always use `--config` when running from project root:
```bash
# Wrong (from project root)
npx jest tests/utils/config.test.ts

# Correct (from project root)
npx jest --config=extension/jest.config.js tests/utils/config.test.ts
```

**Important:** Running from within `extension/` directory can also fail with Babel parsing errors because ts-jest transform may not load correctly. Always use `--config` from project root to verify tests before adding to CI.

**Prevention:** Create an alias or script in your shell for running tests:
```bash
# Add to ~/.bashrc or ~/.zshrc
alias jest-test='npx jest --config=extension/jest.config.js'

# Usage
jest-test tests/utils/config.test.ts
```

---

### Pitfall 2: Missing Babel Preset

**Error:**
```
Cannot find module '@babel/preset-typescript'
Make sure that all the Babel plugins and presets you are using
are defined as dependencies or devDependencies in your package.json
```

**Cause:** `babel.config.js` references a preset not in `package.json`.

**Solution:**
1. Check `babel.config.js` for all referenced presets
2. Add missing preset to `extension/package.json`:
   ```bash
   npm install --save-dev @babel/preset-typescript
   ```
3. Commit both `package.json` and `package-lock.json`

**Prevention:** After modifying `babel.config.js`, always run `npm install` and verify `package.json` has all referenced presets.

---

### Pitfall 3: ESM Import Issues

**Error:**
```
SyntaxError: Cannot use import statement outside a module
```

**Cause:** Using ESM imports in a test file that Jest treats as CommonJS.

**Solution:** Ensure Jest is configured to transform the file:
```javascript
// jest.config.js
transform: {
  '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
},
```

**Known Issue:** `MarkdownPreview.test.tsx` is skipped due to ESM issues with `react-markdown` dependencies. See `jest.config.js` line 36.

---

### Pitfall 4: CSS Module Imports

**Error:**
```
SyntaxError: Unexpected token '.'
```

**Cause:** Test imports a CSS file that Jest doesn't know how to handle.

**Solution:** Jest config already handles this (lines 9-10):
```javascript
moduleNameMapper: {
  '^.+\\.css$': '<rootDir>/tests/__mocks__/styleMock.js',
  '^.+\\.(css|less|scss|sass)$': 'identity-obj-proxy',
},
```

If you see this error, verify your CSS file path matches these patterns.

---

### Pitfall 5: Chrome Extension APIs Not Defined

**Error:**
```
ReferenceError: chrome is not defined
```

**Cause:** Test runs in jsdom environment without Chrome extension APIs.

**Solution:** Mock Chrome APIs in your test setup file:
```typescript
// tests/setup.ts
global.chrome = {
  runtime: {
    getManifest: jest.fn(() => ({ version: '1.0.0' })),
    sendMessage: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
};
```

---

### Pitfall 6: Path Alias Not Resolved

**Error:**
```
Cannot find module '@/components/...'
```

**Cause:** Using path alias (`@/`) without proper Jest configuration.

**Solution:** Jest config handles this (line 7):
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@types/(.*)$': '<rootDir>/src/types/$1',
  // ...
},
```

If still failing, check your `tsconfig.json` has matching path aliases.

---

### Pitfall 7: Test Timeout in CI

**Error:**
```
Timeout - Async callback was not invoked within the 5000ms timeout
```

**Cause:** Test takes longer in CI than locally (slower CI environment).

**Solution:** Increase timeout for specific test:
```typescript
it('loads data slowly', async () => {
  // ... test code
}, 10000); // 10 second timeout
```

Or globally in Jest config:
```javascript
jest.setTimeout(10000);
```

---

### Pitfall 8: Flaky Tests (Interrittent Failures)

**Symptoms:** Test passes sometimes, fails other times in CI.

**Common Causes:**
- Race conditions (async operations not properly awaited)
- Dependency on external state (time, random values, API calls)
- Improper cleanup (shared state between tests)

**Solutions:**
1. Use `waitFor` for async operations:
   ```typescript
   await waitFor(() => {
     expect(screen.getByText('Loaded')).toBeInTheDocument();
   });
   ```
2. Mock external dependencies (APIs, timers)
3. Clean up in `afterEach` blocks:
   ```typescript
   afterEach(() => {
     jest.clearAllMocks();
   });
   ```

---

## Troubleshooting

### Debugging Failed CI Tests

**1. Check the GitHub Actions log**

Navigate to: `Actions` → Click failed run → Click failed step → Expand log

**2. Reproduce locally with same command**

Copy the exact command from CI and run locally:
```bash
cd extension
npx jest src/components/__tests__/YOUR_TEST.test.tsx
```

**3. Run with verbose output**

```bash
npx jest src/components/__tests__/YOUR_TEST.test.tsx --verbose
```

**4. Clear Jest cache**

Sometimes stale cache causes issues:
```bash
cd extension
npx jest --clearCache
npm test -- path/to/test.test.tsx
```

---

### Test Passes Locally But Fails in CI

**Common causes:**

| Cause | Symptom | Fix |
|-------|---------|-----|
| Node version mismatch | Version-specific syntax | Use same Node version locally: `nvm use 20` |
| Environment variables | Undefined config | Add env vars to CI workflow or test mocks |
- Time-dependent tests | Different time zones | Mock `Date.now()` or use fixed test data
- File paths | File not found in CI | Use relative paths from extension directory

**Check CI Node version:**
```yaml
# .github/workflows/ci.yml
node-version: '20.x'  # Match this locally
```

---

### All Tests Pass But CI Shows Red

**Check:**
1. Did ALL jobs pass? (Backend + Frontend)
2. Did the push complete successfully?
3. Are there any lint or type-check steps failing?

**View full workflow status:**
- GitHub Actions → Click workflow run → See all jobs

---

## Quick Reference

### Add a New Test to CI

1. Write test locally and verify it passes
2. Add test path to `.github/workflows/ci.yml`
3. Commit and push
4. Verify on GitHub Actions

### Example: Adding `NoteEditor.test.tsx`

**Before:**
```yaml
- name: Run single frontend test
  working-directory: ./extension
  run: npx jest src/components/__tests__/iconRendering.test.tsx
```

**After:**
```yaml
- name: Run single frontend test
  working-directory: ./extension
  run: |
    npx jest src/components/__tests__/iconRendering.test.tsx
    npx jest tests/components/NoteEditor.test.tsx
```

---

## Related Documentation

- [Jest Configuration](../extension/jest.config.js) - Full Jest config with comments
- [CI Workflow](../.github/workflows/ci.yml) - Current GitHub Actions setup
- [Test Instructions](TEST_INSTRUCTIONS.md) - General testing guidelines
- [Development Guide](development.md) - Local development setup

---

## Summary

**Key Takeaways:**

1. Start with one test, verify it passes, then add more
2. Always check that Babel presets are in `package.json`
3. Use `npm ci` in CI for reproducible builds
4. Debug locally using the same command that CI runs
5. Check GitHub Actions logs for detailed error messages

**Incremental Progress:**
- Current: 10 tests in CI (`iconRendering.test.tsx`, `LoginForm.test.tsx`, `NoteEditor.test.tsx`, `config.test.ts`, `contentUtils.test.ts`, `markdown.test.ts`, `auth.test.ts`, `api.test.ts`, `PopupApp.test.tsx`, `background/index.test.ts`)
- Next: Add more validated tests incrementally
- Goal: All validated tests running in CI

**Remember:** CI is the source of truth. If tests pass locally but fail in CI, there's an environment difference that needs to be addressed.
