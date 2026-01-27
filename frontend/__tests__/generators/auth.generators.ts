/**
 * Fast-check generators for Social Auth Profile Fix testing
 * Provides smart generators for OAuth responses and profile data
 * Requirements: 1.1, 1.2, 6.1
 */

import fc from 'fast-check';
import { 
  UserProfile, 
  GoogleSignInResult, 
  AppleAuthenticationCredential, 
  OAuthProviderType,
  StoredProfile 
} from '../../types/auth';

// Basic generators
export const oauthProviderTypeGen = (): fc.Arbitrary<OAuthProviderType> =>
  fc.constantFrom('google', 'apple');

export const emailGen = (): fc.Arbitrary<string> =>
  fc.emailAddress();

export const nonEmptyStringGen = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 1, maxLength: 100 });

export const optionalStringGen = (): fc.Arbitrary<string | null> =>
  fc.option(nonEmptyStringGen(), { nil: null });

export const urlGen = (): fc.Arbitrary<string> =>
  fc.webUrl();

export const dateGen = (): fc.Arbitrary<Date> =>
  fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') });

// User Profile generators
export const userProfileGen = (): fc.Arbitrary<UserProfile> =>
  fc.record({
    id: nonEmptyStringGen(),
    displayName: nonEmptyStringGen(),
    email: emailGen(),
    providerId: nonEmptyStringGen(),
    providerType: oauthProviderTypeGen(),
    avatarUrl: fc.option(urlGen(), { nil: undefined }),
    firstName: fc.option(nonEmptyStringGen(), { nil: undefined }),
    lastName: fc.option(nonEmptyStringGen(), { nil: undefined }),
    createdAt: dateGen(),
    updatedAt: dateGen(),
  });

// Generate profile with missing display name (for fallback testing)
export const userProfileWithMissingNameGen = (): fc.Arbitrary<Partial<UserProfile>> =>
  fc.record({
    id: nonEmptyStringGen(),
    displayName: fc.constant(''), // Empty display name
    email: emailGen(),
    providerId: nonEmptyStringGen(),
    providerType: oauthProviderTypeGen(),
    avatarUrl: fc.option(urlGen(), { nil: undefined }),
    firstName: fc.option(fc.constant(''), { nil: undefined }), // Empty first name
    lastName: fc.option(fc.constant(''), { nil: undefined }), // Empty last name
    createdAt: dateGen(),
    updatedAt: dateGen(),
  });

// Google OAuth Response generators
export const googleUserGen = (): fc.Arbitrary<GoogleSignInResult['user']> =>
  fc.record({
    id: nonEmptyStringGen(),
    name: nonEmptyStringGen(),
    givenName: nonEmptyStringGen(),
    familyName: nonEmptyStringGen(),
    email: emailGen(),
    photoUrl: urlGen(),
  });

export const googleSignInSuccessGen = (): fc.Arbitrary<GoogleSignInResult> =>
  fc.record({
    type: fc.constant('success' as const),
    accessToken: fc.option(nonEmptyStringGen(), { nil: undefined }),
    idToken: fc.option(nonEmptyStringGen(), { nil: undefined }),
    refreshToken: fc.option(nonEmptyStringGen(), { nil: undefined }),
    user: fc.option(googleUserGen(), { nil: undefined }),
  });

export const googleSignInCancelGen = (): fc.Arbitrary<GoogleSignInResult> =>
  fc.record({
    type: fc.constant('cancel' as const),
    accessToken: fc.constant(undefined),
    idToken: fc.constant(undefined),
    refreshToken: fc.constant(undefined),
    user: fc.constant(undefined),
  });

export const googleSignInResultGen = (): fc.Arbitrary<GoogleSignInResult> =>
  fc.oneof(googleSignInSuccessGen(), googleSignInCancelGen());

