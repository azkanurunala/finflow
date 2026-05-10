/**
 * G3 — formatCurrency parity vs backend/server.py::format_currency.
 *
 * Each row mirrors the canonical Python output. If you change either side,
 * keep them in lockstep.
 */
import { formatCurrency } from '../utils/currency';

describe('G3 — formatCurrency parity with backend format_currency (Issue #13)', () => {
  // [amount, currency, expected]
  const cases: Array<[number, string, string]> = [
    // USD — backend: f"${amount:,.2f}"
    [0, 'USD', '$0.00'],
    [1.5, 'USD', '$1.50'],
    [1234.5, 'USD', '$1,234.50'],
    [1234567.89, 'USD', '$1,234,567.89'],

    // EUR — backend: €1.234,56 (German separators)
    [0, 'EUR', '€0,00'],
    [1234.5, 'EUR', '€1.234,50'],
    [1234567.89, 'EUR', '€1.234.567,89'],

    // GBP — backend: £1,234.56
    [0, 'GBP', '£0.00'],
    [1234.5, 'GBP', '£1,234.50'],
    [1234567.89, 'GBP', '£1,234,567.89'],

    // JPY — backend: ¥1,234 (no decimals)
    [0, 'JPY', '¥0'],
    [1234.5, 'JPY', '¥1,235'],
    [1234567.89, 'JPY', '¥1,234,568'],

    // SGD — backend: S$1,234.56
    [0, 'SGD', 'S$0.00'],
    [1234.5, 'SGD', 'S$1,234.50'],

    // IDR — backend: "Rp 1.234.567" (space, integer only, period thousands)
    [0, 'IDR', 'Rp 0'],
    [1234.5, 'IDR', 'Rp 1.235'],
    [1234567.89, 'IDR', 'Rp 1.234.568'],
  ];

  it.each(cases)('formatCurrency(%p, %p) === %p', (amount, code, expected) => {
    expect(formatCurrency(amount, code)).toBe(expected);
  });
});
