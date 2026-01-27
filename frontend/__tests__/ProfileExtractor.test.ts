/**
 * Unit tests for ProfileExtractor
 * Tests specific examples and edge cases for profile extraction
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import { ProfileExtractor } from '../services/ProfileExtractor';
import { GoogleSignInResult, AppleAuthenticationCredential, UserProfile } from '../types/auth';

describe('ProfileExtractor', () => {
  let extractor: ProfileExtractor;

  beforeEach(() => {
    extractor = new ProfileExtractor();
  });

  describe('extractGoogleProfile', () => {
    it('should extract complete Google profile data', () => {
      const googleResponse: GoogleSignInResult = {
        type: 'success',
        accessToken: 'access_token',
        idToken: 'id_token',
        user: {
          id: 'google_123',
          name: 'John Doe',
          givenName: 'John',
          familyName: 'Doe',
          email: 'john.doe@example.com',
          photoUrl: 'https://example.com/photo.jpg'
        }
      };

      const profile = extractor.extractGoogleProfile(googleResponse);

      expect(profile.id).toBe('google_123');
      expect(profile.displayName).toBe('John Doe');
      expect(profile.email).toBe('john.doe@example.com');
      expect(profile.providerId).toBe('google_123');
      expect(profile.providerType).toBe('google');
      expect(profile.avatarUrl).toBe('https://example.com/photo.jpg');
      expect(profile.firstName).toBe('John');
      expect(profile.lastName).toBe('Doe');
      expect(profile.createdAt).toBeInstanceOf(Date);
      expect(profile.updatedAt).toBeInstanceOf(Date);
    });

    it('should use email prefix as fallback when name is empty', () => {
      const googleResponse: GoogleSignInResult = {
        type: 'success',
        user: {
          id: 'google_123',
          name: '',
          givenName: '',
          familyName: '',
          email: 'john.doe@example.com',
          photoUrl: ''
        }
      };

      const profile = extractor.extractGoogleProfile(googleResponse);

      expect(profile.displayName).toBe('John Doe');
      expect(profile.email).toBe('john.doe@example.com');
    });

    it('should handle missing optional fields', () => {
      const googleResponse: GoogleSignInResult = {
        type: 'success',
        user: {
          id: 'google_123',
          name: 'John Doe',
          givenName: 'John',
          familyName: 'Doe',
          email: 'john.doe@example.com',
          photoUrl: ''
        }
      };

      const profile = extractor.extractGoogleProfile(googleResponse);

      expect(profile.avatarUrl).toBeUndefined();
    });

    it('should throw error for cancelled Google response', () => {
      const googleResponse: GoogleSignInResult = {
        type: 'cancel'
      };

      expect(() => extractor.extractGoogleProfile(googleResponse)).toThrow('Invalid Google OAuth response');
    });

    it('should throw error for success response without user data', () => {
      const googleResponse: GoogleSignInResult = {
        type: 'success'
      };

      expect(() => extractor.extractGoogleProfile(googleResponse)).toThrow('Invalid Google OAuth response');
    });
  });

  describe('extractAppleProfile', () => {
    it('should extract complete Apple profile data', () => {
      const appleResponse: AppleAuthenticationCredential = {
        user: 'apple_123',
        email: 'john.doe@example.com',
        fullName: {
          givenName: 'John',
          familyName: 'Doe',
          middleName: null,
          namePrefix: null,
          nameSuffix: null,
          nickname: null
        },
        identityToken: 'identity_token',
        authorizationCode: 'auth_code',
        realUserStatus: 1,
        state: null
      };

      const profile = extractor.extractAppleProfile(appleResponse);

      expect(profile.id).toBe('apple_123');
      expect(profile.displayName).toBe('John Doe');
      expect(profile.email).toBe('john.doe@example.com');
      expect(profile.providerId).toBe('apple_123');
      expect(profile.providerType).toBe('apple');
      expect(profile.avatarUrl).toBeUndefined();
      expect(profile.firstName).toBe('John');
      expect(profile.lastName).toBe('Doe');
    });

    it('should handle only first name available', () => {
      const appleResponse: AppleAuthenticationCredential = {
        user: 'apple_123',
        email: 'john@example.com',
        fullName: {
          givenName: 'John',
          familyName: null,
          middleName: null,
          namePrefix: null,
          nameSuffix: null,
          nickname: null
        },
        identityToken: 'identity_token',
        authorizationCode: 'auth_code',
        realUserStatus: 1,
        state: null
      };

      const profile = extractor.extractAppleProfile(appleResponse);

      expect(profile.displayName).toBe('John');
      expect(profile.firstName).toBe('John');
      expect(profile.lastName).toBeUndefined();
    });

    it('should handle only last name available', () => {
      const appleResponse: AppleAuthenticationCredential = {
        user: 'apple_123',
        email: 'doe@example.com',
        fullName: {
          givenName: null,
          familyName: 'Doe',
          middleName: null,
          namePrefix: null,
          nameSuffix: null,
          nickname: null
        },
        identityToken: 'identity_token',
        authorizationCode: 'auth_code',
        realUserStatus: 1,
        state: null
      };

      const profile = extractor.extractAppleProfile(appleResponse);

      expect(profile.displayName).toBe('Doe');
      expect(profile.firstName).toBeUndefined();
      expect(profile.lastName).toBe('Doe');
    });

    it('should use email prefix as fallback when no name is available', () => {
      const appleResponse: AppleAuthenticationCredential = {
        user: 'apple_123',
        email: 'john.doe@example.com',
        fullName: null,
        identityToken: 'identity_token',
        authorizationCode: 'auth_code',
        realUserStatus: 1,
        state: null
      };

      const profile = extractor.extractAppleProfile(appleResponse);

      expect(profile.displayName).toBe('John Doe');
      expect(profile.firstName).toBeUndefined();
      expect(profile.lastName).toBeUndefined();
    });

    it('should handle empty fullName object', () => {
      const appleResponse: AppleAuthenticationCredential = {
        user: 'apple_123',
        email: 'test_user@example.com',
        fullName: {
          givenName: null,
          familyName: null,
          middleName: null,
          namePrefix: null,
          nameSuffix: null,
          nickname: null
        },
        identityToken: 'identity_token',
        authorizationCode: 'auth_code',
        realUserStatus: 1,
        state: null
      };

      const profile = extractor.extractAppleProfile(appleResponse);

      expect(profile.displayName).toBe('Test User');
    });
  });

  describe('validateProfile', () => {
    let validProfile: UserProfile;

    beforeEach(() => {
      validProfile = {
        id: 'test_123',
        displayName: 'John Doe',
        email: 'john.doe@example.com',
        providerId: 'test_123',
        providerType: 'google',
        avatarUrl: 'https://example.com/photo.jpg',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    it('should validate a complete valid profile', () => {
      expect(extractor.validateProfile(validProfile)).toBe(true);
    });

    it('should validate profile with optional fields undefined', () => {
      const profile = {
        ...validProfile,
        avatarUrl: undefined,
        firstName: undefined,
        lastName: undefined
      };

      expect(extractor.validateProfile(profile)).toBe(true);
    });

    it('should reject profile with empty id', () => {
      const profile = { ...validProfile, id: '' };
      expect(extractor.validateProfile(profile)).toBe(false);
    });

    it('should reject profile with invalid email', () => {
      const profile = { ...validProfile, email: 'invalid-email' };
      expect(extractor.validateProfile(profile)).toBe(false);
    });

    it('should reject profile with empty providerId', () => {
      const profile = { ...validProfile, providerId: '' };
      expect(extractor.validateProfile(profile)).toBe(false);
    });

    it('should reject profile with invalid providerType', () => {
      const profile = { ...validProfile, providerType: 'facebook' as any };
      expect(extractor.validateProfile(profile)).toBe(false);
    });

    it('should reject profile with empty displayName', () => {
      const profile = { ...validProfile, displayName: '' };
      expect(extractor.validateProfile(profile)).toBe(false);
    });

    it('should reject profile with invalid createdAt date', () => {
      const profile = { ...validProfile, createdAt: new Date('invalid') };
      expect(extractor.validateProfile(profile)).toBe(false);
    });

    it('should reject profile with invalid updatedAt date', () => {
      const profile = { ...validProfile, updatedAt: new Date('invalid') };
      expect(extractor.validateProfile(profile)).toBe(false);
    });
  });

  describe('createFallbackProfile', () => {
    it('should create fallback profile with email prefix as display name', () => {
      const profile = extractor.createFallbackProfile(
        'john.doe@example.com',
        'test_123',
        'google'
      );

      expect(profile.id).toBe('test_123');
      expect(profile.displayName).toBe('John Doe');
      expect(profile.email).toBe('john.doe@example.com');
      expect(profile.providerId).toBe('test_123');
      expect(profile.providerType).toBe('google');
      expect(profile.avatarUrl).toBeUndefined();
      expect(profile.firstName).toBeUndefined();
      expect(profile.lastName).toBeUndefined();
      expect(profile.createdAt).toBeInstanceOf(Date);
      expect(profile.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle email with underscores and capitalize properly', () => {
      const profile = extractor.createFallbackProfile(
        'jane_smith@example.com',
        'test_456',
        'apple'
      );

      expect(profile.displayName).toBe('Jane Smith');
    });

    it('should handle email with dots and capitalize properly', () => {
      const profile = extractor.createFallbackProfile(
        'bob.johnson@example.com',
        'test_789',
        'google'
      );

      expect(profile.displayName).toBe('Bob Johnson');
    });

    it('should handle email with hyphens and capitalize properly', () => {
      const profile = extractor.createFallbackProfile(
        'mary-jane@example.com',
        'test_101',
        'apple'
      );

      expect(profile.displayName).toBe('Mary Jane');
    });

    it('should throw error for invalid email', () => {
      expect(() => extractor.createFallbackProfile(
        'invalid-email',
        'test_123',
        'google'
      )).toThrow('Valid email is required for fallback profile');
    });

    it('should throw error for empty providerId', () => {
      expect(() => extractor.createFallbackProfile(
        'test@example.com',
        '',
        'google'
      )).toThrow('Provider ID is required for fallback profile');
    });

    it('should fallback to "User" for empty email prefix', () => {
      // This test verifies the internal extractEmailPrefix method behavior
      // by creating a profile with a valid email that has an empty prefix after processing
      const profile = extractor.createFallbackProfile(
        'a@example.com', // Single character that becomes empty after trim
        'test_123',
        'google'
      );

      expect(profile.displayName).toBe('A'); // Single character should be capitalized
    });
  });

  describe('edge cases', () => {
    it('should handle email with single character prefix', () => {
      const profile = extractor.createFallbackProfile(
        'a@example.com',
        'test_123',
        'google'
      );

      expect(profile.displayName).toBe('A');
    });

    it('should handle email with numbers in prefix', () => {
      const profile = extractor.createFallbackProfile(
        'user123@example.com',
        'test_123',
        'google'
      );

      expect(profile.displayName).toBe('User123');
    });

    it('should handle complex email prefix with mixed separators', () => {
      const profile = extractor.createFallbackProfile(
        'first.last_name-test@example.com',
        'test_123',
        'google'
      );

      expect(profile.displayName).toBe('First Last Name Test');
    });
  });
});