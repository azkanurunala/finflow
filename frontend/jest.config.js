/**
 * Jest configuration for Social Auth Profile Fix
 * Configures testing environment for React Native with property-based testing
 */

module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testMatch: [
    '**/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)',
    '**/*.(test|spec).(ts|tsx|js|jsx)'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/__tests__/setup.ts',
    '<rootDir>/__tests__/generators/'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'contexts/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  transform: {
    '^.+\\.(ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(expo|@expo|expo-apple-authentication|@react-native-google-signin|react-native|@react-native|@react-native-community)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
  },
  testEnvironment: 'node',
  // Increase timeout for property-based tests
  testTimeout: 15000,
};