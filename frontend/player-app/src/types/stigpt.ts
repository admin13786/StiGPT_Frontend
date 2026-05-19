export type StigptRouteModeKey = 'policy' | 'project' | 'aiRead';

export interface StigptRouteModeDefinition {
  key: StigptRouteModeKey;
  label: string;
  description: string;
}

export interface StigptPageFeatureFlags {
  streaming?: boolean;
  citations?: boolean;
  routeModes?: boolean;
}

export interface StigptPageRuntimeConfig {
  layout?: string;
  defaultRouteMode?: StigptRouteModeKey;
  routeModes?: StigptRouteModeDefinition[];
  features?: StigptPageFeatureFlags;
}

export interface StigptPageConfig {
  id: string;
  routeKey: string;
  pageTitle: string;
  assistantName: string;
  welcomeMessage: string;
  inputPlaceholder: string;
  config?: StigptPageRuntimeConfig;
  isActive: boolean;
}

export interface StigptChatModel {
  id: string;
  code: string;
  name: string;
  description?: string;
  provider: string;
  supportedRoutes: string[];
  isDefault: boolean;
  isActive: boolean;
}

export interface StigptKnowledgeBaseOption {
  id: string;
  name: string;
  description?: string | null;
  aclScope: string;
  documentCount: number;
  chunkCount: number;
  updatedAt: string;
  recommended: boolean;
  recommendationScore: number;
  recommendationReason: string;
}

export interface StigptExample {
  id: string;
  routeKey: string;
  modelId?: string | null;
  title: string;
  prompt: string;
  sortOrder: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface StigptCitation {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
  chunkIndex: number;
}

export interface StigptTokenUsage {
  prompt: number;
  completion: number;
  total: number;
  streamed?: boolean;
}

export interface StigptConversationMetadata {
  source?: string;
  routeMode?: StigptRouteModeKey;
  routeLabel?: string;
  modelId?: string | null;
  kbId?: string | null;
  [key: string]: unknown;
}

export interface StigptMessageMetadata {
  source?: string;
  routeMode?: StigptRouteModeKey;
  routeLabel?: string;
  modelId?: string | null;
  kbId?: string | null;
  hasCitations?: boolean;
  degraded?: boolean;
  errorMessage?: string | null;
  [key: string]: unknown;
}

export interface StigptMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  status: string;
  citations?: StigptCitation[];
  tokenUsage?: StigptTokenUsage;
  metadata?: StigptMessageMetadata;
  createdAt: string;
}

export interface StigptConversationListItem {
  id: string;
  userId: string;
  routeKey: string;
  title: string;
  modelId?: string | null;
  personaId?: string | null;
  kbId?: string | null;
  status: string;
  metadata?: StigptConversationMetadata;
  lastMessageAt?: string | null;
  createdAt: string;
  updatedAt: string;
  model?: {
    id: string;
    code: string;
    name: string;
    provider: string;
  } | null;
  _count?: {
    messages: number;
  };
}

export interface StigptConversationDetail extends StigptConversationListItem {
  messages: StigptMessage[];
}

export interface StigptStreamMetaEvent {
  type: 'meta';
  conversationId: string;
  conversationTitle: string;
  routeKey: string;
  routeMode: StigptRouteModeKey;
  routeLabel: string;
  userMessageId: string;
  assistantMessageId: string;
  modelId?: string | null;
  modelName?: string | null;
  kbId?: string | null;
}

export interface StigptStreamCitationsEvent {
  type: 'citations';
  assistantMessageId: string;
  citations: StigptCitation[];
}

export interface StigptStreamDeltaEvent {
  type: 'delta';
  assistantMessageId: string;
  delta: string;
}

export interface StigptStreamDoneEvent {
  type: 'done';
  conversationId: string;
  assistantMessageId: string;
  routeMode: StigptRouteModeKey;
  tokenUsage: StigptTokenUsage;
  degraded?: boolean;
}

export interface StigptStreamErrorEvent {
  type: 'error';
  message: string;
}

export type StigptStreamEvent =
  | StigptStreamMetaEvent
  | StigptStreamCitationsEvent
  | StigptStreamDeltaEvent
  | StigptStreamDoneEvent
  | StigptStreamErrorEvent;

export interface StigptStreamHandlers {
  onMeta?: (event: StigptStreamMetaEvent) => void | Promise<void>;
  onCitations?: (event: StigptStreamCitationsEvent) => void | Promise<void>;
  onDelta?: (event: StigptStreamDeltaEvent) => void | Promise<void>;
  onDone?: (event: StigptStreamDoneEvent) => void | Promise<void>;
  onError?: (event: StigptStreamErrorEvent) => void | Promise<void>;
}
