import { API_BASE_URL } from '../config/api';
import type {
  StigptChatModel,
  StigptConversationDetail,
  StigptConversationListItem,
  StigptExample,
  StigptKnowledgeBaseOption,
  StigptPageConfig,
  StigptRouteModeKey,
  StigptStreamCitationsEvent,
  StigptStreamDeltaEvent,
  StigptStreamDoneEvent,
  StigptStreamErrorEvent,
  StigptStreamHandlers,
  StigptStreamMetaEvent,
} from '../types/stigpt';
import apiClient from './api';

const parseSseBlock = (block: string) => {
  const lines = block.split(/\r?\n/);
  let event = '';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  return {
    event,
    data: dataLines.join('\n'),
  };
};

const normalizeStreamEvent = (
  eventName: string,
  rawData: string,
): StigptStreamMetaEvent | StigptStreamCitationsEvent | StigptStreamDeltaEvent | StigptStreamDoneEvent | StigptStreamErrorEvent | null => {
  if (!rawData) {
    return null;
  }

  const payload = JSON.parse(rawData) as Record<string, unknown>;
  const type = (eventName || payload.type) as
    | 'meta'
    | 'citations'
    | 'delta'
    | 'done'
    | 'error'
    | undefined;

  if (!type) {
    return null;
  }

  return {
    type,
    ...payload,
  } as
    | StigptStreamMetaEvent
    | StigptStreamCitationsEvent
    | StigptStreamDeltaEvent
    | StigptStreamDoneEvent
    | StigptStreamErrorEvent;
};

const emitStreamEvent = async (
  handlers: StigptStreamHandlers,
  event:
    | StigptStreamMetaEvent
    | StigptStreamCitationsEvent
    | StigptStreamDeltaEvent
    | StigptStreamDoneEvent
    | StigptStreamErrorEvent,
) => {
  switch (event.type) {
    case 'meta':
      await handlers.onMeta?.(event);
      return;
    case 'citations':
      await handlers.onCitations?.(event);
      return;
    case 'delta':
      await handlers.onDelta?.(event);
      return;
    case 'done':
      await handlers.onDone?.(event);
      return;
    case 'error':
      await handlers.onError?.(event);
      return;
    default:
      return;
  }
};

export const stigptService = {
  getPageConfig(routeKey = 'webIdx') {
    return apiClient.get<StigptPageConfig, StigptPageConfig>('/stigpt/page-config', {
      params: { routeKey },
    });
  },

  getCurrentUser() {
    return apiClient.get<any, any>('/stigpt/me');
  },

  getModels(routeKey = 'webIdx') {
    return apiClient.get<StigptChatModel[], StigptChatModel[]>('/stigpt/models', {
      params: { routeKey },
    });
  },

  getExamples(routeKey = 'webIdx', modelId?: string) {
    return apiClient.get<StigptExample[], StigptExample[]>('/stigpt/examples', {
      params: { routeKey, modelId },
    });
  },

  getKnowledgeBases(routeKey = 'webIdx', routeMode?: StigptRouteModeKey) {
    return apiClient.get<StigptKnowledgeBaseOption[], StigptKnowledgeBaseOption[]>(
      '/stigpt/knowledge-bases',
      {
        params: { routeKey, routeMode },
      },
    );
  },

  getConversations(routeKey = 'webIdx') {
    return apiClient.get<StigptConversationListItem[], StigptConversationListItem[]>(
      '/stigpt/conversations',
      {
        params: { routeKey },
      },
    );
  },

  createConversation(payload: {
    routeKey?: string;
    routeMode?: StigptRouteModeKey;
    title?: string;
    modelId?: string;
    personaId?: string;
    kbId?: string;
  }) {
    return apiClient.post<StigptConversationDetail, StigptConversationDetail>(
      '/stigpt/conversations',
      payload,
    );
  },

  getConversation(id: string) {
    return apiClient.get<StigptConversationDetail, StigptConversationDetail>(
      `/stigpt/conversations/${id}`,
    );
  },

  sendMessage(
    id: string,
    payload: {
      content: string;
      routeMode?: StigptRouteModeKey;
      modelId?: string;
      kbId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return apiClient.post<StigptConversationDetail, StigptConversationDetail>(
      `/stigpt/conversations/${id}/messages`,
      payload,
    );
  },

  async streamMessage(
    id: string,
    payload: {
      content: string;
      routeMode?: StigptRouteModeKey;
      modelId?: string;
      kbId?: string;
      metadata?: Record<string, unknown>;
    },
    handlers: StigptStreamHandlers,
    signal?: AbortSignal,
  ) {
    const token = localStorage.getItem('stigpt_token');
    const response = await fetch(`${API_BASE_URL}/stigpt/conversations/${id}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      try {
        const errorPayload = (await response.json()) as {
          message?: string;
          data?: { message?: string };
        };
        message =
          errorPayload.message ||
          errorPayload.data?.message ||
          message;
      } catch {
        const text = await response.text();
        if (text) {
          message = text;
        }
      }
      throw new Error(message);
    }

    if (!response.body) {
      throw new Error('Streaming response body is empty');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() || '';

      for (const part of parts) {
        const parsed = parseSseBlock(part);
        const event = normalizeStreamEvent(parsed.event, parsed.data);
        if (!event) {
          continue;
        }
        await emitStreamEvent(handlers, event);
      }

      if (done) {
        break;
      }
    }

    if (buffer.trim()) {
      const parsed = parseSseBlock(buffer);
      const event = normalizeStreamEvent(parsed.event, parsed.data);
      if (event) {
        await emitStreamEvent(handlers, event);
      }
    }
  },
};
