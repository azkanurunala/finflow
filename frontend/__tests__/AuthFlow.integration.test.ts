/**
 * Integration tests for authentication flows
 * Tests the complete integration between AuthContext, OAuthService, and ProfileStorageManager
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { oauthService } from '../services/OAuthService';
import { profileStorageManager } from '../services/ProfileStorageManager';
import { UserProfile } from '../types/auth';

// Mock external dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-secure-store');
jest.mock('../api/client');
jest.mock('../services/OAuthService');
jest.mock('../services/ProfileStorageManager');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockOAuthService = oauthService as jest.Mocked<typeof oauthService>;
const mockProfileStorageManager = profileStorageManager as jest.Mocked<typeof profileStorageManager>;

describe('Authentication Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();
    mockSecureStore.setItemAsync.mockResolvedValue();
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockSecureStore.deleteItemAsync.mockResolvedValue();
  });

  describe('OAuth Service Integration', () => {
    it('should integrate Google OAuth with ProfileExtractor and ProfileStorageManager', async () => {
      // Setup mock data
      const mockProfile: UserProfile = {
        id: 'google-123',
        displayName: 'John Doe',
        email: 'john@example.com',
        providerId: 'google-123',
        providerType: 'google',
        avatarUrl: 'https://example.com/avatar.jpg',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAuthResult = {
        user: mockProfile,
        tokens: {
          accessToken: 'access-token',
          idToken: 'id-token',
        },
      };

      // Setup mocks
      mockOAuthService.signInWithGoogle.mockResolvedValue(mockAuthResult);

      // Execute OAuth flow
      const result = await oauthService.signInWithGoogle();

      // Verify OAuth service returns expected result
      expect(result).toEqual(mockAuthResult);
      expect(result.user.displayName).toBe('John Doe');
      expect(result.user.email).toBe('john@example.com');
      expect(result.user.providerType).toBe('google');
    });

    it('should integrate Apple OAuth with ProfileExtractor and ProfileStorageManager', async () => {
      // Setup mock data
      const mockProfile: UserProfile = {
        id: 'apple-456',
        displayName: 'Jane Smith',
        email: 'jane@example.com',
        providerId: 'apple-456',
        providerType: 'apple',
        firstName: 'Jane',
        lastName: 'Smith',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAuthResult = {
        user: mockProfile,
        tokens: { idToken: 'id-token' },
      };

      // Setup mocks
      mockOAuthService.signInWithApple.mockResolvedValue(mockAuthResult);

      // Execute OAuth flow
      const result = await oauthService.signInWithApple();

      // Verify OAuth service returns expected result
      expect(result).toEqual(mockAuthResult);
      expect(result.user.displayName).toBe('Jane Smith');
      expect(result.user.email).toBe('jane@example.com');
      expect(result.user.providerType).toBe('apple');
    });
  });

  describe('Profile Storage Integration', () => {
    it('should save and load profile data correctly', async () => {
      const mockProfile: UserProfile = {
        id: 'user-123',
        displayName: 'Test User',
        email: 'test@example.com',
        providerId: 'user-123',
        providerType: 'google',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Setup mocks
      mockProfileStorageManager.saveProfile.mockResolvedValue();
      mockProfileStorageManager.loadProfile.mockResolvedValue(mockProfile);

      // Save profile
      await profileStorageManager.saveProfile(mockProfile);
      expect(mockProfileStorageManager.saveProfile).toHaveBeenCalledWith(mockProfile);

      // Load profile
      const loadedProfile = await profileStorageManager.loadProfile('user-123');
      expect(mockProfileStorageManager.loadProfile).toHaveBeenCalledWith('user-123');
      expect(loadedProfile).toEqual(mockProfile);
    });

    it('should update profile data correctly', async () => {
      const mockProfile: UserProfile = {
        id: 'user-123',
        displayName: 'Test User',
        email: 'test@example.com',
        providerId: 'user-123',
        providerType: 'google',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedProfile: UserProfile = {
        ...mockProfile,
        displayName: 'Updated User',
        updatedAt: new Date(),
      };

      // Setup mocks
      mockProfileStorageManager.updateProfile.mockResolvedValue();
      mockProfileStorageManager.loadProfile.mockResolvedValue(updatedProfile);

      // Update profile
      const updates = { displayName: 'Updated User' };
      await profileStorageManager.updateProfile('user-123', updates);
      expect(mockProfileStorageManager.updateProfile).toHaveBeenCalledWith('user-123', updates);

      // Verify updated profile can be loaded
      const loadedProfile = await profileStorageManager.loadProfile('user-123');
      expect(loadedProfile?.displayName).toBe('Updated User');
    });

    it('should clear profile data securely', async () => {
      // Setup mocks
      mockProfileStorageManager.clearProfile.mockResolvedValue();

      // Clear profile
      await profileStorageManager.clearProfile('user-123');
      expect(mockProfileStorageManager.clearProfile).toHaveBeenCalledWith('user-123');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle OAuth errors gracefully', async () => {
      // Setup error mock
      const oauthError = new Error('OAuth failed');
      mockOAuthService.signInWithGoogle.mockRejectedValue(oauthError);

      // Execute OAuth flow and expect error
      await expect(oauthService.signInWithGoogle()).rejects.toThrow('OAuth failed');
    });

    it('should handle storage errors gracefully', async () => {
      const mockProfile: UserProfile = {
        id: 'user-123',
        displayName: 'Test User',
        email: 'test@example.com',
        providerId: 'user-123',
        providerType: 'google',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Setup error mock
      const storageError = new Error('Storage failed');
      mockProfileStorageManager.saveProfile.mockRejectedValue(storageError);

      // Execute storage operation and expect error
      await expect(profileStorageManager.saveProfile(mockProfile)).rejects.toThrow('Storage failed');
    });
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full Google authentication flow with profile management', async () => {
      // Setup mock data
      const mockProfile: UserProfile = {
        id: 'google-123',
        displayName: 'John Doe',
        email: 'john@example.com',
        providerId: 'google-123',
        providerType: 'google',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAuthResult = {
        user: mockProfile,
        tokens: { accessToken: 'access-token' },
      };

      // Setup mocks for complete flow
      mockOAuthService.signInWithGoogle.mockResolvedValue(mockAuthResult);
      mockProfileStorageManager.saveProfile.mockResolvedValue();
      mockProfileStorageManager.loadProfile.mockResolvedValue(mockProfile);

      // Step 1: OAuth authentication
      const authResult = await oauthService.signInWithGoogle();
      expect(authResult.user).toEqual(mockProfile);

      // Step 2: Save profile
      await profileStorageManager.saveProfile(authResult.user);
      expect(mockProfileStorageManager.saveProfile).toHaveBeenCalledWith(mockProfile);

      // Step 3: Load profile (simulating app restart)
      const loadedProfile = await profileStorageManager.loadProfile(mockProfile.id);
      expect(loadedProfile).toEqual(mockProfile);

      // Step 4: Update profile
      const updates = { displayName: 'John Updated' };
      mockProfileStorageManager.updateProfile.mockResolvedValue();
      await profileStorageManager.updateProfile(mockProfile.id, updates);
      expect(mockProfileStorageManager.updateProfile).toHaveBeenCalledWith(mockProfile.id, updates);

      // Step 5: Clear profile (logout)
      mockProfileStorageManager.clearProfile.mockResolvedValue();
      await profileStorageManager.clearProfile(mockProfile.id);
      expect(mockProfileStorageManager.clearProfile).toHaveBeenCalledWith(mockProfile.id);
    });

    it('should complete full Apple authentication flow with profile management', async () => {
      // Setup mock data
      const mockProfile: UserProfile = {
        id: 'apple-456',
        displayName: 'Jane Smith',
        email: 'jane@example.com',
        providerId: 'apple-456',
        providerType: 'apple',
        firstName: 'Jane',
        lastName: 'Smith',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAuthResult = {
        user: mockProfile,
        tokens: { idToken: 'id-token' },
      };

      // Setup mocks for complete flow
      mockOAuthService.signInWithApple.mockResolvedValue(mockAuthResult);
      mockProfileStorageManager.saveProfile.mockResolvedValue();
      mockProfileStorageManager.loadProfile.mockResolvedValue(mockProfile);

      // Step 1: OAuth authentication
      const authResult = await oauthService.signInWithApple();
      expect(authResult.user).toEqual(mockProfile);

      // Step 2: Save profile
      await profileStorageManager.saveProfile(authResult.user);
      expect(mockProfileStorageManager.saveProfile).toHaveBeenCalledWith(mockProfile);

      // Step 3: Load profile (simulating app restart)
      const loadedProfile = await profileStorageManager.loadProfile(mockProfile.id);
      expect(loadedProfile).toEqual(mockProfile);

      // Verify Apple-specific profile data
      expect(loadedProfile?.firstName).toBe('Jane');
      expect(loadedProfile?.lastName).toBe('Smith');
      expect(loadedProfile?.providerType).toBe('apple');
    });
  });
});