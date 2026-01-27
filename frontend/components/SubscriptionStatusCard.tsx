/**
 * SubscriptionStatusCard Component
 * Displays current subscription status with tier, expiration, and management options
 * Task 9.1
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SubscriptionTierType, SubscriptionStatusType } from '../types/subscription';
import { useLanguage } from '../contexts/LanguageContext';

interface SubscriptionStatusCardProps {
  currentTier: SubscriptionTierType;
  status: SubscriptionStatusType;
  expirationDate: Date | null;
  trialUsed: boolean;
  onManageSubscription?: () => void;
}

export default function SubscriptionStatusCard({
  currentTier,
  status,
  expirationDate,
  trialUsed,
  onManageSubscription,
}: SubscriptionStatusCardProps) {
  const { t } = useLanguage();
  
  const getTierDisplayName = (): string => {
    switch (currentTier) {
      case 'free':
        return t('subscription.plans.free') || 'Free Plan';
      case 'trial':
        return t('subscription.plans.trial.name') || 'Trial Plan';
      case 'coupon':
        return t('subscription.plans.coupon') || 'Coupon Access';
      case 'pro_monthly':
        return t('subscription.plans.proMonthly') || 'Pro Monthly';
      case 'pro_yearly':
        return t('subscription.plans.proYearly') || 'Pro Yearly';
      default:
        return t('subscription.plans.pro') || 'Pro Plan';
    }
  };

  const getStatusColor = (): string => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'trial':
        return '#F59E0B';
      case 'expired':
        return '#EF4444';
      case 'cancelled':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (): string => {
    switch (status) {
      case 'active':
        return t('subscription.statusActive') || 'Active';
      case 'trial':
        return t('subscription.statusTrial') || 'Trial';
      case 'expired':
        return t('subscription.statusExpired') || 'Expired';
      case 'cancelled':
        return t('subscription.statusCancelled') || 'Cancelled';
      default:
        return t('subscription.statusUnknown') || 'Unknown';
    }
  };

  const getDaysRemaining = (): number | null => {
    if (!expirationDate) return null;
    const now = new Date();
    const expiration = new Date(expirationDate);
    const diffTime = expiration.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const daysRemaining = getDaysRemaining();
  const showWarning = daysRemaining !== null && daysRemaining < 3 && daysRemaining > 0;

  const handleManageSubscription = () => {
    if (onManageSubscription) {
      onManageSubscription();
    } else {
      // Open App Store or Play Store subscription management
      const url = Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';
      Linking.openURL(url);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="diamond" size={24} color={getStatusColor()} />
        <Text style={styles.tierName}>{getTierDisplayName()}</Text>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      </View>

      {/* Trial Countdown */}
      {status === 'trial' && daysRemaining !== null && (
        <View style={[styles.countdownContainer, showWarning && styles.warningContainer]}>
          <Ionicons 
            name={showWarning ? "warning" : "time"} 
            size={16} 
            color={showWarning ? "#EF4444" : "#F59E0B"} 
          />
          <Text style={[styles.countdownText, showWarning && styles.warningText]}>
            {daysRemaining} {t('analytics.days')} {t('subscription.remainingInTrial') || 'remaining in trial'}
          </Text>
        </View>
      )}

      {/* Expiration Date */}
      {expirationDate && status !== 'expired' && (
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color="#6B7280" />
          <Text style={styles.infoText}>
            {t('subscription.expires')}: {new Date(expirationDate).toLocaleDateString()}
          </Text>
        </View>
      )}

      {/* Trial Warning */}
      {showWarning && status === 'trial' && (
        <View style={styles.warningBox}>
          <Text style={styles.warningBoxText}>
            {t('subscription.trialEndingSoon') || 'Your trial is ending soon! Subscribe now to continue enjoying Pro features.'}
          </Text>
        </View>
      )}

      {/* Manage Subscription Button */}
      {(status === 'active' || status === 'trial') && currentTier !== 'free' && (
        <TouchableOpacity
          style={styles.manageButton}
          onPress={handleManageSubscription}
        >
          <Ionicons name="settings-outline" size={18} color="#6366F1" />
          <Text style={styles.manageButtonText}>{t('subscription.manageSubscription') || 'Manage Subscription'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  tierName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  statusRow: {
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  warningContainer: {
    backgroundColor: '#FEE2E2',
  },
  countdownText: {
    fontSize: 14,
    color: '#D97706',
    fontWeight: '500',
  },
  warningText: {
    color: '#DC2626',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  warningBoxText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
});
