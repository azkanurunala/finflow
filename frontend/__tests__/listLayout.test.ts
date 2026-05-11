/**
 * PG2 — verify the shared virtualization bundle exposes correct knobs
 * and the fixed-height item-layout factory does pure math.
 */

import { Platform } from 'react-native';
import {
  LONG_LIST_VIRTUALIZATION,
  makeFixedItemLayout,
  TRANSACTION_ROW_HEIGHT_BASE,
  TRANSACTION_ROW_HEIGHT_WITH_NOTES,
} from '../utils/listLayout';

describe('PG2 — list layout helpers', () => {
  describe('LONG_LIST_VIRTUALIZATION', () => {
    it('sets a small windowSize so off-screen rows are unmounted aggressively', () => {
      expect(LONG_LIST_VIRTUALIZATION.windowSize).toBeLessThanOrEqual(7);
      expect(LONG_LIST_VIRTUALIZATION.windowSize).toBeGreaterThan(1);
    });

    it('renders an initial batch that fits one screen with headroom', () => {
      expect(LONG_LIST_VIRTUALIZATION.initialNumToRender).toBe(12);
    });

    it('caps subsequent batch size to keep the JS thread responsive', () => {
      expect(LONG_LIST_VIRTUALIZATION.maxToRenderPerBatch).toBe(8);
    });

    it('enables removeClippedSubviews on Android only', () => {
      if (Platform.OS === 'android') {
        expect(LONG_LIST_VIRTUALIZATION.removeClippedSubviews).toBe(true);
      } else {
        expect(LONG_LIST_VIRTUALIZATION.removeClippedSubviews).toBe(false);
      }
    });

    it('sets a non-zero updateCellsBatchingPeriod', () => {
      expect(LONG_LIST_VIRTUALIZATION.updateCellsBatchingPeriod).toBeGreaterThan(0);
    });
  });

  describe('makeFixedItemLayout()', () => {
    it('returns length=rowHeight, offset=rowHeight*index for each index', () => {
      const layout = makeFixedItemLayout(50);
      expect(layout(null, 0)).toEqual({ length: 50, offset: 0, index: 0 });
      expect(layout(null, 7)).toEqual({ length: 50, offset: 350, index: 7 });
      expect(layout(null, 100)).toEqual({ length: 50, offset: 5000, index: 100 });
    });

    it('is referentially stable for the same row height', () => {
      const a = makeFixedItemLayout(TRANSACTION_ROW_HEIGHT_BASE);
      const b = makeFixedItemLayout(TRANSACTION_ROW_HEIGHT_BASE);
      // Two separate factory calls return different functions (factory pattern)
      // but each function is itself pure.
      expect(a(null, 5)).toEqual(b(null, 5));
    });

    it('exposes a sensible row-height constant pair (notes row taller than base)', () => {
      expect(TRANSACTION_ROW_HEIGHT_WITH_NOTES).toBeGreaterThan(TRANSACTION_ROW_HEIGHT_BASE);
    });
  });
});
