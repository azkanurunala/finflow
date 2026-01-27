/**
 * TypeScript interfaces for Social Auth Profile Fix
 * Requirements: 1.1, 1.2, 6.1
 */

// OAuth Provider Types
export type OAuthProviderType = 'google' | 'apple';

// User Profile Model
export interface UserProfile {
  id: string;                    // Unique identifier
  displayName: string;           // Primary display name
  email: string;                 // User email address
  providerId: string;            // OAuth provider user ID
  providerType: OAuthProviderType; // OAuth provider type
  avatarUrl?: string;            // Profile picture URL
  firstName?: string;            // Given name (from Apple)
  lastName?: string;             // Family name (from Apple)
  createdAt: Date;              // Profile creation timestamp
  updatedAt: Date;              // Last update timestamp
}

// OAuth Response Models

// Google OAuth Response
export interface GoogleSignInResult {
  type: 'success' | 'cancel';
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    name: string;
    givenName: string;
    familyName: string;
    email: string;
    photoUrl: string;
  };
}

// Apple OAuth Response (from expo-apple-authentication)
export interface AppleAuthenticationCredential {
  user: string;
  email: string | null;
  fullName: {
    givenName: string | null;
    familyName: string | null;
    middleName: string | null;
    namePrefix: string | null;
    nameSuffix: string | null;
    nickname: string | null;
  } | null;
  identityToken: string | null;
  authorizationCode: string | null;
  realUserStatus: number;
  state: string | null;
}

// OAuth Service Interfaces
export interface OAuthTokens {
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
}

export interface AuthResult {
  user: UserProfile;
  tokens: OAuthTokens;
}

export interface OAuthService {
  signInWithGoogle(): Promise<AuthResult>;
  signInWithApple(): Promise<AuthResult>;
  extractProfileData(oauthResponse: any): UserProfile;
}

// Profile Data Extractor Interface
export interface ProfileExtractor {
  extractGoogleProfile(googleResponse: GoogleSignInResult): UserProfile;
  extractAppleProfile(appleResponse: AppleAuthenticationCredential): UserProfile;
  validateProfile(profile: UserProfile): boolean;
  createFallbackProfile(email: string, providerId: string, providerType: OAuthProviderType): UserProfile;
}

// Enhanced AuthContext Interface
export interface AuthContextType {
  user: UserProfile | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  signInWithGoogle(): Promise<void>;
  signInWithApple(): Promise<void>;
  signOut(): Promise<void>;
  updateProfile(profile: Partial<UserProfile>): Promise<void>;
  loading: boolean;
  error: string | null;
}

export interface AuthState {
  user: UserProfile | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
}

// Profile Storage Manager Interface
export interface ProfileStorageManager {
  saveProfile(profile: UserProfile): Promise<void>;
  loadProfile(userId: string): Promise<UserProfile | null>;
  updateProfile(userId: string, updates: Partial<UserProfile>): Promise<void>;
  clearProfile(userId: string): Promise<void>;
}

// Storage Schema
export const AUTH_STORAGE_KEYS = {
  USER_PROFILE: '@finflow/user_profile',
  AUTH_STATE: '@finflow/auth_state',
  OAUTH_TOKENS: '@finflow/oauth_tokens'
} as const;

// Stored Profile Data
export interface StoredProfile {
  profile: UserProfile;
  metadata: {
    version: string;
    lastSync: Date;
    source: OAuthProviderType;
  };
}

// Error Types
export interface AuthError {
  code: string;
  message: string;
  details?: any;
}

export interface ProfileValidationError extends AuthError {
  field: string;
  value: any;
}