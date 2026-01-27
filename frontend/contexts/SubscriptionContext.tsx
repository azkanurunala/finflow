import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import {
  SubscriptionState,
  SubscriptionActions,
  SubscriptionContextType,
  SubscriptionTier,
  SubscriptionStatus,
  PurchaseResult,
  RestoreResult,
  TrialResult,
  CouponResult,
  SubscriptionTierType,
  SubscriptionStatusType,
  CachedSubscriptionData,
  SUBSCRIPTION_CACHE_DURATION,
  SUBSCRIPTION_STORAGE_KEYS,
} from '../types/subscription';
import { subscriptionApiClient } from '../services/SubscriptionApiClient';
import { paymentService } from '../services/PaymentService';

// Action types for useReducer
type SubscriptionAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SUBSCRIPTION_STATUS'; payload: { tier: SubscriptionTierType; status: SubscriptionStatusType; expirationDate: Date | null; trialUsed: boolean } }
  | { type: 'SET_AVAILABLE_TIERS'; payload: SubscriptionTier[] }
  | { type: 'UPDATE_LAST_UPDATED'; payload: Date }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: SubscriptionState = {
  currentTier: 'free',
  status: 'expired',
  expirationDate: null,
  trialUsed: false,
  availableTiers: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
};

// Reducer function
function subscriptionReducer(state: SubscriptionState, action: SubscriptionAction): SubscriptionState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'SET_SUBSCRIPTION_STATUS':
      return {
        ...state,
        currentTier: action.payload.tier,
        status: action.payload.status,
        expirationDate: action.payload.expirationDate,
        trialUsed: action.payload.trialUsed,
        error: null,
        isLoading: false,
      };
    
    case 'SET_AVAILABLE_TIERS':
      return { ...state, availableTiers: action.payload, error: null };
    
    case 'UPDATE_LAST_UPDATED':
      return { ...state, lastUpdated: action.payload };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    case 'RESET_STATE':
      return { ...initialState };
    
    default:
      return state;
  }
}

