/**
 * Iter 4 — visual baseline for the ReceiptSourcePicker modal itself.
 * Helper-function behaviour (pickFromCamera/pickFromGallery) is covered
 * separately in ReceiptSourcePicker.test.ts; this file locks the rendered
 * tree of the action-sheet UI.
 */

jest.mock('react-native', () => {
  const React = require('react');
  const make = (tag: string) =>
    React.forwardRef((props: any, ref: any) => React.createElement(tag, { ...props, ref }));
  return {
    StyleSheet: { create: (s: any) => s, hairlineWidth: 1 },
    Platform: { OS: 'ios' },
    Alert: { alert: jest.fn() },
    View: make('view'),
    Text: make('text'),
    TouchableOpacity: make('touchable'),
    Modal: make('modal'),
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-image-picker', () => ({
  __esModule: true,
  default: {},
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

import React from 'react';
import { ReceiptSourcePicker } from '../components/ReceiptSourcePicker';
import { renderToSnapshot } from './helpers/renderToSnapshot';

describe('ReceiptSourcePicker — visual baseline', () => {
  it('visible with default title', () => {
    expect(
      renderToSnapshot(
        <ReceiptSourcePicker visible={true} onClose={() => {}} onPicked={() => {}} />
      )
    ).toMatchSnapshot();
  });

  it('visible with custom title', () => {
    expect(
      renderToSnapshot(
        <ReceiptSourcePicker
          visible={true}
          onClose={() => {}}
          onPicked={() => {}}
          title="Attach a receipt"
        />
      )
    ).toMatchSnapshot();
  });

  it('hidden', () => {
    expect(
      renderToSnapshot(
        <ReceiptSourcePicker visible={false} onClose={() => {}} onPicked={() => {}} />
      )
    ).toMatchSnapshot();
  });
});
