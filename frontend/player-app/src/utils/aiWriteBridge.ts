import type {
  AiWriteContextPayload,
  AiWriteCreateRequest,
  AiWriteRecordKind,
} from '../types/ai-write';

const AI_WRITE_SEED_STORAGE_KEY_PREFIX = 'stigpt_pending_ai_write_seed:';

export type AiWriteSeedSource = 'ai-check' | 'ai-review';

export interface PendingAiWriteSeed {
  version: 1;
  kind: AiWriteRecordKind;
  source: AiWriteSeedSource;
  sourceRecordId?: string;
  sourceTaskType?: string;
  sourceTitle?: string;
  reason?: string;
  draft: {
    title?: string;
    kbId?: string;
    researchField?: string;
    backgroundKeywords?: string[];
    backgroundInnovation?: string[];
    backgroundDescription?: string;
    methodKeywords?: string[];
    methodInnovation?: string[];
    methodDescription?: string;
    collaboratorSuggestions?: string;
    summary?: string;
    coreKeywords?: string[];
    references?: string;
  };
}

type DetailPathParams =
  | URLSearchParams
  | Record<string, string | number | boolean | null | undefined>;

type DraftSeed = PendingAiWriteSeed['draft'];

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
};

const normalizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
};

const normalizeTagValues = (values?: string[], limit = 5): string[] =>
  Array.from(
    new Set(
      (values || [])
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, limit),
    ),
  );

const compactContext = (context: Record<string, unknown>): AiWriteContextPayload =>
  Object.entries(context).reduce<AiWriteContextPayload>((accumulator, [key, value]) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        accumulator[key] = trimmed;
      }
      return accumulator;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        accumulator[key] = value;
      }
      return accumulator;
    }

    if (value !== null && typeof value !== 'undefined') {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});

const buildKeywords = (draft: DraftSeed): string[] => {
  const coreKeywords = normalizeTagValues(draft.coreKeywords, 8);
  const backgroundKeywords = normalizeTagValues(draft.backgroundKeywords, 5);
  const methodKeywords = normalizeTagValues(draft.methodKeywords, 5);

  return Array.from(
    new Set([...coreKeywords, ...backgroundKeywords, ...methodKeywords]),
  ).slice(0, 12);
};

const buildFallbackTitle = (seed: PendingAiWriteSeed): string => {
  const sourceTitle = normalizeString(seed.sourceTitle)?.replace(/\.[^.]+$/, '').trim();
  const researchField = normalizeString(seed.draft.researchField);

  if (normalizeString(seed.draft.title)) {
    return normalizeString(seed.draft.title) as string;
  }

  if (sourceTitle) {
    return sourceTitle;
  }

  if (researchField) {
    return seed.kind === 'paper' ? `${researchField}写作草稿` : `${researchField}申请草稿`;
  }

  return seed.kind === 'paper' ? '论文整改写作草稿' : '项目整改写作草稿';
};

const normalizeDraft = (value: unknown): PendingAiWriteSeed['draft'] => {
  if (!isObjectRecord(value)) {
    return {};
  }

  return {
    title: normalizeString(value.title),
    kbId: normalizeString(value.kbId),
    researchField: normalizeString(value.researchField),
    backgroundKeywords: normalizeStringArray(value.backgroundKeywords),
    backgroundInnovation: normalizeStringArray(value.backgroundInnovation),
    backgroundDescription: normalizeString(value.backgroundDescription),
    methodKeywords: normalizeStringArray(value.methodKeywords),
    methodInnovation: normalizeStringArray(value.methodInnovation),
    methodDescription: normalizeString(value.methodDescription),
    collaboratorSuggestions: normalizeString(value.collaboratorSuggestions),
    summary: normalizeString(value.summary),
    coreKeywords: normalizeStringArray(value.coreKeywords),
    references: normalizeString(value.references),
  };
};

const getStorageKey = (seedKey: string): string => `${AI_WRITE_SEED_STORAGE_KEY_PREFIX}${seedKey}`;

