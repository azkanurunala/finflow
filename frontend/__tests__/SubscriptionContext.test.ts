import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { SubscriptionProvider, useSubscription } from '../contexts/SubscriptionContext';
import { SUBSCRIPTION_STORAGE_KEYS } from '../types/subscription';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

// SubscriptionProvider transitively imports PaymentService -> 'react-native-purchases',
// whose SDK ships untransformed ESM that babel-jest cannot parse. Mock the native SDK
// and the two services that reach for it. Mocks defined inside factories to avoid the
// jest@30 + babel-preset-expo TDZ closure-binding issue.
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
jest.mock('../services/PaymentService', () => ({
  paymentService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getProducts: jest.fn().mockResolvedValue([]),
    purchaseProduct: jest.fn(),
    restorePurchases: jest.fn(),
    validateReceipt: jest.fn(),
    getCustomerInfo: jest.fn(),
    hasActiveEntitlement: jest.fn().mockResolvedValue(false),
    setUserId: jest.fn(),
    logout: jest.fn(),
  },
}));
jest.mock('../services/SubscriptionApiClient', () => ({
  subscriptionApiClient: {
    // Defaults shaped to drive the provider through the happy-path tests.
    // Per-test mockResolvedValueOnce overrides as needed.
    getSubscriptionStatus: jest.fn().mockResolvedValue({
      tier: 'free',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: false,
      trialUsed: false,
    }),
    getAvailableTiers: jest.fn().mockResolvedValue([
      {
        id: 'pro_monthly',
        name: 'Pro Monthly',
        productId: 'com.finflow.pro.monthly',
        price: '$9.99',
        currency: 'USD',
        duration: 'monthly',
        features: ['AI Categories'],
        isPopular: false,
      },
      {
        id: 'pro_yearly',
        name: 'Pro Yearly',
        productId: 'com.finflow.pro.yearly',
        price: '$99.99',
        currency: 'USD',
        duration: 'yearly',
        features: ['AI Categories'],
        isPopular: true,
      },
    ]),
    validatePurchase: jest.fn(),
    startTrial: jest.fn().mockResolvedValue({
      success: true,
      trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    }),
    redeemCoupon: jest.fn().mockResolvedValue({
      success: true,
      couponCode: 'FINFLOW-TEST-1234',
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }),
  },
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

// Mock NetInfo to return online by default
mockNetInfo.fetch.mockResolvedValue({
  isConnected: true,
  isInternetReachable: true,
} as any);

mockNetInfo.addEventListener.mockReturnValue(() => {});

describe('SubscriptionContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();
    mockAsyncStorage.multiRemove.mockResolvedValue();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(SubscriptionProvider, null, children)
  );

  it('should provide initial subscription state', async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });

    // Provider's mount effect dispatches SET_LOADING:true synchronously during render
    // under React 19 + @testing-library/react-native. Initial observation therefore
    // sees isLoading:true. Test updated to match current rendering semantics.
    expect(result.current.state).toEqual({
      currentTier: 'free',
      status: 'expired',
      expirationDate: null,
      trialUsed: false,
      availableTiers: [],
      isLoading: true,
      error: null,
      lastUpdated: null,
    });
  });

  it('should load subscription status on mount', async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });

    // Wait for the initial load to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100)); // Wait for mock delay
    });

    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.currentTier).toBe('free');
    expect(result.current.state.status).toBe('active');
    expect(result.current.state.availableTiers).toHaveLength(2);
  });

  it('should handle trial activation', async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });

    // Wait for initial load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100));
    });

    // Start trial
    let trialResult;
    await act(async () => {
      trialResult = await result.current.actions.startTrial();
    });

    expect(trialResult).toEqual({
      success: true,
      trialEndDate: expect.any(Date),
    });

    expect(result.current.state.currentTier).toBe('trial');
    expect(result.current.state.status).toBe('trial');
    expect(result.current.state.trialUsed).toBe(true);
  });

  it('should prevent multiple trial activations', async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });

    // Wait for initial load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100));
    });

    // Start trial first time
    await act(async () => {
      await result.current.actions.startTrial();
    });

    // Try to start trial again
    let secondTrialResult;
    await act(async () => {
      secondTrialResult = await result.current.actions.startTrial();
    });

    expect(secondTrialResult).toEqual({
      success: false,
      error: 'Trial has already been used',
      alreadyUsed: true,
    });
  });

  it('should validate coupon format', async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });

    // Wait for initial load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100));
    });

    // Try invalid coupon format
    let couponResult;
    await act(async () => {
      couponResult = await result.current.actions.redeemCoupon('INVALID-CODE');
    });

    expect(couponResult).toEqual({
      success: false,
      error: 'Invalid coupon format. Please use format: FINFLOW-XXXX-XXXX',
      invalidCode: true,
    });
  });

  it('should redeem valid coupon', async () => {
    // Provider short-circuits coupon redemption when status is active/trial.
    // Override the loaded status to expired for this scenario.
    const { subscriptionApiClient } = jest.requireMock('../services/SubscriptionApiClient') as any;
    subscriptionApiClient.getSubscriptionStatus.mockResolvedValueOnce({
      tier: 'free',
      status: 'expired',
      startDate: new Date(),
      endDate: new Date(),
      autoRenew: false,
      trialUsed: false,
    });

    const { result } = renderHook(() => useSubscription(), { wrapper });

    // Wait for initial load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100));
    });

    // Redeem valid coupon
    let couponResult;
    await act(async () => {
      couponResult = await result.current.actions.redeemCoupon('FINFLOW-TEST-1234');
    });

    expect(couponResult).toEqual({
      success: true,
      couponCode: 'FINFLOW-TEST-1234',
      expirationDate: expect.any(Date),
    });

    expect(result.current.state.currentTier).toBe('coupon');
    expect(result.current.state.status).toBe('active');
  });

  it('should handle offline mode with cached data', async () => {
    // Mock cached data
    const cachedData = {
      subscriptionStatus: {
        tier: 'pro_monthly',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: true,
        trialUsed: true,
      },
      availableTiers: [
        {
          id: 'pro_monthly',
          name: 'Pro Monthly',
          productId: 'com.finflow.pro.monthly',
          price: '$9.99',
          currency: 'USD',
          duration: 'monthly',
          features: ['AI Categories'],
        },
      ],
      userEntitlements: {
        hasAICategories: true,
        hasAnalytics: true,
        hasExport: true,
        hasUnlimitedTransactions: true,
      },
      cacheTimestamp: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
    };

    mockAsyncStorage.getItem.mockImplementation((key) => {
      if (key === SUBSCRIPTION_STORAGE_KEYS.SUBSCRIPTION_CACHE) {
        return Promise.resolve(JSON.stringify(cachedData));
      }
      return Promise.resolve(null);
    });

    // Mock offline
    mockNetInfo.fetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as any);

    const { result } = renderHook(() => useSubscription(), { wrapper });

    // Wait for load to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.state.currentTier).toBe('pro_monthly');
    expect(result.current.state.status).toBe('active');
    expect(result.current.state.availableTiers).toHaveLength(1);
  });

  it('should handle network errors gracefully', async () => {
    // Mock offline with no cache
    mockNetInfo.fetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as any);

    const { result } = renderHook(() => useSubscription(), { wrapper });

    // Wait for load to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.state.error).toBe('No internet connection and no cached data available');
    expect(result.current.state.isLoading).toBe(false);
  });

  it('should clear error when clearError is called', async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });

    // Set an error state by trying to load offline with no cache
    mockNetInfo.fetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as any);

    await act(async () => {
      await result.current.actions.loadSubscriptionStatus();
    });

    expect(result.current.state.error).toBeTruthy();

    // Clear the error
    act(() => {
      result.current.actions.clearError();
    });

    expect(result.current.state.error).toBeNull();
  });

  it('should throw error when used outside provider', () => {
    expect(() => {
      renderHook(() => useSubscription());
    }).toThrow('useSubscription must be used within a SubscriptionProvider');
  });
});