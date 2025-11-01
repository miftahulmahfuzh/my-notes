module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  modulePaths: ['<rootDir>/src', '<rootDir>/node_modules'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
  },
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        target: 'ES2020',
        module: 'ESNext',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        baseUrl: './src',
        paths: {
          '@/*': ['*'],
          '@/types/*': ['types/*'],
        },
      },
    },
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: [
    '<rootDir>/tests/ts-basic-*.test.ts'
  ],
};