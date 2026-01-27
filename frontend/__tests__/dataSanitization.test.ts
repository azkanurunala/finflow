/**
 * Unit tests for Data Sanitization Utilities
 * Requirements: 5.4, 5.5
 */

import { 
  DataSanitizationUtils, 
  dataSanitizationUtils,
  SanitizationConfig,
  ValidationResult,
  SanitizationResult,
  SafeErrorInfo
} from '../utils/dataSanitization';
import { UserProfile, OAuthProviderType } from '../types/auth';

describe('DataSanitizationUtils', () => {
  let sanitizer: DataSanitizationUtils;

  beforeEach(() => {
    sanitizer = new DataSanitizationUtils();
  });

  describe('sanitizeProfileData', () => {
    it('should sanitize malformed string data', () => {
      const malformedProfile: Partial<UserProfile> = {
        id: 'user123',
        displayName: 'John\x00Doe<script>alert("xss")</script>',
        email: 'john@example.com\x01',
        firstName: 'John\x0B',
        lastName: 'Doe\x7F',
      };

      const result: SanitizationResult = sanitizer.sanitizeProfileData(malformedProfile);

      expect(result.wasModified).toBe(true);
      expect(result.sanitizedProfile.displayName).toBe('JohnDoe'); // Script tags removed
      expect(result.sanitizedProfile.email).toBe('john@example.com');
      expect(result.sanitizedProfile.firstName).toBe('John');
      expect(result.sanitizedProfile.lastName).toBe('Doe');
      expect(result.modifications).toContain('displayName: cleaned malformed content');
    });

    it('should handle XSS attempts in profile data', () => {
      const xssProfile: Partial<UserProfile> = {
        displayName: '<script>alert("hack")</script>User Name',
        email: 'user@example.com',
        firstName: 'javascript:alert("xss")',
        lastName: 'onclick=alert("click") Name',
      };

      const result = sanitizer.sanitizeProfileData(xssProfile);

      expect(result.wasModified).toBe(true);
      expect(result.sanitizedProfile.displayName).toBe('User Name'); // Script tags removed
      expect(result.sanitizedProfile.firstName).toBe('alert("xss")'); // javascript: removed
      expect(result.sanitizedProfile.lastName).toBe('alert("click") Name'); // onclick= removed but content remains
    });

    it('should enforce maximum string length', () => {
      const config: Partial<SanitizationConfig> = { maxStringLength: 10 };
      const customSanitizer = new DataSanitizationUtils(config);
      
      const longProfile: Partial<UserProfile> = {
        displayName: 'This is a very long display name that exceeds the limit',
        email: 'user@example.com',
      };

      const result = customSanitizer.sanitizeProfileData(longProfile);

      expect(result.wasModified).toBe(true);
      expect(result.sanitizedProfile.displayName).toBe('This is a');
      expect(result.sanitizedProfile.displayName?.length).toBeLessThanOrEqual(10);
    });

    it('should sanitize invalid provider types', () => {
      const invalidProfile: Partial<UserProfile> = {
        providerType: 'facebook' as OAuthProviderType, // Invalid provider
      };

      const result = sanitizer.sanitizeProfileData(invalidProfile);

      expect(result.wasModified).toBe(true);
      expect(result.sanitizedProfile.providerType).toBeUndefined();
      expect(result.modifications).toContain('providerType: normalized to valid value');
    });

    it('should sanitize invalid dates', () => {
      const invalidProfile: Partial<UserProfile> = {
        createdAt: new Date('invalid-date'),
        updatedAt: new Date('1999-01-01'), // Too old
      };

      const result = sanitizer.sanitizeProfileData(invalidProfile);

      expect(result.wasModified).toBe(true);
      expect(result.sanitizedProfile.createdAt).toBeUndefined();
      expect(result.sanitizedProfile.updatedAt).toBeUndefined();
      expect(result.modifications).toContain('createdAt: fixed invalid date');
      expect(result.modifications).toContain('updatedAt: fixed invalid date');
    });

    it('should not modify valid profile data', () => {
      const validProfile: Partial<UserProfile> = {
        id: 'user123',
        displayName: 'John Doe',
        email: 'john@example.com',
        providerId: 'google123',
        providerType: 'google',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = sanitizer.sanitizeProfileData(validProfile);

      expect(result.wasModified).toBe(false);
      expect(result.modifications).toHaveLength(0);
      expect(result.sanitizedProfile).toEqual(validProfile);
    });
  });

  describe('validateRequiredFields', () => {
    it('should validate complete profile successfully', () => {
      const validProfile: Partial<UserProfile> = {
        id: 'user123',
        displayName: 'John Doe',
        email: 'john@example.com',
        providerId: 'google123',
        providerType: 'google',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result: ValidationResult = sanitizer.validateRequiredFields(validProfile);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const incompleteProfile: Partial<UserProfile> = {
        displayName: 'John Doe',
        // Missing id, email, providerId, providerType
      };

      const result = sanitizer.validateRequiredFields(incompleteProfile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(4); // id, email, providerId, providerType
      expect(result.errors.some(e => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
    });

    it('should detect empty required fields', () => {
      const emptyProfile: Partial<UserProfile> = {
        id: '',
        displayName: '   ',
        email: '',
        providerId: '',
        providerType: 'google',
      };

      const result = sanitizer.validateRequiredFields(emptyProfile);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'EMPTY_REQUIRED_FIELD')).toBe(true);
    });

    it('should validate email format', () => {
      const invalidEmailProfile: Partial<UserProfile> = {
        id: 'user123',
        displayName: 'John Doe',
        email: 'invalid-email',
        providerId: 'google123',
        providerType: 'google',
      };

      const result = sanitizer.validateRequiredFields(invalidEmailProfile);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_EMAIL_FORMAT')).toBe(true);
    });

    it('should validate provider type', () => {
      const invalidProviderProfile: Partial<UserProfile> = {
        id: 'user123',
        displayName: 'John Doe',
        email: 'john@example.com',
        providerId: 'facebook123',
        providerType: 'facebook' as OAuthProviderType,
      };

      const result = sanitizer.validateRequiredFields(invalidProviderProfile);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_PROVIDER_TYPE')).toBe(true);
    });

    it('should validate date fields', () => {
      const invalidDateProfile: Partial<UserProfile> = {
        id: 'user123',
        displayName: 'John Doe',
        email: 'john@example.com',
        providerId: 'google123',
        providerType: 'google',
        createdAt: new Date('invalid'),
        updatedAt: 'not-a-date' as any,
      };

      const result = sanitizer.validateRequiredFields(invalidDateProfile);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_CREATED_DATE')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_UPDATED_DATE')).toBe(true);
    });

    it('should generate warnings for missing optional fields', () => {
      const appleProfileWithoutNames: Partial<UserProfile> = {
        id: 'user123',
        displayName: 'User',
        email: 'user@example.com',
        providerId: 'apple123',
        providerType: 'apple',
        // Missing firstName and lastName for Apple profile
      };

      const result = sanitizer.validateRequiredFields(appleProfileWithoutNames);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('Apple profile missing both first and last name'))).toBe(true);
    });

    it('should enforce email domain restrictions in strict mode', () => {
      const config: Partial<SanitizationConfig> = {
        allowedEmailDomains: ['example.com', 'test.com'],
        strictMode: true,
      };
      const strictSanitizer = new DataSanitizationUtils(config);

      const restrictedProfile: Partial<UserProfile> = {
        id: 'user123',
        displayName: 'John Doe',
        email: 'john@gmail.com', // Not in allowed domains
        providerId: 'google123',
        providerType: 'google',
      };

      const result = strictSanitizer.validateRequiredFields(restrictedProfile);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'DISALLOWED_EMAIL_DOMAIN')).toBe(true);
    });
  });

  describe('createPrivacySafeErrorLog', () => {
    it('should create safe error log from Error object', () => {
      const error = new Error('User john@example.com not found with token abc123def456789');
      const context = 'ProfileService.loadUser';
      const additionalData = { userId: 'user123', attempt: 1 };

      const safeLog: SafeErrorInfo = sanitizer.createPrivacySafeErrorLog(error, context, additionalData);

      expect(safeLog.errorType).toBe('Error');
      expect(safeLog.context).toBe(context);
      expect(safeLog.sanitizedMessage).toContain('[EMAIL]');
      expect(safeLog.sanitizedMessage).toContain('[TOKEN]');
      expect(safeLog.sanitizedMessage).not.toContain('john@example.com');
      expect(safeLog.sanitizedMessage).not.toContain('abc123def456789');
      expect(safeLog.timestamp).toBeInstanceOf(Date);
    });

    it('should categorize error codes correctly', () => {
      const testCases = [
        { message: 'MISSING_REQUIRED_FIELD: email is required', expectedCode: 'MISSING_REQUIRED_FIELD' },
        { message: 'INVALID_EMAIL format detected', expectedCode: 'INVALID_EMAIL' },
        { message: 'NETWORK connection failed', expectedCode: 'NETWORK_ERROR' },
        { message: 'Request TIMEOUT after 5 seconds', expectedCode: 'TIMEOUT_ERROR' },
        { message: 'OAUTH provider returned error', expectedCode: 'OAUTH_ERROR' },
        { message: 'Something else went wrong', expectedCode: 'GENERAL_ERROR' },
      ];

      testCases.forEach(({ message, expectedCode }) => {
        const error = new Error(message);
        const safeLog = sanitizer.createPrivacySafeErrorLog(error, 'test');
        expect(safeLog.errorCode).toBe(expectedCode);
      });
    });

    it('should sanitize additional data', () => {
      const error = new Error('Test error');
      const sensitiveData = {
        email: 'user@example.com',
        password: 'secret123',
        token: 'abc123def456',
        userId: 'user123',
        normalField: 'normal value',
      };

      const safeLog = sanitizer.createPrivacySafeErrorLog(error, 'test', sensitiveData);

      const additionalData = (safeLog as any).additionalData;
      expect(additionalData.email).toBe('[REDACTED]');
      expect(additionalData.password).toBe('[REDACTED]');
      expect(additionalData.token).toBe('[REDACTED]');
      expect(additionalData.userId).toBe('user123'); // Not sensitive
      expect(additionalData.normalField).toBe('normal value');
    });

    it('should handle non-Error objects', () => {
      const errorObj = {
        code: 'CUSTOM_ERROR',
        message: 'Custom error with email user@test.com',
        name: 'CustomError',
      };

      const safeLog = sanitizer.createPrivacySafeErrorLog(errorObj, 'test');

      expect(safeLog.errorCode).toBe('CUSTOM_ERROR');
      expect(safeLog.errorType).toBe('CustomError');
      expect(safeLog.sanitizedMessage).toContain('[EMAIL]');
      expect(safeLog.sanitizedMessage).not.toContain('user@test.com');
    });

    it('should limit object depth in additional data', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: 'too deep',
            },
          },
        },
      };

      const error = new Error('Test');
      const safeLog = sanitizer.createPrivacySafeErrorLog(error, 'test', { deep: deepObject });

      const additionalData = (safeLog as any).additionalData;
      // The object should be truncated at depth 3 (depth starts at 1)
      expect(additionalData.deep.level1.level2.level3).toBe('[OBJECT_TOO_DEEP]');
    });
  });

  describe('logErrorWithPrivacyProtection', () => {
    it('should log error without exposing sensitive data', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const error = new Error('User test@example.com authentication failed');
      sanitizer.logErrorWithPrivacyProtection(error, 'AuthService.login', { userId: 'user123' });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DataSanitization] Privacy-safe error log:',
        expect.objectContaining({
          context: 'AuthService.login',
          errorType: 'Error',
          message: expect.stringContaining('[EMAIL]'),
          additionalData: expect.objectContaining({ userId: 'user123' }),
        })
      );

      expect(consoleSpy.mock.calls[0][1].message).not.toContain('test@example.com');

      consoleSpy.mockRestore();
    });
  });

  describe('singleton instance', () => {
    it('should provide a working singleton instance', () => {
      const profile: Partial<UserProfile> = {
        id: 'test123',
        displayName: 'Test User',
        email: 'test@example.com',
        providerId: 'google123',
        providerType: 'google',
      };

      const result = dataSanitizationUtils.validateRequiredFields(profile);
      expect(result.isValid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle null and undefined values gracefully', () => {
      const nullProfile: Partial<UserProfile> = {
        id: null as any,
        displayName: undefined,
        email: '',
      };

      const result = sanitizer.sanitizeProfileData(nullProfile);
      expect(result.sanitizedProfile.id).toBeUndefined(); // null becomes undefined after sanitization
      expect(result.sanitizedProfile.displayName).toBeUndefined();
    });

    it('should handle very large objects in error logging', () => {
      const largeObject: any = {};
      for (let i = 0; i < 25; i++) {
        largeObject[`field${i}`] = `value${i}`;
      }

      const error = new Error('Test error');
      const safeLog = sanitizer.createPrivacySafeErrorLog(error, 'test', { large: largeObject });

      const additionalData = (safeLog as any).additionalData;
      expect(additionalData.large['...']).toBe('[TRUNCATED]');
    });

    it('should handle arrays in error logging', () => {
      const largeArray = Array.from({ length: 15 }, (_, i) => `item${i}`);

      const error = new Error('Test error');
      const safeLog = sanitizer.createPrivacySafeErrorLog(error, 'test', { array: largeArray });

      const additionalData = (safeLog as any).additionalData;
      expect(additionalData.array).toHaveLength(10); // Limited to 10 items
    });
  });
});