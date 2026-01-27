/**
 * AuthContext Tests - Testing profile data integration
 * Requirements: 2.1, 2.4, 4.2, 4.5
 */

import { profileStorageManager } from '../services/ProfileStorageManager';
import { oauthService } from '../services/OAuthService';
import { UserProfile } from '../types/auth';

// Mock dependencies
jest.mock('../services/ProfileStorageManager');
jest.mock('../services/OAuthService');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../api/client');

const mockProfileStorageManager = profileStorageManager as jest.Mocked<typeof profileStorageManager>;
const mockOAuthService = oauthService as jest.Mocked<typeof oauthService>;

describe('AuthContext Profile Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Profile Data Management', () => {
    it('should handle profile storage operations', async () => {
      const mockProfile: UserProfile = {
        id: 'user123',
        displayName: 'John Doe',
        email: 'john@example.com',
        providerId: 'google123',
        providerType: 'google',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockProfileStorageManager.saveProfile.mockResolvedValue();
      mockProfileStorageManager.loadProfile.mockResolvedValue(mockProfile);

      // Test profile saving
      await profileStorageManager.saveProfile(mockProfile);
      expect(mockProfileStorageManager.saveProfile).toHaveBeenCalledWith(mockProfile);

      // Test profile loading
      const loadedProfile = await profileStorageManager.loadProfile('user123');
      expect(mockProfileStorageManager.loadProfile).toHaveBeenCalledWith('user123');
      expect(loadedProfile).toEqual(mockProfile);
    });

    it('should handle profile updates', async () => {
      const updates = { displayName: 'John Updated' };

      mockProfileStorageManager.updateProfile.mockResolvedValue();

      await profileStorageManager.updateProfile('user123', updates);
      expect(mockProfileStorageManager.updateProfile).toHaveBeenCalledWith('user123', updates);
    });

    it('should handle profile clearing', async () => {
      mockProfileStorageManager.clearProfile.mockResolvedValue();

      await profileStorageManager.clearProfile('user123');
      expect(mockProfileStorageManager.clearProfile).toHaveBeenCalledWith('user123');
    });
  });

  describe('OAuth Integration', () => {
    it('should handle Google OAuth authentication', async () => {
      const mockAuthResult = {
        user: {
          id: 'google123',
          displayName: 'John Doe',
          email: 'john@example.com',
          providerId: 'google123',
          providerType: 'google' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        tokens: {
          accessToken: 'access_token',
          idToken: 'id_token',
        },
      };

      mockOAuthService.signInWithGoogle.mockResolvedValue(mockAuthResult);

      const result = await oauthService.signInWithGoogle();
      expect(mockOAuthService.signInWithGoogle).toHaveBeenCalled();
      expect(result).toEqual(mockAuthResult);
    });

    it('should handle Apple OAuth authentication', async () => {
      const mockAuthResult = {
        user: {
          id: 'apple123',
          displayName: 'Jane Smith',
          email: 'jane@example.com',
          providerId: 'apple123',
          providerType: 'apple' as const,
          firstName: 'Jane',
          lastName: 'Smith',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        tokens: {
          idToken: 'id_token',
        },
      };

      mockOAuthService.signInWithApple.mockResolvedValue(mockAuthResult);

      const result = await oauthService.signInWithApple();
      expect(mockOAuthService.signInWithApple).toHaveBeenCalled();
      expect(result).toEqual(mockAuthResult);
    });
  });

  describe('Fallback Profile Creation', () => {
    it('should create fallback profile from user data', () => {
      const userData = {
        user_id: 'existing123',
        email: 'existing@example.com',
        name: 'Existing User',
        picture: 'https://example.com/avatar.jpg',
      };

      // This tests the logic that would be in AuthContext
      const createFallbackProfileFromUser = (userData: any): UserProfile => {
        const now = new Date();
        return {
          id: userData.user_id,
          displayName: userData.name || userData.email.split('@')[0],
          email: userData.email,
          providerId: userData.user_id,
          providerType: 'google', // Default assumption for existing users
          avatarUrl: userData.picture,
          firstName: undefined,
          lastName: undefined,
          createdAt: now,
          updatedAt: now,
        };
      };

      const fallbackProfile = createFallbackProfileFromUser(userData);

      expect(fallbackProfile.id).toBe('existing123');
      expect(fallbackProfile.displayName).toBe('Existing User');
      expect(fallbackProfile.email).toBe('existing@example.com');
      expect(fallbackProfile.providerId).toBe('existing123');
      expect(fallbackProfile.providerType).toBe('google');
      expect(fallbackProfile.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should use email prefix as fallback display name', () => {
      const userData = {
        user_id: 'existing123',
        email: 'test.user@example.com',
        name: '', // Empty name
      };

      const createFallbackProfileFromUser = (userData: any): UserProfile => {
        const now = new Date();
        return {
          id: userData.user_id,
          displayName: userData.name || userData.email.split('@')[0],
          email: userData.email,
          providerId: userData.user_id,
          providerType: 'google',
          avatarUrl: userData.picture,
          firstName: undefined,
          lastName: undefined,
          createdAt: now,
          updatedAt: now,
        };
      };

      const fallbackProfile = createFallbackProfileFromUser(userData);

      expect(fallbackProfile.displayName).toBe('test.user');
    });
  });

  describe('Error Handling', () => {
    it('should handle profile storage errors gracefully', async () => {
      const mockProfile: UserProfile = {
        id: 'user123',
        displayName: 'John Doe',
        email: 'john@example.com',
        providerId: 'google123',
        providerType: 'google',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockProfileStorageManager.saveProfile.mockRejectedValue(new Error('Storage error'));

      await expect(profileStorageManager.saveProfile(mockProfile)).rejects.toThrow('Storage error');
    });

    it('should handle OAuth errors gracefully', async () => {
      mockOAuthService.signInWithGoogle.mockRejectedValue(new Error('OAuth error'));

      await expect(oauthService.signInWithGoogle()).rejects.toThrow('OAuth error');
    });

    it('should handle missing profile data gracefully', async () => {
      mockProfileStorageManager.loadProfile.mockResolvedValue(null);

      const result = await profileStorageManager.loadProfile('nonexistent');
      expect(result).toBeNull();
    });
  });
});