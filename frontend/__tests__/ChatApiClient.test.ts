/**
 * G7 — ChatApiClient round-trip against the three /api/chat/* endpoints.
 */

jest.mock('../api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

const mocked: any = jest.requireMock('../api/client');
const get = mocked.apiClient.get as jest.Mock;
const post = mocked.apiClient.post as jest.Mock;
const del = mocked.apiClient.delete as jest.Mock;

import { chatApiClient } from '../services/ChatApiClient';

describe('G7 — ChatApiClient', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    del.mockReset();
  });

  it('getHistory hits GET /api/chat/history with limit param and returns messages array', async () => {
    get.mockResolvedValue({
      data: {
        messages: [
          { id: 'm1', type: 'user', text: 'Hi', timestamp: '2026-05-10T00:00:00Z' },
        ],
        count: 1,
      },
    });

    const out = await chatApiClient.getHistory(50);
    expect(get).toHaveBeenCalledWith('/api/chat/history', { params: { limit: 50 } });
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('Hi');
  });

  it('getHistory defaults limit to 100', async () => {
    get.mockResolvedValue({ data: { messages: [], count: 0 } });
    await chatApiClient.getHistory();
    expect(get).toHaveBeenCalledWith('/api/chat/history', { params: { limit: 100 } });
  });

  it('getHistory returns [] when backend omits messages', async () => {
    get.mockResolvedValue({ data: {} });
    await expect(chatApiClient.getHistory()).resolves.toEqual([]);
  });

  it('saveMessage POSTs the input verbatim and returns the persisted record', async () => {
    post.mockResolvedValue({
      data: {
        success: true,
        message: { id: 'm2', type: 'user', text: 'Hello', timestamp: '2026-05-10T00:01:00Z' },
      },
    });

    const out = await chatApiClient.saveMessage({ type: 'user', text: 'Hello' });
    expect(post).toHaveBeenCalledWith('/api/chat/message', { type: 'user', text: 'Hello' });
    expect(out.id).toBe('m2');
  });

  it('clearHistory DELETEs and returns the deleted_count', async () => {
    del.mockResolvedValue({ data: { success: true, deleted_count: 7 } });
    await expect(chatApiClient.clearHistory()).resolves.toBe(7);
    expect(del).toHaveBeenCalledWith('/api/chat/history');
  });

  it('clearHistory returns 0 when backend omits deleted_count', async () => {
    del.mockResolvedValue({ data: { success: true } });
    await expect(chatApiClient.clearHistory()).resolves.toBe(0);
  });
});
