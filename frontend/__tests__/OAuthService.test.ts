/**
 * Unit tests for OAuthService
 * Requirements: 1.5, 5.1, 5.2, 5.3
 */

import { OAuthService } from '../services/OAuthService';
import { GoogleSignInResult, AppleAuthenticationCredential } from '../types/auth';

// Mock the external dependencies
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    getTokens: jest.fn(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: {
    FULL_NAME: 'FULL_NAME',
    EMAIL: 'EMAIL',
  },
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

describe('OAuthService', () => {
  let oauthService: OAuthService;

  beforeEach(() => {
    oauthService = new OAuthService();
    jest.clearAllMocks();
  });

  describe('extractProfileData', () => {
    it('should extract Google profile data', () => {
      const googleResponse: GoogleSignInResult = {
        type: 'success',
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        user: {
          id: 'google-user-id',
          name: 'John Doe',
          givenName: 'John',
          familyName: 'Doe',
          email: 'john.doe@example.com',
          photoUrl: 'https://example.com/photo.jpg',
        },
      };

      const profile = oauthService.extractProfileData(googleResponse);

      expect(profile.id).toBe('google-user-id');
      expect(profile.displayName).toBe('John Doe');
      expect(profile.email).toBe('john.doe@example.com');
      expect(profile.providerType).toBe('google');
      expect(profile.firstName).toBe('John');
      expect(profile.lastName).toBe('Doe');
      expect(profile.avatarUrl).toBe('https://example.com/photo.jpg');
    });

    it('should extract Apple profile data', () => {
      const appleResponse: AppleAuthenticationCredential = {
        user: 'apple-user-id',
        email: 'jane.smith@example.com',
        fullName: {
          givenName: 'Jane',
          familyName: 'Smith',
          middleName: null,
          namePrefix: null,
          nameSuffix: null,
          nickname: null,
        },
        identityToken: 'test-identity-token',
        authorizationCode: 'test-auth-code',
        realUserStatus: 1,
        state: null,
      };

      const profile = oauthService.extractProfileData(appleResponse);

      expect(profile.id).toBe('apple-user-id');
      expect(profile.displayName).toBe('Jane Smith');
      expect(profile.email).toBe('jane.smith@example.com');
      expect(profile.providerType).toBe('apple');
      expect(profile.firstName).toBe('Jane');
      expect(profile.lastName).toBe('Smith');
      expect(profile.avatarUrl).toBeUndefined();
    });

    it('should throw error for unsupported OAuth response format', () => {
      const invalidResponse = { invalid: 'data' };

      expect(() => {
        oauthService.extractProfileData(invalidResponse);
      }).toThrow('Unsupported OAuth response format');
    });
  });

  describe('timeout handling', () => {
    it('should handle timeout configuration', () => {
      const customConfig = { timeout: 5000, maxRetries: 2, retryDelay: 500 };
      const customService = new OAuthService(customConfig);
      
      // Test that service is created with custom config
      expect(customService).toBeInstanceOf(OAuthService);
    });
  });

  describe('error handling', () => {
    it('should create standardized auth errors', () => {
      const service = new OAuthService();
      
      // Access private method through type assertion for testing
      const createAuthError = (service as any).createAuthError;
      const error = createAuthError('TEST_ERROR', 'Test message', { original: 'error' });
      
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.details).toEqual({ original: 'error' });
    });

    it('should identify non-retryable errors', () => {
      const service = new OAuthService();
      
      // Access private method through type assertion for testing
      const isNonRetryableError = (service as any).isNonRetryableError;
      
      expect(isNonRetryableError({ message: 'User cancelled' })).toBe(true);
      expect(isNonRetryableError({ message: 'not available' })).toBe(true);
      expect(isNonRetryableError({ message: 'configuration error' })).toBe(true);
      expect(isNonRetryableError({ message: 'network error' })).toBe(false);
    });
  });

  describe('privacy protection', () => {
    it('should log errors without sensitive data', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const service = new OAuthService();
      
      // Access private method through type assertion for testing
      const logError = (service as any).logError;
      
      const sensitiveError = {
        message: 'Auth failed',
        email: 'user@example.com',
        token: 'secret-token',
        code: 'AUTH_ERROR',
      };
      
      logError('Test error', sensitiveError);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[OAuthService] Test error:',
        {
          message: 'Auth failed',
          code: 'AUTH_ERROR',
        }
      );
      
      // Verify sensitive data is not logged
      const loggedData = consoleSpy.mock.calls[0][1];
      expect(loggedData).not.toHaveProperty('email');
      expect(loggedData).not.toHaveProperty('token');
      
      consoleSpy.mockRestore();
    });
  });
});