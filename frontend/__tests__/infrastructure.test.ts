/**
 * Infrastructure setup verification tests
 * Ensures that all dependencies and configurations are working correctly
 * Requirements: 1.1, 1.2, 6.1
 */

import fc from 'fast-check';
import { userProfileGen, emailGen } from './generators/auth.generators';
import { UserProfile, OAuthProviderType } from '../types/auth';

describe('Infrastructure Setup', () => {
  describe('TypeScript Interfaces', () => {
    it('should have proper UserProfile interface', () => {
      const profile: UserProfile = {
        id: 'test-id',
        displayName: 'Test User',
        email: 'test@example.com',
        providerId: 'provider-123',
        providerType: 'google' as OAuthProviderType,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(profile.id).toBe('test-id');
      expect(profile.displayName).toBe('Test User');
      expect(profile.email).toBe('test@example.com');
      expect(profile.providerType).toBe('google');
    });

    it('should support optional fields in UserProfile', () => {
      const profile: UserProfile = {
        id: 'test-id',
        displayName: 'Test User',
        email: 'test@example.com',
        providerId: 'provider-123',
        providerType: 'apple' as OAuthProviderType,
        avatarUrl: 'https://example.com/avatar.jpg',
        firstName: 'Test',
        lastName: 'User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(profile.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(profile.firstName).toBe('Test');
      expect(profile.lastName).toBe('User');
    });
  });

  describe('Fast-check Property Testing Setup', () => {
    it('Property: should generate valid user profiles', () => {
      fc.assert(
        fc.property(userProfileGen(), (profile) => {
          // Validate that generated profiles have required fields
          expect(typeof profile.id).toBe('string');
          expect(profile.id.length).toBeGreaterThan(0);
          expect(typeof profile.displayName).toBe('string');
          expect(profile.displayName.length).toBeGreaterThan(0);
          expect(typeof profile.email).toBe('string');
          expect(profile.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
          expect(['google', 'apple']).toContain(profile.providerType);
          expect(profile.createdAt).toBeInstanceOf(Date);
          expect(profile.updatedAt).toBeInstanceOf(Date);
        }),
        { numRuns: 50 } // Reduced for infrastructure test
      );
    });

    it('Property: should generate valid email addresses', () => {
      fc.assert(
        fc.property(emailGen(), (email) => {
          expect(typeof email).toBe('string');
          expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Mock Setup', () => {
    it('should have AsyncStorage mocked', () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      expect(AsyncStorage.getItem).toBeDefined();
      expect(AsyncStorage.setItem).toBeDefined();
      expect(AsyncStorage.removeItem).toBeDefined();
    });

    it('should have SecureStore mocked', () => {
      const SecureStore = require('expo-secure-store');
      expect(SecureStore.getItemAsync).toBeDefined();
      expect(SecureStore.setItemAsync).toBeDefined();
      expect(SecureStore.deleteItemAsync).toBeDefined();
    });

    it('should have Google Sign In mocked', () => {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      expect(GoogleSignin.configure).toBeDefined();
      expect(GoogleSignin.signIn).toBeDefined();
      expect(GoogleSignin.signOut).toBeDefined();
    });

    it('should have Apple Authentication mocked', () => {
      const AppleAuthentication = require('expo-apple-authentication');
      expect(AppleAuthentication.signInAsync).toBeDefined();
      expect(AppleAuthentication.isAvailableAsync).toBeDefined();
    });
  });

  describe('Dependencies', () => {
    it('should have fast-check available', () => {
      expect(fc).toBeDefined();
      expect(fc.assert).toBeDefined();
      expect(fc.property).toBeDefined();
    });

    it('should have required OAuth libraries available', () => {
      // These should not throw when required
      expect(() => require('@react-native-google-signin/google-signin')).not.toThrow();
      expect(() => require('expo-apple-authentication')).not.toThrow();
      expect(() => require('expo-secure-store')).not.toThrow();
      expect(() => require('@react-native-async-storage/async-storage')).not.toThrow();
    });
  });
});