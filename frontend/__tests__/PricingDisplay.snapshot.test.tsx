/**
 * Iteration 1 — first canonical snapshot.
 *
 * PricingDisplay is the simplest visual component in the registry: pure View/Text,
 * no native bridges, no async effects. It establishes the snapshot pipeline so
 * later snapshots (G11/G12) follow the same shape.
 *
 * If this file's snapshot diff is the only one in a PR, that's an additive change
 * (a new component snapshot was added). If a *previously-stored* snapshot diff
 * appears, Gate 3 must reject the PR unless the screen is listed in
 * feature-registry.json::snapshot_replacements_iteration_N.
 */

// Minimal RN stubs that React's renderer accepts as intrinsic elements.
// Using forwardRef+createElement so toJSON captures a real tree, not `null`.
jest.mock('react-native', () => {
  const React = require('react');
  const make = (tag: string) =>
    React.forwardRef((props: any, ref: any) =>
      React.createElement(tag, { ...props, ref })
    );
  return {
    StyleSheet: { create: (s: any) => s, hairlineWidth: 1 },
    View: make('view'),
    Text: make('text'),
  };
});

import React from 'react';
import PricingDisplay from '../components/PricingDisplay';
import { renderToSnapshot } from './helpers/renderToSnapshot';

describe('PricingDisplay — visual baseline', () => {
  it('monthly USD pricing renders the canonical layout', () => {
    const tree = renderToSnapshot(
      <PricingDisplay price="$9.99" currency="USD" duration="monthly" />
    );
    expect(tree).toMatchSnapshot();
  });

  it('yearly USD pricing with savings renders the canonical layout', () => {
    const tree = renderToSnapshot(
      <PricingDisplay
        price="$99.99"
        currency="USD"
        duration="yearly"
        showComparison
        originalPrice="$119.88"
      />
    );
    expect(tree).toMatchSnapshot();
  });

  it('non-USD currency code renders verbatim in the prefix slot', () => {
    const tree = renderToSnapshot(
      <PricingDisplay price="149000" currency="IDR" duration="monthly" />
    );
    expect(tree).toMatchSnapshot();
  });
});