// Create context
const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Provider component
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(subscriptionReducer, initialState);

  // Cache management
  const getCachedData = useCallback(async (): Promise<CachedSubscriptionData | null> => {
    try {
      const cachedDataString = await AsyncStorage.getItem(SUBSCRIPTION_STORAGE_KEYS.SUBSCRIPTION_CACHE);
      if (!cachedDataString) return null;

      const cachedData: CachedSubscriptionData = JSON.parse(cachedDataString);
      
      // Check if cache is still valid
      const now = new Date();
      if (now > new Date(cachedData.expiresAt)) {
        // Cache expired, remove it
        await AsyncStorage.removeItem(SUBSCRIPTION_STORAGE_KEYS.SUBSCRIPTION_CACHE);
        return null;
      }

      return cachedData;
    } catch (error) {
      console.error('[SubscriptionContext] Failed to get cached data:', error);
      return null;
    }
  }, []);

  const setCachedData = useCallback(async (subscriptionStatus: SubscriptionStatus, availableTiers: SubscriptionTier[]) => {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + SUBSCRIPTION_CACHE_DURATION);
      
      const cacheData: CachedSubscriptionData = {
        subscriptionStatus,
        availableTiers,
        userEntitlements: {
          hasAICategories: subscriptionStatus.tier !== 'free',
          hasAnalytics: subscriptionStatus.tier !== 'free',
          hasExport: subscriptionStatus.tier !== 'free',
          hasUnlimitedTransactions: subscriptionStatus.tier !== 'free',
          maxTransactions: subscriptionStatus.tier === 'free' ? 100 : undefined,
        },
        cacheTimestamp: now,
        expiresAt,
      };

      await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEYS.SUBSCRIPTION_CACHE, JSON.stringify(cacheData));
    } catch (error) {
      console.error('[SubscriptionContext] Failed to cache data:', error);
      // Don't throw error - caching failure shouldn't break functionality
    }
  }, []);

  const clearCache = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([
        SUBSCRIPTION_STORAGE_KEYS.SUBSCRIPTION_CACHE,
        SUBSCRIPTION_STORAGE_KEYS.SUBSCRIPTION_STATUS,
        SUBSCRIPTION_STORAGE_KEYS.AVAILABLE_TIERS,
        SUBSCRIPTION_STORAGE_KEYS.USER_ENTITLEMENTS,
      ]);
    } catch (error) {
      console.error('[SubscriptionContext] Failed to clear cache:', error);
    }
  }, []);

  // Expose clearCache for testing and debugging purposes
  const resetSubscriptionData = useCallback(async () => {
    await clearCache();
    dispatch({ type: 'RESET_STATE' });
  }, [clearCache]);

  // Network connectivity check
  const checkNetworkConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      const netInfo = await NetInfo.fetch();
      return netInfo.isConnected === true && netInfo.isInternetReachable === true;
    } catch (error) {
      console.error('[SubscriptionContext] Network check failed:', error);
      return false; // Assume offline if check fails
    }
  }, []);

  // Load subscription status from API or cache
  const loadSubscriptionStatus = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      // Check network connectivity
      const isOnline = await checkNetworkConnectivity();
      
      if (!isOnline) {
        // Try to load from cache when offline
        const cachedData = await getCachedData();
        if (cachedData) {
          dispatch({
            type: 'SET_SUBSCRIPTION_STATUS',
            payload: {
              tier: cachedData.subscriptionStatus.tier,
              status: cachedData.subscriptionStatus.status,
              expirationDate: new Date(cachedData.subscriptionStatus.endDate),
              trialUsed: cachedData.subscriptionStatus.trialUsed,
            },
          });
          dispatch({ type: 'SET_AVAILABLE_TIERS', payload: cachedData.availableTiers });
          dispatch({ type: 'UPDATE_LAST_UPDATED', payload: cachedData.cacheTimestamp });
          return;
        } else {
          throw new Error('No internet connection and no cached data available');
        }
      }

      // Fetch subscription status from API
      const subscriptionStatus = await subscriptionApiClient.getSubscriptionStatus();
      
      // Fetch available tiers from API
      const availableTiers = await subscriptionApiClient.getAvailableTiers();

      // Update state with loaded data
      dispatch({
        type: 'SET_SUBSCRIPTION_STATUS',
        payload: {
          tier: subscriptionStatus.tier,
          status: subscriptionStatus.status,
          expirationDate: subscriptionStatus.endDate,
          trialUsed: subscriptionStatus.trialUsed,
        },
      });
      dispatch({ type: 'SET_AVAILABLE_TIERS', payload: availableTiers });
      dispatch({ type: 'UPDATE_LAST_UPDATED', payload: new Date() });

      // Cache the data
      await setCachedData(subscriptionStatus, availableTiers);

    } catch (error) {
      console.error('[SubscriptionContext] Failed to load subscription status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load subscription status';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [checkNetworkConnectivity, getCachedData, setCachedData]);

  // Purchase subscription
  const purchaseSubscription = useCallback(async (productId: string): Promise<PurchaseResult> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      // Check network connectivity
      const isOnline = await checkNetworkConnectivity();
      if (!isOnline) {
        throw new Error('No internet connection. Please check your network and try again.');
      }

      // Check existing subscription status before allowing new purchase
      if (state.status === 'active' && state.currentTier !== 'free') {
        return {
          success: false,
          error: 'You already have an active subscription',
          productId,
        };
      }

      // Use PaymentService to purchase product
      const purchaseResult = await paymentService.purchaseProduct(productId);

      if (!purchaseResult.success) {
        return purchaseResult;
      }

      // Validate purchase receipt with backend
      if (purchaseResult.receipt) {
        const platform = paymentService.getPlatform();
        const validationResult = await subscriptionApiClient.validatePurchase(
          purchaseResult.receipt,
          platform
        );

        if (!validationResult.valid) {
          return {
            success: false,
            error: validationResult.error || 'Purchase validation failed',
            productId,
          };
        }
      }

      // Refresh subscription status after successful purchase
      await loadSubscriptionStatus();

      return purchaseResult;

    } catch (error) {
      console.error('[SubscriptionContext] Purchase failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      return {
        success: false,
        error: errorMessage,
        productId,
      };
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.status, state.currentTier, checkNetworkConnectivity, loadSubscriptionStatus]);

  // Start trial
  const startTrial = useCallback(async (): Promise<TrialResult> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      // Check if trial already used
      if (state.trialUsed) {
        return {
          success: false,
          error: 'Trial has already been used',
          alreadyUsed: true,
        };
      }

      // Check network connectivity
      const isOnline = await checkNetworkConnectivity();
      if (!isOnline) {
        throw new Error('No internet connection. Please check your network and try again.');
      }

      // Call API to start trial
      const trialResult = await subscriptionApiClient.startTrial();

      if (trialResult.success && trialResult.trialEndDate) {
        // Update subscription status to trial
        dispatch({
          type: 'SET_SUBSCRIPTION_STATUS',
          payload: {
            tier: 'trial',
            status: 'trial',
            expirationDate: trialResult.trialEndDate,
            trialUsed: true,
          },
        });
        dispatch({ type: 'UPDATE_LAST_UPDATED', payload: new Date() });
      }

      return trialResult;

    } catch (error) {
      console.error('[SubscriptionContext] Trial activation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start trial';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.trialUsed, checkNetworkConnectivity]);

  // Redeem coupon
  const redeemCoupon = useCallback(async (code: string): Promise<CouponResult> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      // Basic coupon format validation
      const couponPattern = /^FINFLOW-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
      if (!couponPattern.test(code)) {
        return {
          success: false,
          error: 'Invalid coupon format. Please use format: FINFLOW-XXXX-XXXX',
          invalidCode: true,
        };
      }

      // Check if user has active subscription or trial
      if (state.status === 'active' || state.status === 'trial') {
        return {
          success: false,
          error: 'Cannot redeem coupon while you have an active subscription or trial',
        };
      }

      // Check network connectivity
      const isOnline = await checkNetworkConnectivity();
      if (!isOnline) {
        throw new Error('No internet connection. Please check your network and try again.');
      }

      // Call API to redeem coupon
      const couponResult = await subscriptionApiClient.redeemCoupon(code);

      if (couponResult.success && couponResult.expirationDate) {
        // Update subscription status to coupon
        dispatch({
          type: 'SET_SUBSCRIPTION_STATUS',
          payload: {
            tier: 'coupon',
            status: 'active',
            expirationDate: couponResult.expirationDate,
            trialUsed: state.trialUsed,
          },
        });
        dispatch({ type: 'UPDATE_LAST_UPDATED', payload: new Date() });
      }

      return couponResult;

    } catch (error) {
      console.error('[SubscriptionContext] Coupon redemption failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to redeem coupon';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.status, state.trialUsed, checkNetworkConnectivity]);

  // Restore purchases
  const restorePurchases = useCallback(async (): Promise<RestoreResult> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      // Check network connectivity
      const isOnline = await checkNetworkConnectivity();
      if (!isOnline) {
        throw new Error('No internet connection. Please check your network and try again.');
      }

      // Use PaymentService to restore purchases
      const restoreResult = await paymentService.restorePurchases();

      if (restoreResult.success && restoreResult.restoredPurchases > 0) {
        // Refresh subscription status after successful restore
        await loadSubscriptionStatus();
      }

      return restoreResult;

    } catch (error) {
      console.error('[SubscriptionContext] Restore purchases failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to restore purchases';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      return {
        success: false,
        restoredPurchases: 0,
        error: errorMessage,
      };
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [checkNetworkConnectivity, loadSubscriptionStatus]);

  // Refresh entitlements
  const refreshEntitlements = useCallback(async (): Promise<void> => {
    // For now, this is the same as loading subscription status
    // In the future, this might be a separate, lighter API call
    await loadSubscriptionStatus();
  }, [loadSubscriptionStatus]);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Set loading
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  // Actions object
  const actions: SubscriptionActions = {
    loadSubscriptionStatus,
    refreshEntitlements,
    purchaseSubscription,
    restorePurchases,
    startTrial,
    redeemCoupon,
    clearError,
    setLoading,
  };

  // Additional utility actions for testing and debugging
  const utilityActions = {
    resetSubscriptionData,
  };

  // Load initial data on mount
  useEffect(() => {
    loadSubscriptionStatus();
  }, [loadSubscriptionStatus]);

  // Handle app state changes (refresh when app becomes active)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Check if we need to refresh (only if last update was more than 5 minutes ago)
        const now = new Date();
        const lastUpdate = state.lastUpdated;
        
        if (!lastUpdate || (now.getTime() - lastUpdate.getTime()) > SUBSCRIPTION_CACHE_DURATION) {
          refreshEntitlements();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [state.lastUpdated, refreshEntitlements]);

  // Handle network connectivity changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(netState => {
      // If we just came back online and have no data or stale data, refresh
      if (netState.isConnected && netState.isInternetReachable) {
        const now = new Date();
        const lastUpdate = state.lastUpdated;
        
        if (!lastUpdate || (now.getTime() - lastUpdate.getTime()) > SUBSCRIPTION_CACHE_DURATION) {
          refreshEntitlements();
        }
      }
    });

    return unsubscribe;
  }, [state.lastUpdated, refreshEntitlements]);

  const contextValue: SubscriptionContextType = {
    state,
    actions,
    utilityActions,
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// Hook to use subscription context
export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

// Export context for testing purposes
export { SubscriptionContext };