/**
 * ProfileStorageManager - Manages profile data storage with encryption and caching
 * Requirements: 2.1, 2.2, 2.3, 2.5, 6.1, 6.5, 5.4, 5.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { 
  UserProfile, 
  StoredProfile, 
  AUTH_STORAGE_KEYS,
  ProfileStorageManager as IProfileStorageManager,
  OAuthProviderType
} from '../types/auth';
import { dataSanitizationUtils } from '../utils/dataSanitization';

/**
 * Configuration for storage operations
 */
interface StorageConfig {
  encryptSensitiveData: boolean;
  cacheTimeout: number; // Cache timeout in milliseconds
  version: string; // Storage schema version
}

const DEFAULT_CONFIG: StorageConfig = {
  encryptSensitiveData: true,
  cacheTimeout: 24 * 60 * 60 * 1000, // 24 hours
  version: '1.0.0',
};

/**
 * Keys for sensitive data stored in SecureStore
 */
const SECURE_KEYS = {
  PROFILE_ENCRYPTION_KEY: 'profile_encryption_key',
  SENSITIVE_PROFILE_DATA: 'sensitive_profile_data',
} as const;

/**
 * In-memory cache for profile data
 */
interface ProfileCache {
  [userId: string]: {
    profile: UserProfile;
    timestamp: number;
  };
}

