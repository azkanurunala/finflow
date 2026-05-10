/**
 * Iteration 1 — minimal snapshot harness.
 *
 * Wraps `@testing-library/react-native`'s `render(...).toJSON()` so test files
 * don't have to thread the rendering plumbing themselves. We use RTL because
 * `react-test-renderer` 19 returns `null` for intrinsic elements under the
 * existing jest preset; RTL produces the expected JSON tree.
 *
 * Usage:
 *   import { renderToSnapshot } from './helpers/renderToSnapshot';
 *   const tree = renderToSnapshot(<PricingDisplay price="$9.99" duration="monthly" />);
 *   expect(tree).toMatchSnapshot();
 */

import * as React from 'react';
import { render } from '@testing-library/react-native';

export function renderToSnapshot(element: React.ReactElement) {
  return render(element).toJSON();
}
