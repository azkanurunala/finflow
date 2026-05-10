/**
 * Subscription API Client
 * Handles all backend communication for subscription operations
 * Validates: Requirements 1.1, 3.3, 4.5
 */

import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';
import {
  SubscriptionStatus,
  SubscriptionTier,
  ValidationResult,
  TrialResult,
  CouponResult,
  PlatformType,
  SubscriptionApiClient as ISubscriptionApiClient,
  NetworkError
} from '../types/subscription';

/**
 * Configuration for retry logic and error handling
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  timeoutMs: 10000 // 10 second timeout
};

/**
 * Network connectivity and retry utilities
 */
class RetryUtils {
  /**
   * Check if device has network connectivity
   */
  static async checkNetworkConnectivity(): Promise<boolean> {
    try {
      const netInfo = await NetInfo.fetch();
      return netInfo.isConnected === true && netInfo.isInternetReachable === true;
    } catch (error) {
      console.warn('[RetryUtils] Failed to check network connectivity:', error);
      // Assume connected if check fails to avoid blocking operations
      return true;
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  static calculateBackoffDelay(attempt: number): number {
    const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
    return Math.min(delay, RETRY_CONFIG.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Determine if error is retryable
   */
  static isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED') {
      return true;
    }

    // HTTP status codes that are retryable
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    if (error.response?.status && retryableStatusCodes.includes(error.response.status)) {
      return true;
    }

    // Timeout errors are retryable
    if (error.message?.includes('timeout') || error.code === 'ECONNABORTED') {
      return true;
    }

    return false;
  }

  /**
   * Create user-friendly error message.
   * Priority of `message`:
   *   1. Connectivity / timeout  (forced canonical copy + code)
   *   2. Backend-supplied FastAPI `detail` (or axios-style `data.message`) when the
   *      caller surfaces an actionable string (e.g. "Subscription not found",
   *      "Trial already used"). Preserved verbatim so call-sites can branch on it.
   *   3. HTTP-status fallback (429, 5xx).
   *   4. Operation-name fallback.
   */
  static createUserFriendlyError(error: any, operation: string): NetworkError {
    const isOffline = error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error');
    const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
    const backendDetail: string | undefined =
      error?.response?.data?.detail ?? error?.response?.data?.message;

    let message: string;
    let code: string;

    if (isOffline) {
      message = 'Network connection error. Please check your internet connection and try again.';
      code = 'NETWORK_ERROR';
    } else if (isTimeout) {
      message = 'Request timed out. Please try again.';
      code = 'TIMEOUT_ERROR';
    } else if (typeof backendDetail === 'string' && backendDetail.length > 0) {
      message = backendDetail;
      code = 'API_ERROR';
    } else if (error.response?.status === 429) {
      message = 'Too many requests. Please wait a moment and try again.';
      code = 'RATE_LIMITED';
    } else if (error.response?.status >= 500) {
      message = 'Our servers are experiencing issues. Please try again in a few moments.';
      code = 'SERVER_ERROR';
    } else {
      message = `Failed to ${operation}. Please try again.`;
      code = 'UNKNOWN_ERROR';
    }

    const friendly: any = new Error(message);
    friendly.code = code;
    friendly.details = error;
    friendly.retryable = isOffline || isTimeout || this.isRetryableError(error);
    friendly.offline = isOffline;
    friendly.timeout = isTimeout;
    return friendly as NetworkError;
  }
}

/**
 * Enhanced API request wrapper with retry logic and error handling
 */
class ApiRequestWrapper {
  /**
   * Execute API request with retry logic and error handling
   */
  static async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    operation: string
  ): Promise<T> {
    let lastError: any;

    // Check network connectivity before attempting request
    const isConnected = await RetryUtils.checkNetworkConnectivity();
    if (!isConnected) {
      throw RetryUtils.createUserFriendlyError(
        { code: 'NETWORK_ERROR', message: 'Network Error' },
        operation
      );
    }

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        // Set timeout for this specific request
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Request timeout after ${RETRY_CONFIG.timeoutMs}ms`));
          }, RETRY_CONFIG.timeoutMs);
        });

        // Race between the actual request and timeout
        const result = await Promise.race([
          requestFn(),
          timeoutPromise
        ]);

        return result;
      } catch (error: any) {
        lastError = error;
        
        console.warn(`[ApiRequestWrapper] ${operation} attempt ${attempt} failed:`, error);

        // If this is the last attempt or error is not retryable, throw
        if (attempt === RETRY_CONFIG.maxRetries || !RetryUtils.isRetryableError(error)) {
          break;
        }

        // Wait before retrying with exponential backoff
        const delay = RetryUtils.calculateBackoffDelay(attempt);
        console.log(`[ApiRequestWrapper] Retrying ${operation} in ${delay}ms (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries})`);
        await RetryUtils.sleep(delay);

        // Check connectivity again before retry
        const stillConnected = await RetryUtils.checkNetworkConnectivity();
        if (!stillConnected) {
          throw RetryUtils.createUserFriendlyError(
            { code: 'NETWORK_ERROR', message: 'Network Error' },
            operation
          );
        }
      }
    }

    // All retries failed, throw user-friendly error
    throw RetryUtils.createUserFriendlyError(lastError, operation);
  }
}

class SubscriptionApiClient implements ISubscriptionApiClient {
  /**
   * Get current subscription status from backend
   * Calls GET /subscription/status
   * Validates: Requirements 1.1
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    return ApiRequestWrapper.executeWithRetry(async () => {
      const response = await apiClient.get('/api/subscription/status');
      
      // Transform backend response to match our SubscriptionStatus interface
      const data = response.data;
      return {
        tier: data.tier || 'free',
        status: data.is_active ? 'active' : (data.is_trial ? 'trial' : 'expired'),
        startDate: data.start_date ? new Date(data.start_date) : new Date(),
        endDate: data.expires_at ? new Date(data.expires_at) : new Date(),
        autoRenew: data.auto_renew || false,
        trialUsed: data.trial_used || false
      };
    }, 'fetch subscription status');
  }

  /**
   * Get available subscription tiers from backend
   * Calls GET /subscription/tiers
   * Validates: Requirements 1.1
   */
  async getAvailableTiers(): Promise<SubscriptionTier[]> {
    return ApiRequestWrapper.executeWithRetry(async () => {
      const response = await apiClient.get('/api/subscription/tiers');
      
      // Transform backend response to match our SubscriptionTier interface
      const tiers = response.data.tiers || [];
      return tiers.map((tier: any, index: number) => ({
        id: tier.id || tier._id || `tier_${index}`,
        name: tier.name || 'Unknown Tier',
        productId: tier.product_id,
        price: tier.price || '$0.00',
        currency: tier.currency || 'USD',
        duration: tier.duration || 'monthly',
        features: tier.features || [],
        isPopular: tier.is_popular || false
      }));
    }, 'fetch available subscription tiers');
  }

  /**
   * Validate purchase receipt with backend
   * Calls POST /subscription/validate
   * Validates: Requirements 2.3
   */
  async validatePurchase(receipt: string, platform: PlatformType): Promise<ValidationResult> {
    try {
      return await ApiRequestWrapper.executeWithRetry(async () => {
        const payload = {
          platform,
          receipt_data: platform === 'ios' ? receipt : undefined,
          purchase_token: platform === 'android' ? receipt : undefined
        };

        const response = await apiClient.post('/api/subscription/validate', payload);
        
        const data = response.data;
        const result: ValidationResult = {
          valid: data.success || false,
          error: data.success ? undefined : (data.message || 'Validation failed')
        };

        // If validation successful, include updated subscription status
        if (data.success && data.subscription) {
          result.subscriptionStatus = {
            tier: data.subscription.tier || 'free',
            status: data.subscription.is_active ? 'active' : 'expired',
            startDate: data.subscription.start_date ? new Date(data.subscription.start_date) : new Date(),
            endDate: data.subscription.expires_at ? new Date(data.subscription.expires_at) : new Date(),
            autoRenew: data.subscription.auto_renew || false,
            trialUsed: data.subscription.trial_used || false
          };
        }

        return result;
      }, 'validate purchase receipt');
    } catch (error: any) {
      console.error('[SubscriptionApiClient] Failed to validate purchase:', error);
      
      // For purchase validation, we want to return a ValidationResult even on network errors
      // This allows the UI to handle the error appropriately
      return {
        valid: false,
        error: error.message || 'Purchase validation failed due to network error'
      };
    }
  }

  /**
   * Start 14-day free trial
   * Calls POST /subscription/trial
   * Validates: Requirements 3.3
   */
  async startTrial(): Promise<TrialResult> {
    try {
      return await ApiRequestWrapper.executeWithRetry(async () => {
        // Use actual platform instead of generic 'mobile'
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        
        // Get user locale/language if available
        const locale = (await AsyncStorage.getItem('user_locale')) || 'en';
        const currency = (await AsyncStorage.getItem('user_currency')) || 'USD';

        const response = await apiClient.post('/api/subscription/trial', {
          platform: platform,
          language: locale,
          currency: currency
        });

        const data = response.data;
        const result: TrialResult = {
          success: data.success || false,
          error: data.success ? undefined : (data.message || 'Failed to start trial')
        };

        // Include trial end date if successful
        if (data.success && data.trial_end_date) {
          result.trialEndDate = new Date(data.trial_end_date);
        }

        // Check if trial was already used
        if (!data.success && data.message?.includes('already')) {
          result.alreadyUsed = true;
        }

        return result;
      }, 'start free trial');
    } catch (error: any) {
      console.error('[SubscriptionApiClient] Failed to start trial:', error);
      
      const errorMessage = error.message || 'Failed to start trial';
      const result: TrialResult = {
        success: false,
        error: errorMessage
      };

      // Check if error indicates trial already used
      if (errorMessage.toLowerCase().includes('already') || 
          errorMessage.toLowerCase().includes('used') ||
          error.details?.response?.status === 409) {
        result.alreadyUsed = true;
      }

      return result;
    }
  }

  /**
   * Redeem coupon code
   * Calls POST /coupon/redeem
   * Validates: Requirements 4.5
   */
  async redeemCoupon(code: string): Promise<CouponResult> {
    try {
      return await ApiRequestWrapper.executeWithRetry(async () => {
        // Clean and validate coupon code format
        const cleanCode = code.toUpperCase().trim();
        
        const response = await apiClient.post('/api/coupon/redeem', {
          coupon_code: cleanCode
        });

        const data = response.data;
        const result: CouponResult = {
          success: data.success || false,
          error: data.success ? undefined : (data.message || 'Failed to redeem coupon')
        };

        // Include coupon details if successful
        if (data.success) {
          result.couponCode = cleanCode;
          if (data.expires_at) {
            result.expirationDate = new Date(data.expires_at);
          }
        } else {
          // Determine specific error type
          const errorMessage = data.message || '';
          if (errorMessage.toLowerCase().includes('already') || 
              errorMessage.toLowerCase().includes('used')) {
            result.alreadyRedeemed = true;
          } else if (errorMessage.toLowerCase().includes('invalid') || 
                     errorMessage.toLowerCase().includes('not found')) {
            result.invalidCode = true;
          }
        }

        return result;
      }, 'redeem coupon code');
    } catch (error: any) {
      console.error('[SubscriptionApiClient] Failed to redeem coupon:', error);
      
      const errorMessage = error.message || 'Failed to redeem coupon';
      const result: CouponResult = {
        success: false,
        error: errorMessage
      };

      // Determine error type from HTTP status or message
      if (error.details?.response?.status === 404 || 
          errorMessage.toLowerCase().includes('invalid') ||
          errorMessage.toLowerCase().includes('not found')) {
        result.invalidCode = true;
      } else if (error.details?.response?.status === 409 || 
                 errorMessage.toLowerCase().includes('already') ||
                 errorMessage.toLowerCase().includes('used')) {
        result.alreadyRedeemed = true;
      }

      return result;
    }
  }
}

// Export singleton instance
export const subscriptionApiClient = new SubscriptionApiClient();
export default subscriptionApiClient;