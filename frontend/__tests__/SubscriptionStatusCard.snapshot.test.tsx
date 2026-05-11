/**
 * Iter 1 — visual baseline for SubscriptionStatusCard. Covers the four canonical
 * tier states the user actually sees in production: free, trial, pro_monthly,
 * pro_yearly. The card is purely presentational so its rendered tree fully
 * captures any layout regression.
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
    Platform: { OS: 'ios' },
    Linking: { openURL: jest.fn() },
  };
});

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k }),
}));

import React from 'react';
import SubscriptionStatusCard from '../components/SubscriptionStatusCard';
import { renderToSnapshot } from './helpers/renderToSnapshot';

const FIXED_DATE = new Date('2026-12-31T00:00:00Z');
const FIXED_NOW = new Date('2026-05-10T00:00:00Z');

describe('SubscriptionStatusCard — visual baseline', () => {
  // Pin the clock so any "days remaining" calculations don't drift the snapshot
  // each day. Both the now-reference and expirationDate values are fixed.
  beforeAll(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(FIXED_NOW);
  });
  afterAll(() => {
    jest.useRealTimers();
  });
  it('free tier — expired status', () => {
    expect(
      renderToSnapshot(
        <SubscriptionStatusCard
          currentTier="free"
          status="expired"
          expirationDate={null}
          trialUsed={false}
        />
      )
    ).toMatchSnapshot();
  });

  it('trial tier — active status with expiry date', () => {
    expect(
      renderToSnapshot(
        <SubscriptionStatusCard
          currentTier="trial"
          status="trial"
          expirationDate={FIXED_DATE}
          trialUsed={false}
        />
      )
    ).toMatchSnapshot();
  });

  it('pro_monthly tier — active status', () => {
    expect(
      renderToSnapshot(
        <SubscriptionStatusCard
          currentTier="pro_monthly"
          status="active"
          expirationDate={FIXED_DATE}
          trialUsed={true}
        />
      )
    ).toMatchSnapshot();
  });

  it('pro_yearly tier — active status', () => {
    expect(
      renderToSnapshot(
        <SubscriptionStatusCard
          currentTier="pro_yearly"
          status="active"
          expirationDate={FIXED_DATE}
          trialUsed={true}
        />
      )
    ).toMatchSnapshot();
  });
});
