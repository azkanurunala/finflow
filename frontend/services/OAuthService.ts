/**
 * OAuthService - Handles OAuth authentication with Google and Apple
 * Requirements: 1.5, 5.1, 5.2, 5.3
 */

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { 
  OAuthService as IOAuthService, 
  AuthResult, 
  UserProfile, 
  GoogleSignInResult, 
  AppleAuthenticationCredential,
  OAuthTokens,
  AuthError
} from '../types/auth';
import { profileExtractor } from './ProfileExtractor';

/**
 * Configuration for OAuth operations
 */
interface OAuthConfig {
  timeout: number; // Timeout in milliseconds
  maxRetries: number; // Maximum retry attempts
  retryDelay: number; // Base delay between retries in milliseconds
}

const DEFAULT_CONFIG: OAuthConfig = {
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
};

export class OAuthService implements IOAuthService {
  private config: OAuthConfig;

  constructor(config: Partial<OAuthConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Sign in with Google OAuth
   * Requirements: 1.5, 5.1, 5.2, 5.3
   */
  async signInWithGoogle(): Promise<AuthResult> {
    return this.withRetry(async () => {
      return this.withTimeout(async () => {
        try {
          // Configure Google Sign-In
          GoogleSignin.configure({
            webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
            iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
            scopes: ['profile', 'email'],
          });

          // Check if device supports Google Play Services (Android)
          await GoogleSignin.hasPlayServices();

          // Sign in
          const result = await GoogleSignin.signIn();
          const tokens = await GoogleSignin.getTokens();

          // Type assertion for Google Sign-In result
          const userInfo = (result as any).user || result;

          // Create GoogleSignInResult format for ProfileExtractor
          const googleResponse: GoogleSignInResult = {
            type: 'success',
            accessToken: tokens.accessToken,
            idToken: tokens.idToken,
            user: {
              id: userInfo.id,
              name: userInfo.name || '',
              givenName: userInfo.givenName || '',
              familyName: userInfo.familyName || '',
              email: userInfo.email,
              photoUrl: userInfo.photo || '',
            },
          };

          // Extract profile using ProfileExtractor
          const profile = profileExtractor.extractGoogleProfile(googleResponse);

          // Validate profile
          if (!profileExtractor.validateProfile(profile)) {
            // Create fallback profile if validation fails
            const fallbackProfile = profileExtractor.createFallbackProfile(
              userInfo.email,
              userInfo.id,
              'google'
            );
            
            return {
              user: fallbackProfile,
              tokens: {
                accessToken: tokens.accessToken,
                idToken: tokens.idToken,
              },
            };
          }

          return {
            user: profile,
            tokens: {
              accessToken: tokens.accessToken,
              idToken: tokens.idToken,
            },
          };

        } catch (error: any) {
          // Handle specific Google Sign-In errors
          if (error.code === statusCodes.SIGN_IN_CANCELLED) {
            throw new Error('User cancelled Google authentication');
          } else if (error.code === statusCodes.IN_PROGRESS) {
            throw new Error('Google sign-in already in progress');
          } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
            throw new Error('Google Play Services not available');
          }

          this.logError('Google OAuth error', error);
          throw this.createAuthError('GOOGLE_OAUTH_FAILED', 'Google authentication failed', error);
        }
      }, 'Google OAuth');
    }, 'Google OAuth');
  }

  /**
   * Sign in with Apple OAuth
   * Requirements: 1.5, 5.1, 5.2, 5.3
   */
  async signInWithApple(): Promise<AuthResult> {
    return this.withRetry(async () => {
      return this.withTimeout(async () => {
        try {
          // Check if Apple Authentication is available
          if (Platform.OS !== 'ios') {
            throw new Error('Apple authentication is only available on iOS');
          }

          const isAvailable = await AppleAuthentication.isAvailableAsync();
          if (!isAvailable) {
            throw new Error('Apple authentication is not available on this device');
          }

          // Request Apple authentication
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });

          // Extract profile using ProfileExtractor
          const profile = profileExtractor.extractAppleProfile(credential);

          // Validate profile
          if (!profileExtractor.validateProfile(profile)) {
            // Create fallback profile if validation fails
            const email = credential.email || '';
            const fallbackProfile = profileExtractor.createFallbackProfile(
              email,
              credential.user,
              'apple'
            );
            
            return {
              user: fallbackProfile,
              tokens: {
                idToken: credential.identityToken || undefined,
              },
            };
          }

          return {
            user: profile,
            tokens: {
              idToken: credential.identityToken || undefined,
            },
          };

        } catch (error) {
          this.logError('Apple OAuth error', error);
          throw this.createAuthError('APPLE_OAUTH_FAILED', 'Apple authentication failed', error);
        }
      }, 'Apple OAuth');
    }, 'Apple OAuth');
  }

  /**
   * Extract profile data from OAuth response (legacy method for compatibility)
   * Requirements: 1.1, 1.2
   */
  extractProfileData(oauthResponse: any): UserProfile {
    // Determine provider type and delegate to ProfileExtractor
    if (oauthResponse.type === 'success' && oauthResponse.user) {
      // Google response format
      return profileExtractor.extractGoogleProfile(oauthResponse as GoogleSignInResult);
    } else if (oauthResponse.user && oauthResponse.identityToken) {
      // Apple response format
      return profileExtractor.extractAppleProfile(oauthResponse as AppleAuthenticationCredential);
    } else {
      throw new Error('Unsupported OAuth response format');
    }
  }

  /**
   * Retry mechanism with exponential backoff
   * Requirements: 5.2
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry user cancellation or certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        if (attempt === this.config.maxRetries) {
          this.logError(`${operationName} failed after ${this.config.maxRetries} attempts`, lastError);
          throw lastError;
        }
        
        // Exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        this.logError(`${operationName} attempt ${attempt} failed, retrying in ${delay}ms`, error);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Timeout wrapper for operations
   * Requirements: 5.3
   */
  private async withTimeout<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${operationName} timed out after ${this.config.timeout}ms`));
        }, this.config.timeout);
      }),
    ]);
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    
    // Don't retry user cancellations
    if (errorMessage.includes('cancel') || errorMessage.includes('user_cancel')) {
      return true;
    }
    
    // Don't retry authentication unavailable errors
    if (errorMessage.includes('not available') || errorMessage.includes('unavailable')) {
      return true;
    }
    
    // Don't retry invalid configuration errors
    if (errorMessage.includes('configuration') || errorMessage.includes('client_id')) {
      return true;
    }
    
    return false;
  }

  /**
   * Create standardized auth error
   */
  private createAuthError(code: string, message: string, originalError?: any): AuthError {
    return {
      code,
      message,
      details: originalError,
    };
  }

  /**
   * Log errors while protecting user privacy
   * Requirements: 5.5
   */
  private logError(message: string, error: any): void {
    // Create sanitized error for logging
    const sanitizedError = {
      message: error?.message || 'Unknown error',
      code: error?.code || 'UNKNOWN',
      // Don't log sensitive data like tokens, emails, or personal info
    };
    
    console.error(`[OAuthService] ${message}:`, sanitizedError);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const oauthService = new OAuthService();