const parseSeed = (raw: string): PendingAiWriteSeed | null => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObjectRecord(parsed)) {
      return null;
    }

    const kind = parsed.kind === 'paper' ? 'paper' : parsed.kind === 'project' ? 'project' : null;
    const source =
      parsed.source === 'ai-check'
        ? 'ai-check'
        : parsed.source === 'ai-review'
          ? 'ai-review'
          : null;

    if (!kind || !source) {
      return null;
    }

    return {
      version: 1,
      kind,
      source,
      sourceRecordId: normalizeString(parsed.sourceRecordId),
      sourceTaskType: normalizeString(parsed.sourceTaskType),
      sourceTitle: normalizeString(parsed.sourceTitle),
      reason: normalizeString(parsed.reason),
      draft: normalizeDraft(parsed.draft),
    };
  } catch {
    return null;
  }
};

export const savePendingAiWriteSeed = (seed: PendingAiWriteSeed): string => {
  const seedKey = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(getStorageKey(seedKey), JSON.stringify(seed));
  return seedKey;
};

export const readPendingAiWriteSeed = (seedKey?: string | null): PendingAiWriteSeed | null => {
  if (!seedKey) {
    return null;
  }

  const raw = window.sessionStorage.getItem(getStorageKey(seedKey));
  if (!raw) {
    return null;
  }

  return parseSeed(raw);
};

export const clearPendingAiWriteSeed = (seedKey?: string | null): void => {
  if (!seedKey) {
    return;
  }

  window.sessionStorage.removeItem(getStorageKey(seedKey));
};

export const buildAiWriteCreateRequestFromSeed = (
  seed: PendingAiWriteSeed,
): AiWriteCreateRequest => {
  const title = buildFallbackTitle(seed);
  const researchField = normalizeString(seed.draft.researchField);
  const kbId = normalizeString(seed.draft.kbId);
  const backgroundKeywords = normalizeTagValues(seed.draft.backgroundKeywords, 5);
  const backgroundInnovation = normalizeTagValues(seed.draft.backgroundInnovation, 5);
  const methodKeywords = normalizeTagValues(seed.draft.methodKeywords, 5);
  const methodInnovation = normalizeTagValues(seed.draft.methodInnovation, 5);
  const coreKeywords = normalizeTagValues(seed.draft.coreKeywords, 8);

  return {
    kind: seed.kind,
    title,
    researchField,
    keywords: buildKeywords(seed.draft),
    kbId,
    context: compactContext({
      researchField,
      backgroundKeywords,
      backgroundInnovation,
      backgroundDescription: normalizeString(seed.draft.backgroundDescription),
      methodKeywords,
      methodInnovation,
      methodDescription: normalizeString(seed.draft.methodDescription),
      collaboratorSuggestions: normalizeString(seed.draft.collaboratorSuggestions),
      title,
      summary: normalizeString(seed.draft.summary),
      coreKeywords,
      references: normalizeString(seed.draft.references),
      kbId,
      bridgeSource: seed.source,
      bridgeSourceTitle: normalizeString(seed.sourceTitle),
      bridgeSourceRecordId: normalizeString(seed.sourceRecordId),
      bridgeSourceTaskType: normalizeString(seed.sourceTaskType),
      bridgeReason: normalizeString(seed.reason),
    }),
  };
};

export const buildAiWriteDetailPath = (
  kind: AiWriteRecordKind,
  params?: DetailPathParams,
): string => {
  const pathname =
    kind === 'paper' ? '/apps/stigpt/write/detail/essay' : '/apps/stigpt/write/detail';

  if (!params) {
    return pathname;
  }

  const search =
    params instanceof URLSearchParams
      ? params
      : Object.entries(params).reduce((accumulator, [key, value]) => {
          if (value !== null && typeof value !== 'undefined' && `${value}`.trim()) {
            accumulator.set(key, String(value));
          }
          return accumulator;
        }, new URLSearchParams());

  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
};

export const getAiWriteSeedSourceLabel = (source: AiWriteSeedSource): string =>
  source === 'ai-check' ? 'AI 检查' : 'AI 评审';
