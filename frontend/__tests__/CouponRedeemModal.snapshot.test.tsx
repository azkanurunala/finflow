/**
 * Iter 4 — visual baseline for CouponRedeemModal. Covers the open + closed
 * render states (the modal is always mounted; visibility is a prop).
 */

jest.mock('react-native', () => {
  const React = require('react');
  const make = (tag: string) =>
    React.forwardRef((props: any, ref: any) => React.createElement(tag, { ...props, ref }));
  return {
    StyleSheet: { create: (s: any) => s, hairlineWidth: 1 },
    Platform: { OS: 'ios' },
    View: make('view'),
    Text: make('text'),
    TextInput: make('text-input'),
    TouchableOpacity: make('touchable'),
    Modal: make('modal'),
    ActivityIndicator: make('activity-indicator'),
    KeyboardAvoidingView: make('keyboard-avoiding-view'),
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({ actions: { redeemCoupon: jest.fn() } }),
}));
jest.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k }),
}));

import React from 'react';
import CouponRedeemModal from '../components/CouponRedeemModal';
import { renderToSnapshot } from './helpers/renderToSnapshot';

describe('CouponRedeemModal — visual baseline', () => {
  it('visible state', () => {
    expect(
      renderToSnapshot(
        <CouponRedeemModal visible={true} onClose={() => {}} onSuccess={() => {}} />
      )
    ).toMatchSnapshot();
  });

  it('hidden state', () => {
    expect(
      renderToSnapshot(
        <CouponRedeemModal visible={false} onClose={() => {}} onSuccess={() => {}} />
      )
    ).toMatchSnapshot();
  });
});
