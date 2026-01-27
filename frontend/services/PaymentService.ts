/**
 * Payment Service
 * Handles platform-specific payment integration using react-native-purchases
 * Validates: Requirements 2.1, 2.2, 2.4, 2.6
 */

import { Platform } from 'react-native';
import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL
} from 'react-native-purchases';
import {
  PaymentService as IPaymentService,
  PurchaseResult,
  RestoreResult,
  ValidationResult,
  SubscriptionTier,
  PlatformType
} from '../types/subscription';
import { subscriptionApiClient } from './SubscriptionApiClient';

/**
 * Configuration for RevenueCat SDK
 * Note: API keys should be configured in environment variables
 */
const REVENUECAT_CONFIG = {
  // These should be set via environment variables in production
  IOS_API_KEY: process.env.REVENUECAT_IOS_API_KEY || 'appl_YOUR_IOS_KEY',
  ANDROID_API_KEY: process.env.REVENUECAT_ANDROID_API_KEY || 'goog_YOUR_ANDROID_KEY',
  LOG_LEVEL: __DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO
};

/**
 * Error messages for payment operations
 */
const ERROR_MESSAGES = {
  STORE_UNAVAILABLE: 'Store is currently unavailable. Please try again later.',
  NO_PRODUCTS: 'No subscription products available at this time.',
  PURCHASE_FAILED: 'Purchase failed. Please try again.',
  RESTORE_FAILED: 'Failed to restore purchases. Please try again.',
  VALIDATION_FAILED: 'Failed to validate purchase receipt.',
  NOT_INITIALIZED: 'Payment service is not initialized.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  USER_CANCELLED: 'Purchase was cancelled.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.'
};

/**
 * Payment Service Implementation
 * Handles all native payment operations using react-native-purchases (RevenueCat)
 */
class PaymentService implements IPaymentService {
  private isInitialized: boolean = false;
  private currentOffering: PurchasesOffering | null = null;

  /**
   * Initialize the Purchases SDK
   * Should be called once when the app starts
   */
  async initialize(userId?: string): Promise<void> {
    try {
      const apiKey = Platform.OS === 'ios' 
        ? REVENUECAT_CONFIG.IOS_API_KEY 
        : REVENUECAT_CONFIG.ANDROID_API_KEY;

      // Configure SDK
      Purchases.setLogLevel(REVENUECAT_CONFIG.LOG_LEVEL);
      
      // Initialize with API key
      Purchases.configure({ apiKey });

      // Set user ID if provided (for cross-device purchase restoration)
      if (userId) {
        await Purchases.logIn(userId);
      }

      this.isInitialized = true;
      console.log('[PaymentService] Initialized successfully for platform:', Platform.OS);
    } catch (error) {
      console.error('[PaymentService] Failed to initialize:', error);
      throw new Error('Failed to initialize payment service');
    }
  }

  /**
   * Get platform type (iOS or Android)
   */
  getPlatform(): PlatformType {
    return Platform.OS === 'ios' ? 'ios' : 'android';
  }

  /**
   * Check if service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(ERROR_MESSAGES.NOT_INITIALIZED);
    }
  }

  /**
   * Get available subscription products from the store
   * Fetches current offerings from RevenueCat
   */
  async getProducts(): Promise<SubscriptionTier[]> {
    this.ensureInitialized();

    try {
      console.log('[PaymentService] Fetching products from store...');
      
      // Get current offerings from RevenueCat
      const offerings = await Purchases.getOfferings();
      
      if (!offerings.current || offerings.current.availablePackages.length === 0) {
        console.warn('[PaymentService] No offerings available');
        throw new Error(ERROR_MESSAGES.NO_PRODUCTS);
      }

      // Cache the current offering for later use
      this.currentOffering = offerings.current;

      // Transform RevenueCat packages to our SubscriptionTier format
      const tiers: SubscriptionTier[] = offerings.current.availablePackages.map(
        (pkg: PurchasesPackage) => this.transformPackageToTier(pkg)
      );

      console.log('[PaymentService] Successfully fetched', tiers.length, 'products');
      return tiers;
    } catch (error: any) {
      console.error('[PaymentService] Failed to fetch products:', error);
      
      // Check for specific error types
      if (error.message?.includes('network') || error.code === 'NETWORK_ERROR') {
        throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
      }
      
      throw new Error(error.message || ERROR_MESSAGES.STORE_UNAVAILABLE);
    }
  }

