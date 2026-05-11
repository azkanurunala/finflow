/**
 * Iter 3 — visual baseline for CouponInput. Covers the two render-time
 * states a user sees: default + disabled. Interactive states (loading,
 * error, success) are driven by useState inside the component and would
 * require fireEvent flows; those are out of scope for a pure snapshot
 * lock and are covered by behaviour tests elsewhere.
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
    ActivityIndicator: make('activity-indicator'),
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../types/subscription', () => ({
  COUPON_CODE_PATTERN: /^FINFLOW-[A-Z0-9]{4}-[A-Z0-9]{4}$/,
}));

import React from 'react';
import CouponInput from '../components/CouponInput';
import { renderToSnapshot } from './helpers/renderToSnapshot';

describe('CouponInput — visual baseline', () => {
  it('default state', () => {
    expect(
      renderToSnapshot(<CouponInput onRedeem={async () => {}} />)
    ).toMatchSnapshot();
  });

  it('disabled state', () => {
    expect(
      renderToSnapshot(<CouponInput onRedeem={async () => {}} disabled />)
    ).toMatchSnapshot();
  });
});
