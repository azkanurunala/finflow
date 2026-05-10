/**
 * G7 — Chat history persistence client.
 *
 * Wraps the three /api/chat/* endpoints with the same axios interceptor used
 * elsewhere in the app, so a 401 still routes the user to /login per the
 * existing api/client.ts contract.
 */

import { apiClient } from '../api/client';

export type ChatMessageType = 'user' | 'assistant' | 'voice' | 'ocr';

export interface ChatMessage {
  id: string;
  user_id?: string;
  type: ChatMessageType;
  text?: string | null;
  timestamp: string; // ISO-8601
  audio_url?: string | null;
  transcription?: string | null;
  image_base64?: string | null;
  parsed_data?: Record<string, any> | null;
  transaction_id?: string | null;
  transaction_data?: Record<string, any> | null;
}

export interface SaveChatMessageInput {
  type: ChatMessageType;
  text?: string;
  audio_url?: string;
  transcription?: string;
  image_base64?: string;
  parsed_data?: Record<string, any>;
  transaction_id?: string;
  transaction_data?: Record<string, any>;
}

class ChatApiClient {
  /** GET /api/chat/history — paged history, oldest first. */
  async getHistory(limit = 100): Promise<ChatMessage[]> {
    const res = await apiClient.get('/api/chat/history', { params: { limit } });
    const messages = (res.data?.messages ?? []) as ChatMessage[];
    return messages;
  }

  /** POST /api/chat/message — append a message. Returns the persisted record. */
  async saveMessage(input: SaveChatMessageInput): Promise<ChatMessage> {
    const res = await apiClient.post('/api/chat/message', input);
    return res.data?.message as ChatMessage;
  }

  /** DELETE /api/chat/history — clear all messages for the current user. */
  async clearHistory(): Promise<number> {
    const res = await apiClient.delete('/api/chat/history');
    return Number(res.data?.deleted_count ?? 0);
  }
}

export const chatApiClient = new ChatApiClient();
