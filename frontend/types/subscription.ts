/**
 * TypeScript interfaces for Payment & Subscription Integration
 * Requirements: 1.6, 8.1, 8.5
 */

// Subscription Tier Types
export type SubscriptionTierType = 'free' | 'pro_monthly' | 'pro_yearly' | 'trial' | 'coupon';
export type SubscriptionStatusType = 'active' | 'expired' | 'trial' | 'cancelled';
export type PlatformType = 'ios' | 'android';
export type DurationType = 'monthly' | 'yearly';

// Core Subscription Interfaces

export interface SubscriptionTier {
  id: string;                    // Unique tier identifier
  name: string;                  // Display name (e.g., "Pro Monthly")
  productId: string;             // Store product ID (e.g., "com.finflow.pro.monthly")
  price: string;                 // Formatted price from store (e.g., "$9.99")
  currency: string;              // Currency code (e.g., "USD")
  duration: DurationType;        // Billing period
  features: string[];            // List of features included
  isPopular?: boolean;           // Whether to show "Popular" badge
}

export interface SubscriptionStatus {
  tier: SubscriptionTierType;    // Current subscription tier
  status: SubscriptionStatusType; // Current status
  startDate: Date;               // Subscription start date
  endDate: Date;                 // Subscription end/expiration date
  autoRenew: boolean;            // Whether auto-renewal is enabled
  trialUsed: boolean;            // Whether user has used their trial
}

export interface SubscriptionState {
  currentTier: SubscriptionTierType;     // Current active tier
  status: SubscriptionStatusType;        // Current subscription status
  expirationDate: Date | null;           // When current subscription expires
  trialUsed: boolean;                    // Whether user has used trial
  availableTiers: SubscriptionTier[];    // Available subscription options
  isLoading: boolean;                    // Loading state for async operations
  error: string | null;                  // Current error message
  lastUpdated: Date | null;              // Last time data was refreshed
}

// Payment and Purchase Interfaces

export interface PurchaseResult {
  success: boolean;              // Whether purchase was successful
  transactionId?: string;        // Store transaction identifier
  receipt?: string;              // Purchase receipt/token
  error?: string;                // Error message if failed
  cancelled?: boolean;           // Whether user cancelled purchase
  productId?: string;            // Product ID that was purchased
}

export interface ValidationResult {
  valid: boolean;                // Whether receipt is valid
  subscriptionStatus?: SubscriptionStatus; // Updated subscription info
  error?: string;                // Validation error message
}

export interface RestoreResult {
  success: boolean;              // Whether restore was successful
  restoredPurchases: number;     // Number of purchases restored
  subscriptionStatus?: SubscriptionStatus; // Updated subscription info
  error?: string;                // Error message if failed
}

// Trial System Interfaces

export interface TrialResult {
  success: boolean;              // Whether trial activation was successful
  trialEndDate?: Date;           // When trial expires
  error?: string;                // Error message if failed
  alreadyUsed?: boolean;         // Whether user already used trial
}

// Coupon System Interfaces

export interface CouponResult {
  success: boolean;              // Whether coupon redemption was successful
  couponCode?: string;           // The redeemed coupon code
  expirationDate?: Date;         // When coupon access expires
  error?: string;                // Error message if failed
  alreadyRedeemed?: boolean;     // Whether coupon was already used
  invalidCode?: boolean;         // Whether coupon code is invalid
}

// Context Actions Interface

export interface SubscriptionActions {
  // Core subscription management
  loadSubscriptionStatus(): Promise<void>;
  refreshEntitlements(): Promise<void>;
  
  // Purchase operations
  purchaseSubscription(productId: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<RestoreResult>;
  
  // Trial operations
  startTrial(): Promise<TrialResult>;
  
  // Coupon operations
  redeemCoupon(code: string): Promise<CouponResult>;
  
  // Utility actions
  clearError(): void;
  setLoading(loading: boolean): void;
}

// Entitlement Management

export interface UserEntitlements {
  hasAICategories: boolean;      // Access to AI-powered categorization
  hasAnalytics: boolean;         // Access to advanced analytics
  hasExport: boolean;            // Access to data export features
  hasUnlimitedTransactions: boolean; // No transaction limits
  maxTransactions?: number;      // Transaction limit for free tier
}

// API Client Interfaces

export interface SubscriptionApiClient {
  getSubscriptionStatus(): Promise<SubscriptionStatus>;
  getAvailableTiers(): Promise<SubscriptionTier[]>;
  validatePurchase(receipt: string, platform: PlatformType): Promise<ValidationResult>;
  startTrial(): Promise<TrialResult>;
  redeemCoupon(code: string): Promise<CouponResult>;
}

// Payment Service Interfaces

export interface PaymentService {
  // Product management
  getProducts(): Promise<SubscriptionTier[]>;
  
  // Purchase operations
  purchaseProduct(productId: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<RestoreResult>;
  
  // Validation
  validateReceipt(receipt: string): Promise<ValidationResult>;
  
  // Platform detection
  getPlatform(): PlatformType;
}

// Context Provider Interface

export interface SubscriptionContextType {
  state: SubscriptionState;
  actions: SubscriptionActions;
  utilityActions?: {
    resetSubscriptionData: () => Promise<void>;
  };
}

// Error Types

export interface SubscriptionError {
  code: string;                  // Error code for programmatic handling
  message: string;               // User-friendly error message
  details?: any;                 // Additional error details
  retryable?: boolean;           // Whether operation can be retried
}

export interface PaymentError extends SubscriptionError {
  transactionId?: string;        // Failed transaction ID
  productId?: string;            // Product that failed to purchase
}

export interface NetworkError extends SubscriptionError {
  offline?: boolean;             // Whether device is offline
  timeout?: boolean;             // Whether request timed out
}

// Storage and Caching

export interface CachedSubscriptionData {
  subscriptionStatus: SubscriptionStatus;
  availableTiers: SubscriptionTier[];
  userEntitlements: UserEntitlements;
  cacheTimestamp: Date;
  expiresAt: Date;
}

// Constants

export const SUBSCRIPTION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
export const PRODUCT_CACHE_DURATION = 60 * 60 * 1000;     // 1 hour in milliseconds

export const SUBSCRIPTION_STORAGE_KEYS = {
  SUBSCRIPTION_STATUS: '@finflow/subscription_status',
  AVAILABLE_TIERS: '@finflow/available_tiers',
  USER_ENTITLEMENTS: '@finflow/user_entitlements',
  SUBSCRIPTION_CACHE: '@finflow/subscription_cache'
} as const;

// Product IDs (must match store configuration)
export const PRODUCT_IDS = {
  PRO_MONTHLY: 'com.finflow.pro.monthly',
  PRO_YEARLY: 'com.finflow.pro.yearly'
} as const;

// Feature flags for entitlement checking
export const FEATURES = {
  AI_CATEGORIES: 'ai_categories',
  ANALYTICS: 'analytics',
  EXPORT: 'export',
  UNLIMITED_TRANSACTIONS: 'unlimited_transactions'
} as const;

// Coupon validation pattern
export const COUPON_CODE_PATTERN = /^FINFLOW-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

// Trial duration (14 days)
export const TRIAL_DURATION_DAYS = 14;