// Apple OAuth Response generators
export const appleFullNameGen = (): fc.Arbitrary<AppleAuthenticationCredential['fullName']> =>
  fc.option(
    fc.record({
      givenName: optionalStringGen(),
      familyName: optionalStringGen(),
      middleName: optionalStringGen(),
      namePrefix: optionalStringGen(),
      nameSuffix: optionalStringGen(),
      nickname: optionalStringGen(),
    }),
    { nil: null }
  );

export const appleAuthCredentialGen = (): fc.Arbitrary<AppleAuthenticationCredential> =>
  fc.record({
    user: nonEmptyStringGen(),
    email: optionalStringGen(),
    fullName: appleFullNameGen(),
    identityToken: optionalStringGen(),
    authorizationCode: optionalStringGen(),
    realUserStatus: fc.integer({ min: 0, max: 2 }),
    state: optionalStringGen(),
  });

// Malformed data generators (for validation testing)
export const malformedEmailGen = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constant(''),
    fc.constant('invalid-email'),
    fc.constant('@domain.com'),
    fc.constant('user@'),
    fc.string({ maxLength: 5 }) // Too short to be valid email
  );

export const malformedProfileGen = (): fc.Arbitrary<Partial<UserProfile>> =>
  fc.record({
    id: fc.option(fc.constant(''), { nil: undefined }), // Empty or missing ID
    displayName: fc.option(fc.constant(''), { nil: undefined }), // Empty or missing name
    email: fc.oneof(malformedEmailGen(), fc.constant(undefined as any)), // Invalid email
    providerId: fc.option(fc.constant(''), { nil: undefined }), // Empty provider ID
    providerType: fc.option(fc.constant('invalid' as any), { nil: undefined }), // Invalid provider
    avatarUrl: fc.option(fc.constant('not-a-url'), { nil: undefined }), // Invalid URL
    createdAt: fc.option(fc.constant(new Date('invalid')), { nil: undefined }), // Invalid date
    updatedAt: fc.option(fc.constant(new Date('invalid')), { nil: undefined }), // Invalid date
  });

// Storage-related generators
export const storedProfileGen = (): fc.Arbitrary<StoredProfile> =>
  fc.record({
    profile: userProfileGen(),
    metadata: fc.record({
      version: fc.string({ minLength: 1, maxLength: 10 }),
      lastSync: dateGen(),
      source: oauthProviderTypeGen(),
    }),
  });

// Network error simulation generators
export const networkErrorGen = (): fc.Arbitrary<Error> =>
  fc.oneof(
    fc.constant(new Error('Network request failed')),
    fc.constant(new Error('Timeout')),
    fc.constant(new Error('Connection refused')),
    fc.constant(new Error('DNS resolution failed'))
  );

// OAuth API error simulation generators
export const oauthErrorGen = (): fc.Arbitrary<Error> =>
  fc.oneof(
    fc.constant(new Error('OAuth provider unavailable')),
    fc.constant(new Error('Invalid credentials')),
    fc.constant(new Error('Permission denied')),
    fc.constant(new Error('Rate limit exceeded'))
  );

// Long name generators (for UI truncation testing)
export const longNameGen = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 50, maxLength: 200 });

export const userProfileWithLongNameGen = (): fc.Arbitrary<UserProfile> =>
  fc.record({
    id: nonEmptyStringGen(),
    displayName: longNameGen(),
    email: emailGen(),
    providerId: nonEmptyStringGen(),
    providerType: oauthProviderTypeGen(),
    avatarUrl: fc.option(urlGen(), { nil: undefined }),
    firstName: fc.option(longNameGen(), { nil: undefined }),
    lastName: fc.option(longNameGen(), { nil: undefined }),
    createdAt: dateGen(),
    updatedAt: dateGen(),
  });

// Existing user data generators (for migration testing)
export const existingUserDataGen = (): fc.Arbitrary<any> =>
  fc.record({
    user_id: nonEmptyStringGen(),
    email: emailGen(),
    name: fc.option(nonEmptyStringGen(), { nil: undefined }), // May or may not have name
    picture: fc.option(urlGen(), { nil: undefined }),
    // Missing profile data that needs to be migrated
  });