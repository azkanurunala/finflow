/**
 * Iter 2 — visual baseline for SubscriptionTierCard. Mirrors what the
 * /subscription screen renders for each tier card. Pure presentational.
 */

jest.mock('react-native', () => {
  const React = require('react');
  const make = (tag: string) =>
    React.forwardRef((props: any, ref: any) => React.createElement(tag, { ...props, ref }));
  return {
    StyleSheet: { create: (s: any) => s, hairlineWidth: 1 },
    View: make('view'),
    Text: make('text'),
    TouchableOpacity: make('touchable'),
    ActivityIndicator: make('activity-indicator'),
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import React from 'react';
import SubscriptionTierCard from '../components/SubscriptionTierCard';
import { renderToSnapshot } from './helpers/renderToSnapshot';

const monthlyTier = {
  id: 'pro_monthly',
  name: 'Pro Monthly',
  productId: 'com.finflow.pro.monthly',
  price: '$9.99',
  currency: 'USD',
  duration: 'monthly' as const,
  features: ['AI Categories', 'Analytics', 'Export'],
  isPopular: false,
};

const yearlyTier = {
  id: 'pro_yearly',
  name: 'Pro Yearly',
  productId: 'com.finflow.pro.yearly',
  price: '$99.99',
  currency: 'USD',
  duration: 'yearly' as const,
  features: ['AI Categories', 'Analytics', 'Export', 'Priority support'],
  isPopular: true,
};

describe('SubscriptionTierCard — visual baseline', () => {
  it('monthly tier — default state', () => {
    expect(
      renderToSnapshot(<SubscriptionTierCard tier={monthlyTier} onPress={() => {}} />)
    ).toMatchSnapshot();
  });

  it('yearly tier — marked as best value', () => {
    expect(
      renderToSnapshot(
        <SubscriptionTierCard tier={yearlyTier} isBestValue onPress={() => {}} />
      )
    ).toMatchSnapshot();
  });

  it('monthly tier — marked as recommended', () => {
    expect(
      renderToSnapshot(
        <SubscriptionTierCard tier={monthlyTier} isRecommended onPress={() => {}} />
      )
    ).toMatchSnapshot();
  });

  it('current plan — disabled state', () => {
    expect(
      renderToSnapshot(
        <SubscriptionTierCard tier={monthlyTier} isCurrentPlan onPress={() => {}} />
      )
    ).toMatchSnapshot();
  });

  it('loading state', () => {
    expect(
      renderToSnapshot(
        <SubscriptionTierCard tier={monthlyTier} isLoading onPress={() => {}} />
      )
    ).toMatchSnapshot();
  });
});
