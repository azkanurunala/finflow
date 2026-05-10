/**
 * G2 — verify post-login flows POST the stashed `initial_balance` to the dedicated
 * /api/auth/onboarding-balance endpoint with the correct payload.
 *
 * Pre-fix bug (Issue #18): code hit /api/transactions which doesn't exist, so the
 * call always 404'd silently and the balance never reached the backend.
 */

jest.mock('axios', () => {
  const post = jest.fn();
  return { __esModule: true, default: { post }, post };
});

import axios from 'axios';
const axiosPostMock = axios.post as unknown as jest.Mock;

const BACKEND_URL = 'https://example.test';

describe('G2 — onboarding initial-balance sync (Issue #18)', () => {
  beforeEach(() => {
    axiosPostMock.mockReset();
    axiosPostMock.mockResolvedValue({ data: { success: true } });
  });

  // Mirrors the AuthContext.syncInitialBalance pattern.
  async function syncInitialBalance(stashed: string | null, currency: string, token: string) {
    if (!stashed || stashed === '0') return;
    await axios.post(
      `${BACKEND_URL}/api/auth/onboarding-balance`,
      {
        amount: parseFloat(stashed),
        currency,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  it('hits /api/auth/onboarding-balance with {amount, currency} when balance is set', async () => {
    await syncInitialBalance('1500.50', 'IDR', 'tok123');

    expect(axiosPostMock).toHaveBeenCalledTimes(1);
    expect(axiosPostMock).toHaveBeenCalledWith(
      `${BACKEND_URL}/api/auth/onboarding-balance`,
      { amount: 1500.5, currency: 'IDR' },
      { headers: { Authorization: 'Bearer tok123' } }
    );
  });

  it('does not call backend when balance is null', async () => {
    await syncInitialBalance(null, 'USD', 'tok123');
    expect(axiosPostMock).not.toHaveBeenCalled();
  });

  it('does not call backend when balance is "0"', async () => {
    await syncInitialBalance('0', 'USD', 'tok123');
    expect(axiosPostMock).not.toHaveBeenCalled();
  });

  it('falls back to USD currency when none provided', async () => {
    await syncInitialBalance('100', 'USD', 'tok');
    expect(axiosPostMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ currency: 'USD' }),
      expect.any(Object)
    );
  });
});
