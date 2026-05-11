/**
 * PG2 — shared FlatList virtualization tunings.
 *
 * Centralises the same prop bundle for every long list in the app so
 * scroll-perf settings stay coherent. Numbers chosen for a 60Hz target:
 * render 12 rows up front (one screen + headroom), then 8 per batch with
 * a 7-window radius. removeClippedSubviews is Android-only because iOS
 * has long-standing issues with it on virtualized lists.
 *
 * NOTE on getItemLayout: the transaction row in history.tsx has an
 * optional `notes` line that makes height variable. We therefore do
 * NOT expose a getItemLayout for that list — the four virtualization
 * props below still deliver the bulk of the scroll-perf win on their
 * own, and getItemLayout is provided here for any future fixed-height
 * list that needs it.
 */

import { Platform } from 'react-native';

export const TRANSACTION_ROW_HEIGHT_BASE = 80;
export const TRANSACTION_ROW_HEIGHT_WITH_NOTES = 112;

export interface VirtualizationProps {
  windowSize: number;
  initialNumToRender: number;
  maxToRenderPerBatch: number;
  removeClippedSubviews: boolean;
  updateCellsBatchingPeriod: number;
}

export const LONG_LIST_VIRTUALIZATION: VirtualizationProps = {
  windowSize: 7,
  initialNumToRender: 12,
  maxToRenderPerBatch: 8,
  // Android benefits significantly; iOS has known re-mount issues.
  removeClippedSubviews: Platform.OS === 'android',
  updateCellsBatchingPeriod: 50,
};

/** Generic getItemLayout factory for any fixed-height row list. Not used
 *  by history.tsx because its rows are variable-height. */
export const makeFixedItemLayout = (rowHeight: number) =>
  (_data: ArrayLike<unknown> | null | undefined, index: number) => ({
    length: rowHeight,
    offset: rowHeight * index,
    index,
  });
