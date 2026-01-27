/**
 * ProfileExtractor - Extracts and validates profile data from OAuth providers
 * Requirements: 1.1, 1.2, 1.3, 1.4, 5.4, 5.5
 */

import { 
  UserProfile, 
  GoogleSignInResult, 
  AppleAuthenticationCredential, 
  OAuthProviderType,
  ProfileExtractor as IProfileExtractor 
} from '../types/auth';
import { dataSanitizationUtils } from '../utils/dataSanitization';

export class ProfileExtractor implements IProfileExtractor {
  
  /**
   * Extracts profile data from Google OAuth response
   * Requirements: 1.1, 1.2, 5.4, 5.5
   */
  extractGoogleProfile(googleResponse: GoogleSignInResult): UserProfile {
    try {
      if (googleResponse.type !== 'success' || !googleResponse.user) {
        throw new Error('Invalid Google OAuth response');
      }

      const { user } = googleResponse;
      const now = new Date();
      
      // Extract display name with fallback logic
      const displayName = this.extractDisplayName(user.name, user.email);
      
      const rawProfile: Partial<UserProfile> = {
        id: user.id,
        displayName,
        email: user.email,
        providerId: user.id,
        providerType: 'google',
        avatarUrl: user.photoUrl || undefined,
        firstName: user.givenName || undefined,
        lastName: user.familyName || undefined,
        createdAt: now,
        updatedAt: now,
      };

      // Sanitize the profile data
      const sanitizationResult = dataSanitizationUtils.sanitizeProfileData(rawProfile);
      
      if (sanitizationResult.wasModified) {
        dataSanitizationUtils.logErrorWithPrivacyProtection(
          new Error('Profile data required sanitization'),
          'ProfileExtractor.extractGoogleProfile',
          { 
            modifications: sanitizationResult.modifications,
            provider: 'google'
          }
        );
      }

      // Validate the sanitized profile
      const validationResult = dataSanitizationUtils.validateRequiredFields(sanitizationResult.sanitizedProfile);
      
      if (!validationResult.isValid) {
        const errorMessage = `Profile validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`;
        dataSanitizationUtils.logErrorWithPrivacyProtection(
          new Error(errorMessage),
          'ProfileExtractor.extractGoogleProfile',
          { 
            provider: 'google',
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
          'ProfileExtractor.extractGoogleProfile',
          { 
            provider: 'google',
            warnings: validationResult.warnings
          }
        );
      }

      return sanitizationResult.sanitizedProfile as UserProfile;
    } catch (error) {
      dataSanitizationUtils.logErrorWithPrivacyProtection(
        error,
        'ProfileExtractor.extractGoogleProfile',
        { provider: 'google' }
      );
      throw error;
    }
  }

  /**
   * Extracts profile data from Apple OAuth response
   * Requirements: 1.1, 1.2, 5.4, 5.5
   */
  extractAppleProfile(appleResponse: AppleAuthenticationCredential): UserProfile {
    try {
      const now = new Date();
      
      // Extract name components from Apple response
      const firstName = appleResponse.fullName?.givenName || undefined;
      const lastName = appleResponse.fullName?.familyName || undefined;
      
      // Construct display name from available name components
      let displayName = '';
      if (firstName && lastName) {
        displayName = `${firstName} ${lastName}`.trim();
      } else if (firstName) {
        displayName = firstName;
      } else if (lastName) {
        displayName = lastName;
      }
      
      // Use email as fallback if no name is available
      const email = appleResponse.email || '';
      if (!displayName && email) {
        displayName = this.extractEmailPrefix(email);
      }
      
      const rawProfile: Partial<UserProfile> = {
        id: appleResponse.user,
        displayName,
        email,
        providerId: appleResponse.user,
        providerType: 'apple',
        avatarUrl: undefined, // Apple doesn't provide avatar URLs
        firstName,
        lastName,
        createdAt: now,
        updatedAt: now,
      };

      // Sanitize the profile data
      const sanitizationResult = dataSanitizationUtils.sanitizeProfileData(rawProfile);
      
      if (sanitizationResult.wasModified) {
        dataSanitizationUtils.logErrorWithPrivacyProtection(
          new Error('Profile data required sanitization'),
          'ProfileExtractor.extractAppleProfile',
          { 
            modifications: sanitizationResult.modifications,
            provider: 'apple'
          }
        );
      }

      // Validate the sanitized profile
      const validationResult = dataSanitizationUtils.validateRequiredFields(sanitizationResult.sanitizedProfile);
      
      if (!validationResult.isValid) {
        const errorMessage = `Profile validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`;
        dataSanitizationUtils.logErrorWithPrivacyProtection(
          new Error(errorMessage),
          'ProfileExtractor.extractAppleProfile',
          { 
            provider: 'apple',
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
          'ProfileExtractor.extractAppleProfile',
          { 
            provider: 'apple',
            warnings: validationResult.warnings
          }
        );
      }

      return sanitizationResult.sanitizedProfile as UserProfile;
    } catch (error) {
      dataSanitizationUtils.logErrorWithPrivacyProtection(
        error,
        'ProfileExtractor.extractAppleProfile',
        { provider: 'apple' }
      );
      throw error;
    }
  }

  /**
   * Validates profile data to ensure required fields are present
   * Requirements: 1.3, 5.4, 5.5
   */
  validateProfile(profile: UserProfile): boolean {
    try {
      const validationResult = dataSanitizationUtils.validateRequiredFields(profile);
      
      if (!validationResult.isValid) {
        dataSanitizationUtils.logErrorWithPrivacyProtection(
          new Error('Profile validation failed'),
          'ProfileExtractor.validateProfile',
          { 
            errorCount: validationResult.errors.length,
            warningCount: validationResult.warnings.length
          }
        );
      }

      // Log warnings if any
      if (validationResult.warnings.length > 0) {
        dataSanitizationUtils.logErrorWithPrivacyProtection(
          new Error('Profile validation warnings'),
          'ProfileExtractor.validateProfile',
          { warnings: validationResult.warnings }
        );
      }

      return validationResult.isValid;
    } catch (error) {
      dataSanitizationUtils.logErrorWithPrivacyProtection(
        error,
        'ProfileExtractor.validateProfile'
      );
      return false;
    }
  }

  /**
   * Creates a fallback profile using email prefix when name data is unavailable
   * Requirements: 1.4, 5.4, 5.5
   */
  createFallbackProfile(email: string, providerId: string, providerType: OAuthProviderType): UserProfile {
    try {
      if (!email || !this.isValidEmail(email)) {
        throw new Error('Valid email is required for fallback profile');
      }
      
      if (!providerId || providerId.trim() === '') {
        throw new Error('Provider ID is required for fallback profile');
      }
      
      const now = new Date();
      const displayName = this.extractEmailPrefix(email);
      
      const rawProfile: Partial<UserProfile> = {
        id: providerId,
        displayName,
        email,
        providerId,
        providerType,
        avatarUrl: undefined,
        firstName: undefined,
        lastName: undefined,
        createdAt: now,
        updatedAt: now,
      };

      // Sanitize the fallback profile data
      const sanitizationResult = dataSanitizationUtils.sanitizeProfileData(rawProfile);
      
      if (sanitizationResult.wasModified) {
        dataSanitizationUtils.logErrorWithPrivacyProtection(
          new Error('Fallback profile data required sanitization'),
          'ProfileExtractor.createFallbackProfile',
          { 
            modifications: sanitizationResult.modifications,
            provider: providerType
          }
        );
      }

      // Validate the sanitized fallback profile
      const validationResult = dataSanitizationUtils.validateRequiredFields(sanitizationResult.sanitizedProfile);
      
      if (!validationResult.isValid) {
        const errorMessage = `Fallback profile validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`;
        dataSanitizationUtils.logErrorWithPrivacyProtection(
          new Error(errorMessage),
          'ProfileExtractor.createFallbackProfile',
          { 
            provider: providerType,
            errorCount: validationResult.errors.length
          }
        );
        throw new Error(errorMessage);
      }

      return sanitizationResult.sanitizedProfile as UserProfile;
    } catch (error) {
      dataSanitizationUtils.logErrorWithPrivacyProtection(
        error,
        'ProfileExtractor.createFallbackProfile',
        { provider: providerType }
      );
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  /**
   * Extracts display name with fallback to email prefix
   */
  private extractDisplayName(name: string | null | undefined, email: string): string {
    if (name && name.trim() !== '') {
      return name.trim();
    }
    
    return this.extractEmailPrefix(email);
  }

  /**
   * Extracts username from email address for fallback display name
   */
  private extractEmailPrefix(email: string): string {
    if (!email || typeof email !== 'string') {
      return 'User';
    }
    
    const atIndex = email.indexOf('@');
    if (atIndex === -1) {
      return 'User';
    }
    
    const prefix = email.substring(0, atIndex).trim();
    if (prefix === '') {
      return 'User';
    }
    
    // Capitalize first letter and replace common separators with spaces
    return prefix
      .replace(/[._-]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Basic email validation
   */
  private isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }
}

// Export singleton instance
export const profileExtractor = new ProfileExtractor();