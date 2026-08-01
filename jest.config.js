module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts', // Exclude main entry point
  ],
  moduleNameMapper: {
    'obsidian': '<rootDir>/test/mocks/obsidian-mock.ts'
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: './tsconfig.test.json',
    }],
  },
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts']
};