export class ProfileStorageManager implements IProfileStorageManager {
  private config: StorageConfig;
  private cache: ProfileCache = {};

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Save profile data with encryption for sensitive information
   * Requirements: 2.1, 2.2, 6.1, 5.4, 5.5
   */
  async saveProfile(profile: UserProfile): Promise<void> {
    try {
      // Sanitize profile data before validation and storage
      const sanitizationResult = dataSanitizationUtils.sanitizeProfileData(profile);
      
      if (sanitizationResult.wasModified) {
        dataSanitizationUtils.logErrorWithPrivacyProtection(
          new Error('Profile data required sanitization before storage'),
          'ProfileStorageManager.saveProfile',
          { 
            modifications: sanitizationResult.modifications,
            userId: profile.id
          }
        );
      }

      // Use sanitized profile for validation and storage
      const sanitizedProfile = { ...profile, ...sanitizationResult.sanitizedProfile };

      // Validate profile data before saving
      this.validateProfile(sanitizedProfile);

      // Create stored profile with metadata
      const storedProfile: StoredProfile = {
        profile: sanitizedProfile,
        metadata: {
          version: this.config.version,
          lastSync: new Date(),
          source: sanitizedProfile.providerType,
        },
      };

      // Separate sensitive and non-sensitive data
      const { sensitiveData, nonSensitiveData } = this.separateProfileData(storedProfile);

      // Store non-sensitive data in AsyncStorage
      const storageKey = this.getProfileStorageKey(sanitizedProfile.id);
      await AsyncStorage.setItem(storageKey, JSON.stringify(nonSensitiveData));

      // Store sensitive data in SecureStore if encryption is enabled
      if (this.config.encryptSensitiveData && Object.keys(sensitiveData).length > 0) {
        const secureKey = this.getSensitiveDataKey(sanitizedProfile.id);
        await SecureStore.setItemAsync(secureKey, JSON.stringify(sensitiveData));
      }

      // Update in-memory cache
      this.updateCache(sanitizedProfile.id, sanitizedProfile);

      console.log(`[ProfileStorageManager] Profile saved for user ${sanitizedProfile.id}`);
    } catch (error) {
      dataSanitizationUtils.logErrorWithPrivacyProtection(
        error,
        'ProfileStorageManager.saveProfile',
        { userId: profile.id }
      );
      throw new Error(`Failed to save profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load profile data with cache management
   * Requirements: 2.3, 2.4, 5.4, 5.5
   */
  async loadProfile(userId: string): Promise<UserProfile | null> {
    try {
      // Check cache first
      const cachedProfile = this.getCachedProfile(userId);
      if (cachedProfile) {
        console.log(`[ProfileStorageManager] Profile loaded from cache for user ${userId}`);
        return cachedProfile;
      }

      // Load from storage
      const storageKey = this.getProfileStorageKey(userId);
      const storedData = await AsyncStorage.getItem(storageKey);

      if (!storedData) {
        console.log(`[ProfileStorageManager] No profile found for user ${userId}`);
        return null;
      }

      // Parse non-sensitive data
      const nonSensitiveData = JSON.parse(storedData);

      // Load sensitive data if encryption is enabled
      let sensitiveData = {};
      if (this.config.encryptSensitiveData) {
        try {
          const secureKey = this.getSensitiveDataKey(userId);
          const sensitiveDataString = await SecureStore.getItemAsync(secureKey);
          if (sensitiveDataString) {
            sensitiveData = JSON.parse(sensitiveDataString);
          }
        } catch (error) {
          dataSanitizationUtils.logErrorWithPrivacyProtection(
            error,
            'ProfileStorageManager.loadProfile.sensitiveData',
            { userId }
          );
        }
      }

      // Merge data
      const storedProfile = this.mergeProfileData(nonSensitiveData, sensitiveData);

      // Validate stored profile
      if (!this.isValidStoredProfile(storedProfile)) {
        dataSanitizationUtils.logErrorWithPrivacyProtection(
          new Error('Invalid stored profile detected, removing from storage'),
          'ProfileStorageManager.loadProfile',
          { userId }
        );
        await this.clearProfile(userId);
        return null;
      }

      // Sanitize loaded profile data
      const sanitizationResult = dataSanitizationUtils.sanitizeProfileData(storedProfile.profile);
      
      if (sanitizationResult.wasModified) {
        dataSanitizationUtils.logErrorWithPrivacyProtection(
          new Error('Loaded profile data required sanitization'),
          'ProfileStorageManager.loadProfile',
          { 
            modifications: sanitizationResult.modifications,
            userId
          }
        );
        
        // Update stored profile with sanitized data
        const sanitizedProfile = { ...storedProfile.profile, ...sanitizationResult.sanitizedProfile };
        await this.saveProfile(sanitizedProfile);
      }

      // Check if data is expired (optional migration logic)
      if (this.isProfileDataExpired(storedProfile)) {
        console.log(`[ProfileStorageManager] Profile data expired for user ${userId}, will need refresh`);
        // Don't return null, but mark for refresh in the future
      }

      const profile = sanitizationResult.wasModified 
        ? { ...storedProfile.profile, ...sanitizationResult.sanitizedProfile }
        : storedProfile.profile;

      // Update cache
      this.updateCache(userId, profile);

      console.log(`[ProfileStorageManager] Profile loaded from storage for user ${userId}`);
      return profile;
    } catch (error) {
      dataSanitizationUtils.logErrorWithPrivacyProtection(
        error,
        'ProfileStorageManager.loadProfile',
        { userId }
      );
      return null; // Return null instead of throwing to allow graceful degradation
    }
  }

  /**
   * Update profile data with validation
   * Requirements: 2.3, 2.4, 5.4, 5.5
   */
  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      // Load existing profile
      const existingProfile = await this.loadProfile(userId);
      if (!existingProfile) {
        throw new Error(`Profile not found for user ${userId}`);
      }

      // Sanitize updates before merging
      const sanitizationResult = dataSanitizationUtils.sanitizeProfileData(updates);
      
      if (sanitizationResult.wasModified) {
        dataSanitizationUtils.logErrorWithPrivacyProtection(
          new Error('Profile updates required sanitization'),
          'ProfileStorageManager.updateProfile',
          { 
            modifications: sanitizationResult.modifications,
            userId
          }
        );
      }

      // Merge updates with existing profile
      const updatedProfile: UserProfile = {
        ...existingProfile,
        ...sanitizationResult.sanitizedProfile,
        id: userId, // Ensure ID cannot be changed
        updatedAt: new Date(), // Update timestamp
      };

      // Validate updated profile
      this.validateProfile(updatedProfile);

      // Save updated profile
      await this.saveProfile(updatedProfile);

      console.log(`[ProfileStorageManager] Profile updated for user ${userId}`);
    } catch (error) {
      dataSanitizationUtils.logErrorWithPrivacyProtection(
        error,
        'ProfileStorageManager.updateProfile',
        { userId }
      );
      throw new Error(`Failed to update profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear profile data securely
   * Requirements: 6.5, 5.5
   */
  async clearProfile(userId: string): Promise<void> {
    try {
      // Remove from AsyncStorage
      const storageKey = this.getProfileStorageKey(userId);
      await AsyncStorage.removeItem(storageKey);

      // Remove from SecureStore
      if (this.config.encryptSensitiveData) {
        try {
          const secureKey = this.getSensitiveDataKey(userId);
          await SecureStore.deleteItemAsync(secureKey);
        } catch (error) {
          // SecureStore might not have the item, which is fine
          dataSanitizationUtils.logErrorWithPrivacyProtection(
            error,
            'ProfileStorageManager.clearProfile.secureStore',
            { userId, note: 'SecureStore item may not exist' }
          );
        }
      }

      // Remove from cache
      delete this.cache[userId];

      console.log(`[ProfileStorageManager] Profile cleared for user ${userId}`);
    } catch (error) {
      dataSanitizationUtils.logErrorWithPrivacyProtection(
        error,
        'ProfileStorageManager.clearProfile',
        { userId }
      );
      throw new Error(`Failed to clear profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all profile data (for complete logout)
   * Requirements: 6.5, 5.5
   */
  async clearAllProfiles(): Promise<void> {
    try {
      // Get all profile keys from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      const profileKeys = allKeys.filter(key => key.startsWith(AUTH_STORAGE_KEYS.USER_PROFILE));

      // Remove all profile data
      if (profileKeys.length > 0) {
        await AsyncStorage.multiRemove(profileKeys);
      }

      // Clear sensitive data (we can't enumerate SecureStore keys, so we'll clear known patterns)
      if (this.config.encryptSensitiveData) {
        // Clear cache to get user IDs
        const userIds = Object.keys(this.cache);
        for (const userId of userIds) {
          try {
            const secureKey = this.getSensitiveDataKey(userId);
            await SecureStore.deleteItemAsync(secureKey);
          } catch (error) {
            // Ignore errors for non-existent keys
          }
        }
      }

      // Clear in-memory cache
      this.cache = {};

      console.log('[ProfileStorageManager] All profiles cleared');
    } catch (error) {
      dataSanitizationUtils.logErrorWithPrivacyProtection(
        error,
        'ProfileStorageManager.clearAllProfiles'
      );
      throw new Error(`Failed to clear all profiles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Private helper methods
   */

  /**
   * Validate profile data structure
   * Requirements: 5.4, 5.5
   */
  private validateProfile(profile: UserProfile): void {
    const validationResult = dataSanitizationUtils.validateRequiredFields(profile);
    
    if (!validationResult.isValid) {
      const errorMessage = `Profile validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`;
      dataSanitizationUtils.logErrorWithPrivacyProtection(
        new Error(errorMessage),
        'ProfileStorageManager.validateProfile',
        { 
          errorCount: validationResult.errors.length,
          warningCount: validationResult.warnings.length
        }
      );
      throw new Error(errorMessage);
    }

    // Log warnings if any
    if (validationResult.warnings.length > 0) {
      dataSanitizationUtils.logErrorWithPrivacyProtection(
        new Error('Profile validation warnings'),
        'ProfileStorageManager.validateProfile',
        { warnings: validationResult.warnings }
      );
    }
  }

  /**
   * Separate profile data into sensitive and non-sensitive parts
   */
  private separateProfileData(storedProfile: StoredProfile): {
    sensitiveData: any;
    nonSensitiveData: any;
  } {
    const { profile } = storedProfile;
    
    // Define what we consider sensitive data
    const sensitiveFields = ['email', 'firstName', 'lastName'];
    
    const sensitiveData: any = {};
    const nonSensitiveData: any = {
      ...storedProfile,
      profile: { ...profile },
    };

    // Move sensitive fields to secure storage
    sensitiveFields.forEach(field => {
      if (profile[field as keyof UserProfile]) {
        sensitiveData[field] = profile[field as keyof UserProfile];
        delete nonSensitiveData.profile[field];
      }
    });

    return { sensitiveData, nonSensitiveData };
  }

  /**
   * Merge sensitive and non-sensitive profile data
   */
  private mergeProfileData(nonSensitiveData: any, sensitiveData: any): StoredProfile {
    const storedProfile = { ...nonSensitiveData };
    
    // Merge sensitive data back into profile
    if (storedProfile.profile && sensitiveData) {
      storedProfile.profile = {
        ...storedProfile.profile,
        ...sensitiveData,
      };
    }

    // Convert date strings back to Date objects
    if (storedProfile.profile) {
      if (storedProfile.profile.createdAt) {
        storedProfile.profile.createdAt = new Date(storedProfile.profile.createdAt);
      }
      if (storedProfile.profile.updatedAt) {
        storedProfile.profile.updatedAt = new Date(storedProfile.profile.updatedAt);
      }
    }

    if (storedProfile.metadata && storedProfile.metadata.lastSync) {
      storedProfile.metadata.lastSync = new Date(storedProfile.metadata.lastSync);
    }

    return storedProfile;
  }

  /**
   * Get cached profile if valid and not expired
   */
  private getCachedProfile(userId: string): UserProfile | null {
    const cached = this.cache[userId];
    if (!cached) {
      return null;
    }

    // Check if cache is expired
    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheTimeout) {
      delete this.cache[userId];
      return null;
    }

    return cached.profile;
  }

  /**
   * Update in-memory cache
   */
  private updateCache(userId: string, profile: UserProfile): void {
    this.cache[userId] = {
      profile,
      timestamp: Date.now(),
    };
  }

  /**
   * Check if stored profile is valid
   */
  private isValidStoredProfile(storedProfile: any): storedProfile is StoredProfile {
    return (
      storedProfile &&
      storedProfile.profile &&
      storedProfile.metadata &&
      typeof storedProfile.profile.id === 'string' &&
      typeof storedProfile.profile.email === 'string' &&
      typeof storedProfile.profile.displayName === 'string'
    );
  }

  /**
   * Check if profile data is expired (for migration purposes)
   */
  private isProfileDataExpired(storedProfile: StoredProfile): boolean {
    if (!storedProfile.metadata.lastSync) {
      return true;
    }

    const now = Date.now();
    const lastSync = storedProfile.metadata.lastSync.getTime();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

    return now - lastSync > maxAge;
  }

  /**
   * Generate storage key for profile data
   */
  private getProfileStorageKey(userId: string): string {
    return `${AUTH_STORAGE_KEYS.USER_PROFILE}_${userId}`;
  }

  /**
   * Generate secure storage key for sensitive data
   */
  private getSensitiveDataKey(userId: string): string {
    return `${SECURE_KEYS.SENSITIVE_PROFILE_DATA}_${userId}`;
  }

  /**
   * Basic email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }
}

// Export singleton instance
export const profileStorageManager = new ProfileStorageManager();