/**
 * Unit tests for PaymentService
 * Tests payment service methods and error handling
 */

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios'
  }
}));

// Mock react-native-purchases.
// Two constraints converge here:
//  1. babel-preset-expo emits ESM default imports as `_module.default`, so the mock
//     must expose the SDK under `default` (interop-safe).
//  2. jest.mock factory closures over outer `const mockX = jest.fn()` resolve to
//     undefined at call time (TDZ) under jest@30 + this preset combo. Define the
//     fns inside the factory and retrieve via jest.requireMock.
jest.mock('react-native-purchases', () => {
  const surface = {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    getCustomerInfo: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    LOG_LEVEL: { DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' },
  };
  return { __esModule: true, default: surface, ...surface };
});

const purchasesMock: any = jest.requireMock('react-native-purchases');
const mockConfigure = purchasesMock.default.configure as jest.Mock;
const mockSetLogLevel = purchasesMock.default.setLogLevel as jest.Mock;
const mockGetOfferings = purchasesMock.default.getOfferings as jest.Mock;
const mockPurchasePackage = purchasesMock.default.purchasePackage as jest.Mock;
const mockRestorePurchases = purchasesMock.default.restorePurchases as jest.Mock;
const mockGetCustomerInfo = purchasesMock.default.getCustomerInfo as jest.Mock;
const mockLogIn = purchasesMock.default.logIn as jest.Mock;
const mockLogOut = purchasesMock.default.logOut as jest.Mock;

// Mock SubscriptionApiClient — same factory-closure TDZ issue applies.
jest.mock('../services/SubscriptionApiClient', () => ({
  subscriptionApiClient: {
    validatePurchase: jest.fn(),
  },
}));
const subApiMock: any = jest.requireMock('../services/SubscriptionApiClient');
const mockValidatePurchase = subApiMock.subscriptionApiClient.validatePurchase as jest.Mock;

import { paymentService } from '../services/PaymentService';

describe('PaymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      mockConfigure.mockReturnValue(undefined);

      await paymentService.initialize();

      expect(mockSetLogLevel).toHaveBeenCalled();
      expect(mockConfigure).toHaveBeenCalledWith({
        apiKey: expect.any(String)
      });
    });

    it('should set user ID when provided', async () => {
      mockConfigure.mockReturnValue(undefined);
      mockLogIn.mockResolvedValue(undefined);

      await paymentService.initialize('user123');

      expect(mockLogIn).toHaveBeenCalledWith('user123');
    });

    it('should throw error if initialization fails', async () => {
      mockConfigure.mockImplementation(() => {
        throw new Error('Configuration failed');
      });

      await expect(paymentService.initialize()).rejects.toThrow('Failed to initialize payment service');
    });
  });

  describe('getPlatform', () => {
    it('should return ios platform', () => {
      const platform = paymentService.getPlatform();
      expect(platform).toBe('ios');
    });
  });

  describe('getProducts', () => {
    beforeEach(async () => {
      mockConfigure.mockReturnValue(undefined);
      await paymentService.initialize();
    });

    it('should fetch and transform products successfully', async () => {
      const mockOfferings = {
        current: {
          availablePackages: [
            {
              identifier: 'monthly',
              product: {
                identifier: 'com.finflow.pro.monthly',
                priceString: '$9.99',
                currencyCode: 'USD'
              }
            },
            {
              identifier: 'yearly',
              product: {
                identifier: 'com.finflow.pro.yearly',
                priceString: '$99.99',
                currencyCode: 'USD'
              }
            }
          ]
        }
      };

      mockGetOfferings.mockResolvedValue(mockOfferings);

      const products = await paymentService.getProducts();

      expect(mockGetOfferings).toHaveBeenCalled();
      expect(products).toHaveLength(2);
      expect(products[0]).toMatchObject({
        id: 'com.finflow.pro.monthly',
        productId: 'com.finflow.pro.monthly',
        price: '$9.99',
        currency: 'USD',
        duration: 'monthly'
      });
      expect(products[1]).toMatchObject({
        id: 'com.finflow.pro.yearly',
        productId: 'com.finflow.pro.yearly',
        price: '$99.99',
        currency: 'USD',
        duration: 'yearly',
        isPopular: true
      });
    });

    it('should throw error when no offerings available', async () => {
      mockGetOfferings.mockResolvedValue({
        current: null
      });

      await expect(paymentService.getProducts()).rejects.toThrow('No subscription products available');
    });

    it('should handle network errors', async () => {
      mockGetOfferings.mockRejectedValue({
        code: 'NETWORK_ERROR',
        message: 'Network error'
      });

      await expect(paymentService.getProducts()).rejects.toThrow('Network error');
    });
  });

  describe('purchaseProduct', () => {
    beforeEach(async () => {
      mockConfigure.mockReturnValue(undefined);
      await paymentService.initialize();

      // Setup mock offerings
      const mockOfferings = {
        current: {
          availablePackages: [
            {
              identifier: 'monthly',
              product: {
                identifier: 'com.finflow.pro.monthly',
                priceString: '$9.99',
                currencyCode: 'USD'
              }
            }
          ]
        }
      };
      mockGetOfferings.mockResolvedValue(mockOfferings);
      await paymentService.getProducts();
    });

    it('should purchase product successfully', async () => {
      const mockCustomerInfo = {
        originalAppUserId: 'user123',
        entitlements: {
          active: {
            pro: {
              productIdentifier: 'com.finflow.pro.monthly'
            }
          }
        }
      };

      mockPurchasePackage.mockResolvedValue({
        customerInfo: mockCustomerInfo,
        productIdentifier: 'com.finflow.pro.monthly'
      });

      mockValidatePurchase.mockResolvedValue({
        valid: true,
        subscriptionStatus: {
          tier: 'pro_monthly',
          status: 'active',
          startDate: new Date(),
          endDate: new Date(),
          autoRenew: true,
          trialUsed: false
        }
      });

      const result = await paymentService.purchaseProduct('com.finflow.pro.monthly');

      expect(mockPurchasePackage).toHaveBeenCalled();
      expect(mockValidatePurchase).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.productId).toBe('com.finflow.pro.monthly');
    });

    it('should handle user cancellation', async () => {
      mockPurchasePackage.mockRejectedValue({
        userCancelled: true,
        code: '1'
      });

      const result = await paymentService.purchaseProduct('com.finflow.pro.monthly');

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
      expect(result.error).toContain('cancelled');
    });

    it('should handle validation failure', async () => {
      const mockCustomerInfo = {
        originalAppUserId: 'user123',
        entitlements: {
          active: {}
        }
      };

      mockPurchasePackage.mockResolvedValue({
        customerInfo: mockCustomerInfo,
        productIdentifier: 'com.finflow.pro.monthly'
      });

      mockValidatePurchase.mockResolvedValue({
        valid: false,
        error: 'Invalid receipt'
      });

      const result = await paymentService.purchaseProduct('com.finflow.pro.monthly');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid receipt');
    });

    it('should handle network errors during purchase', async () => {
      mockPurchasePackage.mockRejectedValue({
        code: 'NETWORK_ERROR',
        message: 'Network error'
      });

      const result = await paymentService.purchaseProduct('com.finflow.pro.monthly');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('restorePurchases', () => {
    beforeEach(async () => {
      mockConfigure.mockReturnValue(undefined);
      await paymentService.initialize();
    });

    it('should restore purchases successfully', async () => {
      const mockCustomerInfo = {
        originalAppUserId: 'user123',
        entitlements: {
          active: {
            pro: {
              productIdentifier: 'com.finflow.pro.monthly'
            }
          }
        }
      };

      mockRestorePurchases.mockResolvedValue(mockCustomerInfo);
      mockValidatePurchase.mockResolvedValue({
        valid: true,
        subscriptionStatus: {
          tier: 'pro_monthly',
          status: 'active',
          startDate: new Date(),
          endDate: new Date(),
          autoRenew: true,
          trialUsed: false
        }
      });

      const result = await paymentService.restorePurchases();

      expect(mockRestorePurchases).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.restoredPurchases).toBe(1);
    });

    it('should handle no purchases to restore', async () => {
      const mockCustomerInfo = {
        originalAppUserId: 'user123',
        entitlements: {
          active: {}
        }
      };

      mockRestorePurchases.mockResolvedValue(mockCustomerInfo);

      const result = await paymentService.restorePurchases();

      expect(result.success).toBe(true);
      expect(result.restoredPurchases).toBe(0);
    });

    it('should handle restore failure', async () => {
      mockRestorePurchases.mockRejectedValue({
        message: 'Restore failed'
      });

      const result = await paymentService.restorePurchases();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Restore failed');
    });
  });

  describe('validateReceipt', () => {
    beforeEach(async () => {
      mockConfigure.mockReturnValue(undefined);
      await paymentService.initialize();
    });

    it('should validate receipt successfully', async () => {
      mockValidatePurchase.mockResolvedValue({
        valid: true
      });

      const result = await paymentService.validateReceipt('test-receipt');

      expect(mockValidatePurchase).toHaveBeenCalledWith('test-receipt', 'ios');
      expect(result.valid).toBe(true);
    });

    it('should handle validation failure', async () => {
      mockValidatePurchase.mockResolvedValue({
        valid: false,
        error: 'Invalid receipt'
      });

      const result = await paymentService.validateReceipt('test-receipt');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid receipt');
    });
  });

  describe('getCustomerInfo', () => {
    beforeEach(async () => {
      mockConfigure.mockReturnValue(undefined);
      await paymentService.initialize();
    });

    it('should get customer info successfully', async () => {
      const mockCustomerInfo = {
        originalAppUserId: 'user123',
        entitlements: {
          active: {}
        }
      };

      mockGetCustomerInfo.mockResolvedValue(mockCustomerInfo);

      const result = await paymentService.getCustomerInfo();

      expect(mockGetCustomerInfo).toHaveBeenCalled();
      expect(result).toEqual(mockCustomerInfo);
    });

    it('should return null on error', async () => {
      mockGetCustomerInfo.mockRejectedValue(new Error('Failed'));

      const result = await paymentService.getCustomerInfo();

      expect(result).toBeNull();
    });
  });

  describe('hasActiveEntitlement', () => {
    beforeEach(async () => {
      mockConfigure.mockReturnValue(undefined);
      await paymentService.initialize();
    });

    it('should return true when entitlement is active', async () => {
      const mockCustomerInfo = {
        originalAppUserId: 'user123',
        entitlements: {
          active: {
            pro: {
              productIdentifier: 'com.finflow.pro.monthly'
            }
          }
        }
      };

      mockGetCustomerInfo.mockResolvedValue(mockCustomerInfo);

      const result = await paymentService.hasActiveEntitlement('pro');

      expect(result).toBe(true);
    });

    it('should return false when entitlement is not active', async () => {
      const mockCustomerInfo = {
        originalAppUserId: 'user123',
        entitlements: {
          active: {}
        }
      };

      mockGetCustomerInfo.mockResolvedValue(mockCustomerInfo);

      const result = await paymentService.hasActiveEntitlement('pro');

      expect(result).toBe(false);
    });
  });

  describe('user management', () => {
    beforeEach(async () => {
      mockConfigure.mockReturnValue(undefined);
      await paymentService.initialize();
    });

    it('should set user ID', async () => {
      mockLogIn.mockResolvedValue(undefined);

      await paymentService.setUserId('newuser123');

      expect(mockLogIn).toHaveBeenCalledWith('newuser123');
    });

    it('should logout user', async () => {
      mockLogOut.mockResolvedValue(undefined);

      await paymentService.logout();

      expect(mockLogOut).toHaveBeenCalled();
    });
  });
});
