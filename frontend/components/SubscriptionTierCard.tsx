/**
 * SubscriptionTierCard Component
 * Reusable component for displaying subscription tier options
 * Task 6.2 & 9.1
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SubscriptionTier } from '../types/subscription';

interface SubscriptionTierCardProps {
  tier: SubscriptionTier;
  isCurrentPlan?: boolean;
  isRecommended?: boolean;
  isBestValue?: boolean;
  isLoading?: boolean;
  onPress: () => void;
  disabled?: boolean;
  buttonText?: string;
}

export default function SubscriptionTierCard({
  tier,
  isCurrentPlan = false,
  isRecommended = false,
  isBestValue = false,
  isLoading = false,
  onPress,
  disabled = false,
  buttonText,
}: SubscriptionTierCardProps) {
  const color = tier.duration === 'yearly' ? '#F59E0B' : '#8B5CF6';
  const isDisabled = disabled || isCurrentPlan || isLoading;

  return (
    <View
      style={[
        styles.card,
        isRecommended && styles.recommendedCard,
        isBestValue && styles.bestValueCard,
        isCurrentPlan && styles.currentPlanCard,
      ]}
    >
      {/* Badges */}
      {isRecommended && (
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>Recommended</Text>
        </View>
      )}
      {isBestValue && (
        <View style={[styles.badge, { backgroundColor: '#F59E0B' }]}>
          <Text style={styles.badgeText}>Best Value</Text>
        </View>
      )}
      {isCurrentPlan && (
        <View style={[styles.badge, { backgroundColor: '#10B981' }]}>
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.badgeText}>Current</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.name, { color }]}>{tier.name}</Text>
        <Text style={styles.duration}>{tier.duration}</Text>
      </View>

      {/* Price */}
      <View style={styles.priceContainer}>
        <Text style={[styles.price, { color }]}>{tier.price}</Text>
        <Text style={styles.period}>/ {tier.duration === 'yearly' ? 'year' : 'month'}</Text>
      </View>

      {/* Features */}
      <View style={styles.featuresContainer}>
        {tier.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={18} color={color} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {/* Action Button */}
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: color },
          isDisabled && styles.disabledButton,
        ]}
        onPress={onPress}
        disabled={isDisabled}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {buttonText || (isCurrentPlan ? 'Current Plan' : `Subscribe ${tier.price}`)}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
  },
  recommendedCard: {
    borderColor: '#8B5CF6',
  },
  bestValueCard: {
    borderColor: '#F59E0B',
  },
  currentPlanCard: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  header: {
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  duration: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  price: {
    fontSize: 36,
    fontWeight: '800',
  },
  period: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 4,
  },
  featuresContainer: {
    marginBottom: 16,
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
