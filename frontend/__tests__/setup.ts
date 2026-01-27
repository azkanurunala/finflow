/**
 * Test setup configuration for Social Auth Profile Fix
 * Configures fast-check for property-based testing
 * Requirements: 6.1
 */

import fc from 'fast-check';

// Configure fast-check global settings
fc.configureGlobal({
  // Minimum number of iterations for property tests
  numRuns: 100,
  // Enable verbose mode for debugging
  verbose: false,
  // Seed for reproducible tests (can be overridden per test)
  seed: 42,
  // Maximum shrinking iterations
  maxSkipsPerRun: 100,
});

// Mock AsyncStorage for testing
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock SecureStore for testing
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
}));

// Mock Google Sign In
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(),
    signOut: jest.fn(),
    isSignedIn: jest.fn(),
    getCurrentUser: jest.fn(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

// Mock Apple Authentication
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  AppleAuthenticationScope: {
    FULL_NAME: 0,
    EMAIL: 1,
  },
  AppleAuthenticationUserDetectionStatus: {
    UNSUPPORTED: 0,
    UNKNOWN: 1,
    LIKELY_REAL: 2,
  },
}));

// Mock NetInfo for network connectivity
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
  addEventListener: jest.fn(() => jest.fn()),
  useNetInfo: jest.fn(() => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock React Native components
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  Alert: {
    alert: jest.fn(),
  },
}));

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup test timeout
jest.setTimeout(10000);