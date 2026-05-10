/**
 * Unit tests for SubscriptionApiClient
 * Tests all API client methods and error handling
 */

// Mock NetInfo before importing anything else.
// Define jest.fn()s INSIDE the factory (jest@30 + babel-preset-expo TDZ-binds outer
// `const mockX = jest.fn()` to undefined when the factory runs).
jest.mock('@react-native-community/netinfo', () => {
  const surface = { fetch: jest.fn() };
  return { __esModule: true, default: surface, ...surface };
});
const netInfoMock: any = jest.requireMock('@react-native-community/netinfo');
const mockNetInfo = netInfoMock.default ?? netInfoMock;

// Mock the API client before importing anything else
jest.mock('../api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));
const apiClientMock: any = jest.requireMock('../api/client');
const mockGet = apiClientMock.apiClient.get as jest.Mock;
const mockPost = apiClientMock.apiClient.post as jest.Mock;

// Mock timers for testing retry logic
jest.useFakeTimers();

import { subscriptionApiClient } from '../services/SubscriptionApiClient';

describe('SubscriptionApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    // Mock network as connected by default
    mockNetInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('getSubscriptionStatus', () => {
    it('should return subscription status successfully', async () => {
      const mockResponse = {
        data: {
          tier: 'pro_monthly',
          is_active: true,
          start_date: '2024-01-01T00:00:00Z',
          expires_at: '2024-02-01T00:00:00Z',
          auto_renew: true,
          trial_used: false
        }
      };

      mockGet.mockResolvedValueOnce(mockResponse);

      const result = await subscriptionApiClient.getSubscriptionStatus();

      expect(mockGet).toHaveBeenCalledWith('/api/subscription/status');
      expect(result).toEqual({
        tier: 'pro_monthly',
        status: 'active',
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-02-01T00:00:00Z'),
        autoRenew: true,
        trialUsed: false
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockError = {
        response: {
          data: {
            detail: 'Subscription not found'
          }
        }
      };

      mockGet.mockRejectedValueOnce(mockError);

      await expect(subscriptionApiClient.getSubscriptionStatus()).rejects.toThrow('Subscription not found');
    });

    it('should handle network connectivity errors', async () => {
      // Mock network as disconnected
      mockNetInfo.fetch.mockResolvedValueOnce({
        isConnected: false,
        isInternetReachable: false
      });

      await expect(subscriptionApiClient.getSubscriptionStatus()).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: 'Network connection error. Please check your internet connection and try again.',
        offline: true,
        retryable: true
      });
    });

    it('should retry on retryable errors', async () => {
      // ApiRequestWrapper uses real setTimeout for backoff sleep + the timeout race;
      // the file-wide jest.useFakeTimers() blocks them. Switch this test to real timers.
      jest.useRealTimers();
      try {
        const mockError = {
          response: {
            status: 500,
            data: {
              detail: 'Internal server error'
            }
          }
        };

        const mockResponse = {
          data: {
            tier: 'free',
            is_active: false,
            start_date: null,
            expires_at: null,
            auto_renew: false,
            trial_used: false
          }
        };

        mockGet.mockRejectedValueOnce(mockError);
        mockGet.mockResolvedValueOnce(mockResponse);

        const result = await subscriptionApiClient.getSubscriptionStatus();

        expect(mockGet).toHaveBeenCalledTimes(2);
        expect(result.tier).toBe('free');
      } finally {
        jest.useFakeTimers();
      }
    }, 15000);

    it('should handle timeout errors', async () => {
      // Same fake-timer caveat as above — switch to real timers so Promise.race against
      // the real setTimeout actually fires.
      jest.useRealTimers();
      try {
        // Mock a request that takes longer than the wrapper's 10s internal timeout
        mockGet.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 15000)));

        await expect(subscriptionApiClient.getSubscriptionStatus()).rejects.toMatchObject({
          code: 'TIMEOUT_ERROR',
          message: 'Request timed out. Please try again.',
          timeout: true,
          retryable: true
        });
      } finally {
        jest.useFakeTimers();
      }
    }, 60000); // Three retry attempts of ~10s each plus backoff
  });

  describe('getAvailableTiers', () => {
    it('should return available tiers successfully', async () => {
      const mockResponse = {
        data: {
          tiers: [
            {
              id: 'pro_monthly',
              name: 'Pro Monthly',
              product_id: 'com.finflow.pro.monthly',
              price: '$9.99',
              currency: 'USD',
              duration: 'monthly',
              features: ['AI Categories', 'Analytics'],
              is_popular: false
            }
          ]
        }
      };

      mockGet.mockResolvedValueOnce(mockResponse);

      const result = await subscriptionApiClient.getAvailableTiers();

      expect(mockGet).toHaveBeenCalledWith('/api/subscription/tiers');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'pro_monthly',
        name: 'Pro Monthly',
        productId: 'com.finflow.pro.monthly',
        price: '$9.99',
        currency: 'USD',
        duration: 'monthly',
        features: ['AI Categories', 'Analytics'],
        isPopular: false
      });
    });
  });

  describe('validatePurchase', () => {
    it('should validate iOS purchase successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Purchase validated',
          subscription: {
            tier: 'pro_monthly',
            is_active: true,
            start_date: '2024-01-01T00:00:00Z',
            expires_at: '2024-02-01T00:00:00Z',
            auto_renew: true,
            trial_used: false
          }
        }
      };

      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await subscriptionApiClient.validatePurchase('receipt123', 'ios');

      expect(mockPost).toHaveBeenCalledWith('/api/subscription/validate', {
        platform: 'ios',
        receipt_data: 'receipt123',
        purchase_token: undefined
      });
      expect(result.valid).toBe(true);
      expect(result.subscriptionStatus).toBeDefined();
    });

    it('should validate Android purchase successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Purchase validated'
        }
      };

      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await subscriptionApiClient.validatePurchase('token123', 'android');

      expect(mockPost).toHaveBeenCalledWith('/api/subscription/validate', {
        platform: 'android',
        receipt_data: undefined,
        purchase_token: 'token123'
      });
      expect(result.valid).toBe(true);
    });

    it('should handle validation failure', async () => {
      const mockResponse = {
        data: {
          success: false,
          message: 'Invalid receipt'
        }
      };

      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await subscriptionApiClient.validatePurchase('invalid', 'ios');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid receipt');
    });
  });

  describe('startTrial', () => {
    it('should start trial successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Trial started',
          trial_end_date: '2024-01-15T00:00:00Z'
        }
      };

      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await subscriptionApiClient.startTrial();

      // Product evolved: trial body now carries platform + i18n locale + currency.
      // Test signature updated to match current contract (Direction B — see LIVING_PRD).
      expect(mockPost).toHaveBeenCalledWith('/api/subscription/trial', {
        platform: 'ios',
        language: 'en',
        currency: 'USD',
      });
      expect(result.success).toBe(true);
      expect(result.trialEndDate).toEqual(new Date('2024-01-15T00:00:00Z'));
    });

    it('should handle trial already used', async () => {
      const mockError = {
        response: {
          status: 409,
          data: {
            detail: 'Trial already used'
          }
        }
      };

      mockPost.mockRejectedValueOnce(mockError);

      const result = await subscriptionApiClient.startTrial();

      expect(result.success).toBe(false);
      expect(result.alreadyUsed).toBe(true);
      expect(result.error).toBe('Trial already used');
    });
  });

  describe('redeemCoupon', () => {
    it('should redeem coupon successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Coupon redeemed',
          expires_at: '2024-02-01T00:00:00Z'
        }
      };

      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await subscriptionApiClient.redeemCoupon('FINFLOW-TEST-CODE');

      expect(mockPost).toHaveBeenCalledWith('/api/coupon/redeem', {
        coupon_code: 'FINFLOW-TEST-CODE'
      });
      expect(result.success).toBe(true);
      expect(result.couponCode).toBe('FINFLOW-TEST-CODE');
      expect(result.expirationDate).toEqual(new Date('2024-02-01T00:00:00Z'));
    });

    it('should handle invalid coupon code', async () => {
      const mockError = {
        response: {
          status: 404,
          data: {
            detail: 'Coupon not found'
          }
        }
      };

      mockPost.mockRejectedValueOnce(mockError);

      const result = await subscriptionApiClient.redeemCoupon('INVALID-CODE');

      expect(result.success).toBe(false);
      expect(result.invalidCode).toBe(true);
      expect(result.error).toBe('Coupon not found');
    });

    it('should handle already redeemed coupon', async () => {
      const mockError = {
        response: {
          status: 409,
          data: {
            detail: 'Coupon already used'
          }
        }
      };

      mockPost.mockRejectedValueOnce(mockError);

      const result = await subscriptionApiClient.redeemCoupon('USED-CODE');

      expect(result.success).toBe(false);
      expect(result.alreadyRedeemed).toBe(true);
      expect(result.error).toBe('Coupon already used');
    });

    it('should clean and uppercase coupon codes', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Coupon redeemed'
        }
      };

      mockPost.mockResolvedValueOnce(mockResponse);

      await subscriptionApiClient.redeemCoupon('  finflow-test-code  ');

      expect(mockPost).toHaveBeenCalledWith('/api/coupon/redeem', {
        coupon_code: 'FINFLOW-TEST-CODE'
      });
    });
  });
});