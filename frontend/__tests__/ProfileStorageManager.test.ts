/**
 * Unit tests for ProfileStorageManager
 * Requirements: 2.1, 2.2, 2.3, 2.5, 6.1, 6.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { ProfileStorageManager } from '../services/ProfileStorageManager';
import { UserProfile, AUTH_STORAGE_KEYS } from '../types/auth';

// Mock AsyncStorage and SecureStore
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-secure-store');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('ProfileStorageManager', () => {
  let storageManager: ProfileStorageManager;
  let mockProfile: UserProfile;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create fresh instance for each test
    storageManager = new ProfileStorageManager();
    
    // Create mock profile
    mockProfile = {
      id: 'test-user-123',
      displayName: 'John Doe',
      email: 'john.doe@example.com',
      providerId: 'google-123',
      providerType: 'google',
      avatarUrl: 'https://example.com/avatar.jpg',
      firstName: 'John',
      lastName: 'Doe',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    // Setup default mock implementations
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.removeItem.mockResolvedValue();
    mockAsyncStorage.getAllKeys.mockResolvedValue([]);
    mockAsyncStorage.multiRemove.mockResolvedValue();
    
    mockSecureStore.setItemAsync.mockResolvedValue();
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockSecureStore.deleteItemAsync.mockResolvedValue();
  });

  describe('saveProfile', () => {
    it('should save profile data to AsyncStorage and SecureStore', async () => {
      await storageManager.saveProfile(mockProfile);

      // Verify AsyncStorage was called with non-sensitive data
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        `${AUTH_STORAGE_KEYS.USER_PROFILE}_${mockProfile.id}`,
        expect.stringContaining('"displayName":"John Doe"')
      );

      // Verify SecureStore was called with sensitive data
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        `sensitive_profile_data_${mockProfile.id}`,
        expect.stringContaining('"email":"john.doe@example.com"')
      );
    });

    it('should validate profile data before saving', async () => {
      const invalidProfile = { ...mockProfile, email: 'invalid-email' };

      await expect(storageManager.saveProfile(invalidProfile)).rejects.toThrow('Email format is invalid');
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

      await expect(storageManager.saveProfile(mockProfile)).rejects.toThrow('Failed to save profile');
    });

    it('should handle SecureStore errors gracefully', async () => {
      mockSecureStore.setItemAsync.mockRejectedValue(new Error('Secure storage error'));

      await expect(storageManager.saveProfile(mockProfile)).rejects.toThrow('Failed to save profile');
    });

    it('should save profile without encryption when disabled', async () => {
      const storageManagerNoEncryption = new ProfileStorageManager({ encryptSensitiveData: false });
      
      await storageManagerNoEncryption.saveProfile(mockProfile);

      // Should only call AsyncStorage, not SecureStore
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
      expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
    });
  });

  describe('loadProfile', () => {
    it('should load profile from storage and merge sensitive data', async () => {
      // Setup mock storage data
      const nonSensitiveData = {
        profile: {
          id: mockProfile.id,
          displayName: mockProfile.displayName,
          providerId: mockProfile.providerId,
          providerType: mockProfile.providerType,
          avatarUrl: mockProfile.avatarUrl,
          createdAt: mockProfile.createdAt.toISOString(),
          updatedAt: mockProfile.updatedAt.toISOString(),
        },
        metadata: {
          version: '1.0.0',
          lastSync: new Date().toISOString(),
          source: 'google',
        },
      };

      const sensitiveData = {
        email: mockProfile.email,
        firstName: mockProfile.firstName,
        lastName: mockProfile.lastName,
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(nonSensitiveData));
      mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(sensitiveData));

      const result = await storageManager.loadProfile(mockProfile.id);

      expect(result).toEqual(expect.objectContaining({
        id: mockProfile.id,
        displayName: mockProfile.displayName,
        email: mockProfile.email,
        firstName: mockProfile.firstName,
        lastName: mockProfile.lastName,
      }));
    });

    it('should return null when profile does not exist', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await storageManager.loadProfile('non-existent-user');

      expect(result).toBeNull();
    });

    it('should handle corrupted storage data gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid-json');

      const result = await storageManager.loadProfile(mockProfile.id);

      expect(result).toBeNull();
    });

    it('should continue loading when SecureStore fails', async () => {
      const nonSensitiveData = {
        profile: {
          id: mockProfile.id,
          displayName: mockProfile.displayName,
          email: mockProfile.email, // Include email in non-sensitive data for this test
          providerId: mockProfile.providerId,
          providerType: mockProfile.providerType,
          createdAt: mockProfile.createdAt.toISOString(),
          updatedAt: mockProfile.updatedAt.toISOString(),
        },
        metadata: {
          version: '1.0.0',
          lastSync: new Date().toISOString(),
          source: 'google',
        },
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(nonSensitiveData));
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('SecureStore error'));

      const result = await storageManager.loadProfile(mockProfile.id);

      // Should still return profile without sensitive data
      expect(result).toEqual(expect.objectContaining({
        id: mockProfile.id,
        displayName: mockProfile.displayName,
        email: mockProfile.email,
      }));
    });

    it('should use cache when available and not expired', async () => {
      // First load to populate cache
      const nonSensitiveData = {
        profile: mockProfile,
        metadata: {
          version: '1.0.0',
          lastSync: new Date().toISOString(),
          source: 'google',
        },
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(nonSensitiveData));
      
      await storageManager.loadProfile(mockProfile.id);
      
      // Clear mock calls
      jest.clearAllMocks();
      
      // Second load should use cache
      const result = await storageManager.loadProfile(mockProfile.id);

      expect(mockAsyncStorage.getItem).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        id: mockProfile.id,
        displayName: mockProfile.displayName,
      }));
    });
  });

  describe('updateProfile', () => {
    it('should update existing profile with new data', async () => {
      // Setup existing profile in storage
      const existingData = {
        profile: mockProfile,
        metadata: {
          version: '1.0.0',
          lastSync: new Date().toISOString(),
          source: 'google',
        },
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingData));

      const updates = {
        displayName: 'Jane Doe',
        firstName: 'Jane',
      };

      await storageManager.updateProfile(mockProfile.id, updates);

      // Verify the profile was saved with updates
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        `${AUTH_STORAGE_KEYS.USER_PROFILE}_${mockProfile.id}`,
        expect.stringContaining('"displayName":"Jane Doe"')
      );
    });

    it('should throw error when profile does not exist', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await expect(
        storageManager.updateProfile('non-existent-user', { displayName: 'New Name' })
      ).rejects.toThrow('Profile not found');
    });

    it('should validate updated profile data', async () => {
      const existingData = {
        profile: mockProfile,
        metadata: {
          version: '1.0.0',
          lastSync: new Date().toISOString(),
          source: 'google',
        },
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingData));

      const invalidUpdates = {
        email: 'invalid-email',
      };

      await expect(
        storageManager.updateProfile(mockProfile.id, invalidUpdates)
      ).rejects.toThrow('Email format is invalid');
    });

    it('should not allow changing user ID', async () => {
      const existingData = {
        profile: mockProfile,
        metadata: {
          version: '1.0.0',
          lastSync: new Date().toISOString(),
          source: 'google',
        },
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingData));

      const updates = {
        id: 'different-id',
        displayName: 'New Name',
      };

      await storageManager.updateProfile(mockProfile.id, updates);

      // Verify ID was not changed
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        `${AUTH_STORAGE_KEYS.USER_PROFILE}_${mockProfile.id}`,
        expect.stringContaining(`"id":"${mockProfile.id}"`)
      );
    });
  });

  describe('clearProfile', () => {
    it('should remove profile from both AsyncStorage and SecureStore', async () => {
      await storageManager.clearProfile(mockProfile.id);

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        `${AUTH_STORAGE_KEYS.USER_PROFILE}_${mockProfile.id}`
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        `sensitive_profile_data_${mockProfile.id}`
      );
    });

    it('should handle SecureStore deletion errors gracefully', async () => {
      mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('Item not found'));

      // Should not throw error
      await expect(storageManager.clearProfile(mockProfile.id)).resolves.not.toThrow();
      
      // Should still remove from AsyncStorage
      expect(mockAsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('should handle AsyncStorage deletion errors', async () => {
      mockAsyncStorage.removeItem.mockRejectedValue(new Error('Storage error'));

      await expect(storageManager.clearProfile(mockProfile.id)).rejects.toThrow('Failed to clear profile');
    });
  });

  describe('clearAllProfiles', () => {
    it('should remove all profile data from storage', async () => {
      const profileKeys = [
        `${AUTH_STORAGE_KEYS.USER_PROFILE}_user1`,
        `${AUTH_STORAGE_KEYS.USER_PROFILE}_user2`,
        'other_key',
      ];

      mockAsyncStorage.getAllKeys.mockResolvedValue(profileKeys);

      await storageManager.clearAllProfiles();

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        `${AUTH_STORAGE_KEYS.USER_PROFILE}_user1`,
        `${AUTH_STORAGE_KEYS.USER_PROFILE}_user2`,
      ]);
    });

    it('should handle empty storage gracefully', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValue([]);

      await expect(storageManager.clearAllProfiles()).resolves.not.toThrow();
    });

    it('should handle storage errors during clear all', async () => {
      mockAsyncStorage.getAllKeys.mockRejectedValue(new Error('Storage error'));

      await expect(storageManager.clearAllProfiles()).rejects.toThrow('Failed to clear all profiles');
    });
  });

  describe('validation', () => {
    it('should reject profile with missing required fields', async () => {
      const invalidProfiles = [
        { ...mockProfile, id: '' },
        { ...mockProfile, email: '' },
        { ...mockProfile, displayName: '' },
        { ...mockProfile, providerId: '' },
        { ...mockProfile, providerType: 'invalid' as any },
        { ...mockProfile, createdAt: 'invalid-date' as any },
        { ...mockProfile, updatedAt: new Date('invalid') },
      ];

      for (const invalidProfile of invalidProfiles) {
        await expect(storageManager.saveProfile(invalidProfile)).rejects.toThrow();
      }
    });

    it('should accept valid profile with optional fields missing', async () => {
      const minimalProfile: UserProfile = {
        id: 'test-user',
        displayName: 'Test User',
        email: 'test@example.com',
        providerId: 'provider-123',
        providerType: 'google',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(storageManager.saveProfile(minimalProfile)).resolves.not.toThrow();
    });
  });

  describe('error handling and privacy', () => {
    it('should sanitize errors to remove sensitive information', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockAsyncStorage.setItem.mockRejectedValue({
        message: 'Storage error',
        email: 'sensitive@example.com',
        profile: { secret: 'data' },
      });

      await expect(storageManager.saveProfile(mockProfile)).rejects.toThrow();

      // Check that console.error was called with sanitized error from DataSanitization
      expect(consoleSpy).toHaveBeenCalledWith(
        '[DataSanitization] Privacy-safe error log:',
        expect.objectContaining({
          context: 'ProfileStorageManager.saveProfile',
          additionalData: expect.objectContaining({
            userId: mockProfile.id
          })
        })
      );

      consoleSpy.mockRestore();
    });

    it('should handle non-Error objects in error sanitization', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockAsyncStorage.setItem.mockRejectedValue('string error');

      await expect(storageManager.saveProfile(mockProfile)).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DataSanitization] Privacy-safe error log:',
        expect.objectContaining({
          context: 'ProfileStorageManager.saveProfile',
          message: 'An error occurred', // String errors get sanitized to generic message
          additionalData: expect.objectContaining({
            userId: mockProfile.id
          })
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('cache management', () => {
    it('should expire cache after timeout', async () => {
      const shortTimeoutManager = new ProfileStorageManager({ cacheTimeout: 100 }); // 100ms

      // Setup storage data
      const storageData = {
        profile: mockProfile,
        metadata: {
          version: '1.0.0',
          lastSync: new Date().toISOString(),
          source: 'google',
        },
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(storageData));

      // First load to populate cache
      await shortTimeoutManager.loadProfile(mockProfile.id);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Clear mock calls
      jest.clearAllMocks();
      
      // Second load should hit storage again
      await shortTimeoutManager.loadProfile(mockProfile.id);

      expect(mockAsyncStorage.getItem).toHaveBeenCalled();
    });
  });
});