/**
 * useEntitlements Hook
 * Returns current user entitlements based on subscription tier
 * Task 12.1
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { useMemo, useEffect, useState } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { UserEntitlements, SubscriptionTierType } from '../types/subscription';

interface EntitlementsCache {
  entitlements: UserEntitlements;
  timestamp: Date;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useEntitlements(): UserEntitlements {
  const { state } = useSubscription();
  const [cache, setCache] = useState<EntitlementsCache | null>(null);

  // Calculate entitlements based on subscription tier
  const calculateEntitlements = (tier: SubscriptionTierType): UserEntitlements => {
    // Free tier - limited access
    if (tier === 'free') {
      return {
        hasAICategories: false,
        hasAnalytics: false,
        hasExport: false,
        hasUnlimitedTransactions: false,
        maxTransactions: 100,
      };
    }

    // Trial, Coupon, or any Pro tier - full access
    return {
      hasAICategories: true,
      hasAnalytics: true,
      hasExport: true,
      hasUnlimitedTransactions: true,
      maxTransactions: undefined,
    };
  };

  // Memoized entitlements with caching
  const entitlements = useMemo(() => {
    const now = new Date();

    // Check if cache is still valid
    if (cache && (now.getTime() - cache.timestamp.getTime()) < CACHE_DURATION) {
      return cache.entitlements;
    }

    // Calculate new entitlements
    const newEntitlements = calculateEntitlements(state.currentTier);

    // Update cache
    setCache({
      entitlements: newEntitlements,
      timestamp: now,
    });

    return newEntitlements;
  }, [state.currentTier, cache]);

  // Invalidate cache when subscription status changes
  useEffect(() => {
    setCache(null);
  }, [state.currentTier, state.status]);

  return entitlements;
}

/**
 * Hook to check if user has access to a specific feature
 */
export function useFeatureAccess(feature: keyof UserEntitlements): boolean {
  const entitlements = useEntitlements();
  return Boolean(entitlements[feature]);
}

/**
 * Hook to get upgrade prompt message for restricted features
 */
export function useUpgradePrompt(feature: keyof UserEntitlements): string | null {
  const hasAccess = useFeatureAccess(feature);
  
  if (hasAccess) {
    return null;
  }

  const messages: Record<keyof UserEntitlements, string> = {
    hasAICategories: 'Upgrade to Pro to unlock AI-powered transaction categorization',
    hasAnalytics: 'Upgrade to Pro to access advanced analytics and insights',
    hasExport: 'Upgrade to Pro to export your financial data',
    hasUnlimitedTransactions: 'Upgrade to Pro for unlimited transactions',
    maxTransactions: 'Upgrade to Pro for unlimited transactions',
  };

  return messages[feature] || 'Upgrade to Pro to unlock this feature';
}

export default useEntitlements;
