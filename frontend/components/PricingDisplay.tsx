/**
 * PricingDisplay Component
 * Formats and displays subscription pricing with comparisons
 * Task 9.2
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PricingDisplayProps {
  price: string;
  currency?: string;
  duration: 'monthly' | 'yearly';
  showComparison?: boolean;
  originalPrice?: string;
}

export default function PricingDisplay({
  price,
  currency = 'USD',
  duration,
  showComparison = false,
  originalPrice,
}: PricingDisplayProps) {
  // Extract numeric value from price string
  const numericPrice = parseFloat(price.replace(/[^0-9.]/g, ''));
  
  // Calculate monthly equivalent for yearly plans
  const monthlyEquivalent = duration === 'yearly' ? numericPrice / 12 : numericPrice;
  
  // Calculate savings if original price provided
  const calculateSavings = (): string | null => {
    if (!originalPrice) return null;
    const originalNumeric = parseFloat(originalPrice.replace(/[^0-9.]/g, ''));
    const savings = originalNumeric - numericPrice;
    return savings > 0 ? `$${savings.toFixed(2)}` : null;
  };

  const savings = calculateSavings();

  return (
    <View style={styles.container}>
      {/* Main Price */}
      <View style={styles.priceRow}>
        <Text style={styles.currency}>{currency === 'USD' ? '$' : currency}</Text>
        <Text style={styles.price}>{numericPrice.toFixed(2)}</Text>
        <Text style={styles.period}>/ {duration === 'yearly' ? 'year' : 'month'}</Text>
      </View>

      {/* Monthly Comparison for Yearly Plans */}
      {showComparison && duration === 'yearly' && (
        <View style={styles.comparisonRow}>
          <Text style={styles.comparisonText}>
            ${monthlyEquivalent.toFixed(2)} per month
          </Text>
        </View>
      )}

      {/* Original Price & Savings */}
      {originalPrice && savings && (
        <View style={styles.savingsRow}>
          <Text style={styles.originalPrice}>{originalPrice}</Text>
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>Save {savings}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currency: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  price: {
    fontSize: 48,
    fontWeight: '800',
    color: '#1F2937',
    marginLeft: 4,
  },
  period: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 8,
  },
  comparisonRow: {
    marginTop: 4,
  },
  comparisonText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  originalPrice: {
    fontSize: 16,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  savingsBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  savingsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D97706',
  },
});
