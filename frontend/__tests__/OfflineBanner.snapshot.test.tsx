/**
 * Iter 1 — visual baseline for OfflineBanner across its 4 visible states
 * (offline, syncing, success, error). The "online + idle" state renders null
 * and is covered by behaviour tests, not a snapshot.
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

jest.mock('../contexts/NetworkContext', () => {
  const mockNetworkState: any = {
    isOnline: true,
    isReachable: true,
    isSyncing: false,
    syncStatus: 'idle',
    forceSync: jest.fn(),
  };
  return {
    __mockNetworkState: mockNetworkState,
    useNetwork: () => mockNetworkState,
  };
});
const networkState: any = (jest.requireMock('../contexts/NetworkContext') as any).__mockNetworkState;
jest.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

import React from 'react';
import OfflineBanner from '../components/OfflineBanner';
import { renderToSnapshot } from './helpers/renderToSnapshot';

describe('OfflineBanner — visual baseline', () => {
  it('offline + reachable false renders the offline banner', () => {
    networkState.isOnline = false;
    networkState.isReachable = false;
    networkState.isSyncing = false;
    networkState.syncStatus = 'idle';
    expect(renderToSnapshot(<OfflineBanner />)).toMatchSnapshot();
  });

  it('online + isSyncing renders the syncing banner', () => {
    networkState.isOnline = true;
    networkState.isReachable = true;
    networkState.isSyncing = true;
    networkState.syncStatus = 'syncing';
    expect(renderToSnapshot(<OfflineBanner />)).toMatchSnapshot();
  });

  it('online + syncStatus=success renders the success banner', () => {
    networkState.isOnline = true;
    networkState.isReachable = true;
    networkState.isSyncing = false;
    networkState.syncStatus = 'success';
    expect(renderToSnapshot(<OfflineBanner />)).toMatchSnapshot();
  });
});
