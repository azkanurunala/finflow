/**
 * Display Name Utilities for Social Auth Profile Fix
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { UserProfile } from '../types/auth';

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  subscription_tier?: string;
  subscription_expires_at?: string;
  is_subscription_active?: boolean;
  onboarding_completed?: boolean;
  language?: string;
  currency?: string;
}

/**
 * Get display name with priority logic: OAuth profile name > user name > email prefix
 * Requirements: 3.1, 3.2
 */
export function getDisplayName(user: User | null, profile: UserProfile | null): string {
  // Priority 1: Profile display name from OAuth provider
  if (profile?.displayName && profile.displayName.trim()) {
    return profile.displayName.trim();
  }
  
  // Priority 2: User name from existing user data
  if (user?.name && user.name.trim()) {
    return user.name.trim();
  }
  
  // Priority 3: Email prefix as fallback
  if (user?.email) {
    return user.email.split('@')[0];
  }
  
  if (profile?.email) {
    return profile.email.split('@')[0];
  }
  
  // Final fallback
  return 'User';
}

/**
 * Get first name from display name for greetings
 * Requirements: 3.1, 3.2
 */
export function getFirstName(user: User | null, profile: UserProfile | null): string {
  // Try to get first name from profile data first
  if (profile?.firstName && profile.firstName.trim()) {
    return profile.firstName.trim();
  }
  
  // Extract first name from display name
  const displayName = getDisplayName(user, profile);
  const firstName = displayName.split(' ')[0];
  
  return firstName || 'there';
}

/**
 * Truncate long names with ellipsis for UI display
 * Requirements: 3.4
 */
export function truncateDisplayName(
  user: User | null, 
  profile: UserProfile | null, 
  maxLength: number = 20
): string {
  const displayName = getDisplayName(user, profile);
  
  if (displayName.length <= maxLength) {
    return displayName;
  }
  
  return displayName.substring(0, maxLength - 3) + '...';
}

/**
 * Get avatar URL with fallback to generated avatar
 * Requirements: 3.1, 3.2
 */
export function getAvatarUrl(user: User | null, profile: UserProfile | null): string {
  // Priority 1: Profile avatar URL from OAuth provider
  if (profile?.avatarUrl && profile.avatarUrl.trim()) {
    return profile.avatarUrl.trim();
  }
  
  // Priority 2: User picture from existing user data
  if (user?.picture && user.picture.trim()) {
    return user.picture.trim();
  }
  
  // Fallback: Generate avatar from display name
  const displayName = getDisplayName(user, profile);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
}

/**
 * Get initials for avatar display
 * Requirements: 3.1, 3.2
 */
export function getInitials(user: User | null, profile: UserProfile | null): string {
  const displayName = getDisplayName(user, profile);
  
  // Split name into words and take first letter of each
  const words = displayName.split(' ').filter(word => word.length > 0);
  
  if (words.length === 0) {
    return 'U';
  }
  
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  
  // Take first letter of first and last word
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

/**
 * Check if profile data is available and complete
 * Requirements: 3.1, 3.2
 */
export function hasCompleteProfile(profile: UserProfile | null): boolean {
  return !!(
    profile &&
    profile.displayName &&
    profile.displayName.trim() &&
    profile.email &&
    profile.email.trim()
  );
}

/**
 * Get display name for specific UI contexts with different truncation rules
 * Requirements: 3.3, 3.4
 */
export function getContextualDisplayName(
  user: User | null,
  profile: UserProfile | null,
  context: 'header' | 'profile' | 'chat' | 'greeting' = 'header'
): string {
  switch (context) {
    case 'header':
      // Short display for header (max 15 chars)
      return truncateDisplayName(user, profile, 15);
    
    case 'profile':
      // Full display name for profile screen
      return getDisplayName(user, profile);
    
    case 'chat':
      // First name only for chat greetings
      return getFirstName(user, profile);
    
    case 'greeting':
      // First name for greetings
      return getFirstName(user, profile);
    
    default:
      return getDisplayName(user, profile);
  }
}