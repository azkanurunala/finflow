/**
 * Iter 2 — visual baseline for BottomNavigation. Covers two states:
 * active=home (default) and active=insights, to lock the active-tab
 * highlight styling.
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
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

let mockPathname = '/(app)';
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => mockPathname,
}));

import React from 'react';
import BottomNavigation from '../components/BottomNavigation';
import { renderToSnapshot } from './helpers/renderToSnapshot';

describe('BottomNavigation — visual baseline', () => {
  it('active route = home renders home as active', () => {
    mockPathname = '/(app)';
    expect(renderToSnapshot(<BottomNavigation />)).toMatchSnapshot();
  });

  it('active route = insights renders insights as active', () => {
    mockPathname = '/(app)/insights';
    expect(renderToSnapshot(<BottomNavigation />)).toMatchSnapshot();
  });

  it('active route = history renders history as active', () => {
    mockPathname = '/(app)/history';
    expect(renderToSnapshot(<BottomNavigation />)).toMatchSnapshot();
  });
});