  /**
   * Transform RevenueCat package to SubscriptionTier
   */
  private transformPackageToTier(pkg: PurchasesPackage): SubscriptionTier {
    const product = pkg.product;
    const productId = product.identifier;
    
    // Determine duration from product ID
    const duration = productId.includes('yearly') ? 'yearly' : 'monthly';
    
    // Determine if this is the popular option (yearly is typically popular)
    const isPopular = duration === 'yearly';

    // Get features based on tier (all Pro features)
    const features = [
      'AI-powered transaction categorization',
      'Advanced analytics and insights',
      'Unlimited transactions',
      'Data export (CSV, PDF)',
      'Priority support'
    ];

    return {
      id: productId,
      name: pkg.identifier || (duration === 'yearly' ? 'Pro Yearly' : 'Pro Monthly'),
      productId: productId,
      price: product.priceString,
      currency: product.currencyCode,
      duration: duration,
      features: features,
      isPopular: isPopular
    };
  }

  /**
   * Purchase a subscription product
   * Initiates the native purchase flow and validates the receipt
   */
  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    this.ensureInitialized();

    try {
      console.log('[PaymentService] Starting purchase for product:', productId);

      // Find the package to purchase
      const packageToPurchase = this.findPackageByProductId(productId);
      if (!packageToPurchase) {
        throw new Error(`Product ${productId} not found in current offerings`);
      }

      // Initiate purchase through RevenueCat
      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(packageToPurchase);

      console.log('[PaymentService] Purchase successful:', productIdentifier);

      // Get the receipt/token for backend validation
      const receipt = await this.getReceiptData(customerInfo);

      // Validate with backend
      const validationResult = await this.validateReceipt(receipt);

      if (!validationResult.valid) {
        console.error('[PaymentService] Backend validation failed:', validationResult.error);
        return {
          success: false,
          error: validationResult.error || ERROR_MESSAGES.VALIDATION_FAILED,
          productId: productId
        };
      }

      return {
        success: true,
        transactionId: customerInfo.originalAppUserId,
        receipt: receipt,
        productId: productId
      };
    } catch (error: any) {
      console.error('[PaymentService] Purchase failed:', error);

      // Handle user cancellation
      if (error.userCancelled || error.code === '1') {
        return {
          success: false,
          cancelled: true,
          error: ERROR_MESSAGES.USER_CANCELLED,
          productId: productId
        };
      }

      // Handle network errors
      if (error.message?.includes('network') || error.code === 'NETWORK_ERROR') {
        return {
          success: false,
          error: ERROR_MESSAGES.NETWORK_ERROR,
          productId: productId
        };
      }

      // Handle store errors
      if (error.code === '2' || error.message?.includes('store')) {
        return {
          success: false,
          error: ERROR_MESSAGES.STORE_UNAVAILABLE,
          productId: productId
        };
      }

      return {
        success: false,
        error: error.message || ERROR_MESSAGES.PURCHASE_FAILED,
        productId: productId
      };
    }
  }

  /**
   * Find package by product ID from cached offerings
   */
  private findPackageByProductId(productId: string): PurchasesPackage | null {
    if (!this.currentOffering) {
      return null;
    }

    return this.currentOffering.availablePackages.find(
      pkg => pkg.product.identifier === productId
    ) || null;
  }

  /**
   * Get receipt data from customer info for backend validation
   */
  private async getReceiptData(customerInfo: CustomerInfo): Promise<string> {
    try {
      if (Platform.OS === 'ios') {
        // For iOS, get the receipt data
        // RevenueCat handles receipt fetching internally
        // We'll use the original app user ID as a proxy
        return customerInfo.originalAppUserId;
      } else {
        // For Android, get the purchase token
        // Get the most recent active entitlement
        const activeEntitlements = Object.values(customerInfo.entitlements.active);
        if (activeEntitlements.length > 0) {
          const latestEntitlement = activeEntitlements[0];
          return latestEntitlement.productIdentifier;
        }
        return customerInfo.originalAppUserId;
      }
    } catch (error) {
      console.error('[PaymentService] Failed to get receipt data:', error);
      return customerInfo.originalAppUserId;
    }
  }

  /**
   * Restore previous purchases
   * Useful for users who reinstalled the app or switched devices
   */
  async restorePurchases(): Promise<RestoreResult> {
    this.ensureInitialized();

    try {
      console.log('[PaymentService] Restoring purchases...');

      // Restore purchases through RevenueCat
      const customerInfo = await Purchases.restorePurchases();

      // Count active entitlements
      const activeEntitlements = Object.keys(customerInfo.entitlements.active);
      const restoredCount = activeEntitlements.length;

      console.log('[PaymentService] Restored', restoredCount, 'purchases');

      // If purchases were restored, validate with backend
      if (restoredCount > 0) {
        const receipt = await this.getReceiptData(customerInfo);
        const validationResult = await this.validateReceipt(receipt);

        if (validationResult.valid && validationResult.subscriptionStatus) {
          return {
            success: true,
            restoredPurchases: restoredCount,
            subscriptionStatus: validationResult.subscriptionStatus
          };
        }
      }

      return {
        success: true,
        restoredPurchases: restoredCount
      };
    } catch (error: any) {
      console.error('[PaymentService] Failed to restore purchases:', error);

      // Handle network errors
      if (error.message?.includes('network') || error.code === 'NETWORK_ERROR') {
        return {
          success: false,
          restoredPurchases: 0,
          error: ERROR_MESSAGES.NETWORK_ERROR
        };
      }

      return {
        success: false,
        restoredPurchases: 0,
        error: error.message || ERROR_MESSAGES.RESTORE_FAILED
      };
    }
  }

  /**
   * Validate purchase receipt with backend
   * All validation is performed server-side for security
   */
  async validateReceipt(receipt: string): Promise<ValidationResult> {
    try {
      console.log('[PaymentService] Validating receipt with backend...');

      const platform = this.getPlatform();
      const result = await subscriptionApiClient.validatePurchase(receipt, platform);

      console.log('[PaymentService] Validation result:', result.valid ? 'valid' : 'invalid');
      return result;
    } catch (error: any) {
      console.error('[PaymentService] Receipt validation failed:', error);
      
      return {
        valid: false,
        error: error.message || ERROR_MESSAGES.VALIDATION_FAILED
      };
    }
  }

  /**
   * Get current customer info from RevenueCat
   * Useful for checking subscription status
   */
  async getCustomerInfo(): Promise<CustomerInfo | null> {
    this.ensureInitialized();

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('[PaymentService] Failed to get customer info:', error);
      return null;
    }
  }

  /**
   * Check if user has active entitlement
   */
  async hasActiveEntitlement(entitlementId: string = 'pro'): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      if (!customerInfo) {
        return false;
      }

      return customerInfo.entitlements.active[entitlementId] !== undefined;
    } catch (error) {
      console.error('[PaymentService] Failed to check entitlement:', error);
      return false;
    }
  }

  /**
   * Log out current user (for user switching)
   */
  async logout(): Promise<void> {
    try {
      await Purchases.logOut();
      console.log('[PaymentService] User logged out');
    } catch (error) {
      console.error('[PaymentService] Failed to log out:', error);
    }
  }

  /**
   * Set user ID for cross-device purchase tracking
   */
  async setUserId(userId: string): Promise<void> {
    try {
      await Purchases.logIn(userId);
      console.log('[PaymentService] User ID set:', userId);
    } catch (error) {
      console.error('[PaymentService] Failed to set user ID:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
export default paymentService;
