/**
 * Main types export file
 * Centralizes all type definitions for easy importing
 */

// Re-export all auth-related types
export * from './auth';

// Re-export subscription-related types with explicit naming to avoid conflicts
export * from './subscription';

// Additional utility types for the project
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Common response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Network and sync related types
export interface NetworkState {
  isOnline: boolean;
  isReachable: boolean;
}

// Configuration types
export interface OAuthConfig {
  googleClientId?: string;
  appleClientId?: string;
  scopes: string[];
}