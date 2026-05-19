import { isAxiosError } from 'axios';
import apiClient from './api';
import type {
  AiWriteNextAction,
  AiWriteOperation,
  AiWriteGenerationMode,
  AiWriteStage,
  AiWriteCreatePayload,
  AiWriteCreateRequest,
  AiWriteContextPayload,
  AiWriteListDto,
  AiWriteListItemDto,
  AiWriteListQuery,
  AiWriteListResult,
  AiWriteOutlineSection,
  AiWriteRecord,
  AiWriteRecordDetail,
  AiWriteSectionContent,
  AiWriteTaskDto,
  AiWriteUpdateRequest,
  AiWriteExecutionMeta,
  AiWriteDependencySnapshot,
} from '../types/ai-write';
import {
  AI_WRITE_BACKEND_TYPE_TO_KIND,
  AI_WRITE_KIND_OPTIONS,
  AI_WRITE_KIND_TO_BACKEND_TYPE,
  AI_WRITE_NEXT_ACTION_META,
  AI_WRITE_OPERATION_META,
  AI_WRITE_STAGE_META,
  AI_WRITE_STATUS_META,
  AI_WRITE_STATUS_PROGRESS,
} from '../types/ai-write';

const unsupportedStatuses = new Set([404, 405, 501]);

const coerceTaskArray = (payload: unknown): AiWriteListItemDto[] => {
  if (Array.isArray(payload)) {
    return payload as AiWriteListItemDto[];
  }

  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>;
    if (Array.isArray(container.records)) {
      return container.records as AiWriteListItemDto[];
    }
    if (Array.isArray(container.items)) {
      return container.items as AiWriteListItemDto[];
    }
    if (Array.isArray(container.data)) {
      return container.data as AiWriteListItemDto[];
    }
  }

  return [];
};

const coerceListResult = (
  payload: unknown,
  fallbackPageNo: number,
  fallbackPageSize: number,
): AiWriteListDto => {
  const items = coerceTaskArray(payload);

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      items,
      total: items.length,
      pageNo: fallbackPageNo,
      pageSize: fallbackPageSize,
      totalPages: items.length > 0 ? 1 : 0,
    };
  }

  const container = payload as Record<string, unknown>;
  const total = typeof container.total === 'number' ? container.total : items.length;
  const pageNo = typeof container.pageNo === 'number' ? container.pageNo : fallbackPageNo;
  const pageSize =
    typeof container.pageSize === 'number' ? container.pageSize : fallbackPageSize;
  const totalPages =
    typeof container.totalPages === 'number'
      ? container.totalPages
      : pageSize > 0
        ? Math.ceil(total / pageSize)
        : 0;

  return {
    items,
    total,
    pageNo,
    pageSize,
    totalPages,
  };
};

const parseKeywords = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => Boolean(item) && !looksCorruptedText(item));
};

const looksCorruptedText = (value?: string | null): boolean => {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (/^[?？�]+$/u.test(trimmed)) {
    return true;
  }

  const corruptedChars = (trimmed.match(/[?？�]/gu) || []).length;
  return corruptedChars / trimmed.length > 0.45;
};

const sanitizeText = (value?: string | null, fallback = ''): string => {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed && !looksCorruptedText(trimmed) ? trimmed : fallback;
};

const isRecordObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const resolveStructuredContent = (value: unknown): Record<string, unknown> => {
  if (!isRecordObject(value)) {
    return {};
  }

  if (isRecordObject(value.__sections)) {
    return value.__sections;
  }

  return value;
};

const parseContext = (value: unknown): AiWriteContextPayload | null => {
  if (!isRecordObject(value)) {
    return null;
  }

  if (isRecordObject(value.__profile)) {
    return value.__profile;
  }

  if (isRecordObject(value.context)) {
    return value.context;
  }

  return null;
};

const normalizeGenerationMode = (value: unknown): AiWriteGenerationMode =>
  value === 'mixed' || value === 'fallback' ? value : 'llm';

const normalizeDependencySnapshot = (
  value: unknown,
  fallback: AiWriteDependencySnapshot,
): AiWriteDependencySnapshot => {
  if (!isRecordObject(value)) {
    return fallback;
  }

  const state = value.state;
  const allowedStates = new Set([
    'ready',
    'not_requested',
    'missing_config',
    'unauthorized',
    'rate_limited',
    'timeout',
    'unavailable',
    'empty',
  ]);

  return {
    state: allowedStates.has(String(state)) ? (String(state) as AiWriteDependencySnapshot['state']) : fallback.state,
    message:
      typeof value.message === 'string' && value.message.trim()
        ? value.message.trim()
        : fallback.message,
    checkedAt:
      typeof value.checkedAt === 'string' && value.checkedAt.trim()
        ? value.checkedAt.trim()
        : fallback.checkedAt,
    provider:
      typeof value.provider === 'string' && value.provider.trim()
        ? value.provider.trim()
        : fallback.provider,
    model:
      typeof value.model === 'string' && value.model.trim() ? value.model.trim() : fallback.model,
    kbId:
      typeof value.kbId === 'string' && value.kbId.trim() ? value.kbId.trim() : fallback.kbId,
  };
};

const parseExecutionMeta = (value: unknown): AiWriteExecutionMeta | null => {
  if (!isRecordObject(value)) {
    return null;
  }

  const source = isRecordObject(value.__execution) ? value.__execution : value;

  const llmFallback: AiWriteDependencySnapshot = {
    state: 'unavailable',
    message: '当前未返回大模型执行信息。',
    checkedAt: new Date().toISOString(),
  };
  const knowledgeFallback: AiWriteDependencySnapshot = {
    state: 'not_requested',
    message: '当前未返回知识库执行信息。',
    checkedAt: new Date().toISOString(),
  };

  return {
    lastStage:
      typeof source.lastStage === 'string' && source.lastStage.trim()
        ? source.lastStage.trim()
        : 'idle',
    generationMode: normalizeGenerationMode(source.generationMode),
    warnings: Array.isArray(source.warnings)
      ? source.warnings
          .filter(
            (item): item is string =>
              typeof item === 'string' && Boolean(item.trim()),
          )
          .map((item) => item.trim())
          .slice(0, 6)
      : [],
    updatedAt:
      typeof source.updatedAt === 'string' && source.updatedAt.trim()
        ? source.updatedAt.trim()
        : new Date().toISOString(),
    llm: normalizeDependencySnapshot(source.llm, llmFallback),
    knowledge: normalizeDependencySnapshot(source.knowledge, knowledgeFallback),
    history: Array.isArray(source.history)
      ? source.history
          .filter((item): item is Record<string, unknown> => isRecordObject(item))
          .map((item) => ({
            stage:
              typeof item.stage === 'string' && item.stage.trim() ? item.stage.trim() : 'unknown',
            mode: normalizeGenerationMode(item.mode),
            warnings: Array.isArray(item.warnings)
              ? item.warnings
                  .filter(
                    (warning): warning is string =>
                      typeof warning === 'string' && Boolean(warning.trim()),
                  )
                  .map((warning) => warning.trim())
                  .slice(0, 6)
              : [],
            at: typeof item.at === 'string' && item.at.trim() ? item.at.trim() : new Date().toISOString(),
            llm: normalizeDependencySnapshot(item.llm, llmFallback),
            knowledge: normalizeDependencySnapshot(item.knowledge, knowledgeFallback),
          }))
          .slice(-8)
      : [],
  };
};

const parseOutline = (value: unknown): AiWriteOutlineSection[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return {
          title: `章节 ${index + 1}`,
        };
      }

      const section = item as Record<string, unknown>;
      return {
        title:
          typeof section.title === 'string' && section.title.trim()
            ? section.title.trim()
            : `章节 ${index + 1}`,
        description:
          typeof section.description === 'string' && section.description.trim()
            ? section.description.trim()
            : undefined,
        minWords: typeof section.minWords === 'number' ? section.minWords : undefined,
      };
    })
    .filter((section) => section.title);
};

const parseContentMap = (value: unknown): Record<string, string> => {
  const container = resolveStructuredContent(value);
  if (!isRecordObject(container)) {
    return {};
  }

  return Object.entries(container).reduce<Record<string, string>>(
    (accumulator, [key, item]) => {
      if (typeof item === 'string' && item.trim()) {
        accumulator[key] = item.trim();
      }
      return accumulator;
    },
    {},
  );
};

const extractTextPayload = (payload: unknown): string => {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>;
    const candidateKeys = ['content', 'fullText', 'text', 'result', 'data'];
    const match = candidateKeys.find(
      (key) => typeof container[key] === 'string' && (container[key] as string).trim(),
    );
    if (match) {
      return (container[match] as string).trim();
    }
  }

  return '';
};

const stripPreviewText = (value: string): string =>
  value
    .replace(/[#>*`_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const countTextUnits = (value?: string | null): number => {
  const normalized = stripPreviewText(value || '');
  if (!normalized) {
    return 0;
  }

  const cjkCount = (normalized.match(/[\u4e00-\u9fff]/g) || []).length;
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return Math.max(cjkCount, wordCount);
};

const buildPreviewText = (
  fullText: string | null | undefined,
  sections: AiWriteSectionContent[],
  outline: AiWriteOutlineSection[],
): string => {
  if (fullText?.trim() && !looksCorruptedText(fullText)) {
    return stripPreviewText(fullText).slice(0, 180);
  }

  const firstSection = sections.find((item) => item.content.trim());
  if (firstSection) {
    return stripPreviewText(firstSection.content).slice(0, 180);
  }

  const firstOutline = outline.find((item) => item.description?.trim());
  if (firstOutline?.description) {
    return stripPreviewText(firstOutline.description).slice(0, 180);
  }

  return '尚未生成正文内容，可先创建记录并推进提纲与章节。';
};

const buildSections = (
  outline: AiWriteOutlineSection[],
  contentMap: Record<string, string>,
): AiWriteSectionContent[] => {
  const sectionIndexes = new Set([
    ...outline.map((_, index) => index),
    ...Object.keys(contentMap)
      .map((key) => Number.parseInt(key, 10))
      .filter((value) => Number.isFinite(value)),
  ]);

  return Array.from(sectionIndexes)
    .sort((left, right) => left - right)
    .map((index) => ({
      index,
      title: outline[index]?.title || `章节 ${index + 1}`,
      description: outline[index]?.description,
      minWords: outline[index]?.minWords,
      content: contentMap[String(index)] || '',
    }))
    .filter((section) => section.content || section.title);
};

const resolveTypeLabel = (kind: AiWriteRecord['kind']): string =>
  AI_WRITE_KIND_OPTIONS.find((option) => option.value === kind)?.label || '写作记录';

const resolveGenerationModeLabel = (mode: AiWriteGenerationMode): string => {
  if (mode === 'fallback') {
    return '降级草稿';
  }
  if (mode === 'mixed') {
    return '混合生成';
  }

  return '真生成';
};

const resolveCompletionPercent = (
  outlineCount: number,
  generatedSectionCount: number,
  hasFullText: boolean,
): number => {
  if (hasFullText) {
    return 100;
  }

  if (outlineCount === 0) {
    return 10;
  }

  if (generatedSectionCount === 0) {
    return 35;
  }

  return Math.min(92, 35 + Math.round((generatedSectionCount / outlineCount) * 57));
};

const resolveSummaryPreviewText = (task: AiWriteListItemDto): string => {
  const outline = parseOutline(task.outline);
  const contentMap = parseContentMap(task.content);
  const sections = buildSections(outline, contentMap);
  const contentPreview = buildPreviewText(task.fullText, sections, outline);

  if (contentPreview !== '尚未生成正文内容，可先创建记录并推进提纲与章节。') {
    return contentPreview;
  }

  const sanitizedResearchField = sanitizeText(task.researchField);
  if (sanitizedResearchField) {
    return `研究方向：${sanitizedResearchField}`;
  }

  const keywords = parseKeywords(task.keywords);
  if (keywords.length > 0) {
    return `关键词：${keywords.slice(0, 4).join(' / ')}`;
  }

  return contentPreview;
};

const resolvePendingSectionCount = (
  outlineCount: number,
  generatedSectionCount: number,
  hasFullText: boolean,
) => {
  if (hasFullText) {
    return 0;
  }

  return Math.max(outlineCount - generatedSectionCount, 0);
};

const resolveNextSectionIndex = (
  sections: AiWriteSectionContent[],
  outlineCount: number,
): number | null => {
  for (let index = 0; index < outlineCount; index += 1) {
    const section = sections.find((item) => item.index === index);
    if (!section?.content.trim()) {
      return index;
    }
  }

  return null;
};

const resolveStage = (
  status: string,
  hasOutline: boolean,
  pendingSectionCount: number,
  hasFullText: boolean,
): AiWriteStage => {
  if (status === 'failed') {
    return 'failed';
  }

  if (hasFullText || status === 'completed') {
    return 'completed';
  }

  if (!hasOutline || status === 'created') {
    return 'planning';
  }

  if (pendingSectionCount > 0) {
    return 'drafting';
  }

  return 'polishing';
};

const resolveCurrentOperation = (
  status: string,
  hasOutline: boolean,
  pendingSectionCount: number,
  hasFullText: boolean,
): AiWriteOperation | null => {
  if (status !== 'generating') {
    return null;
  }

  if (!hasOutline) {
    return 'outline';
  }

  if (pendingSectionCount > 0) {
    return 'section';
  }

  if (!hasFullText) {
    return 'polish';
  }

  return null;
};

const resolveNextAction = (
  status: string,
  hasOutline: boolean,
  pendingSectionCount: number,
  hasFullText: boolean,
): AiWriteNextAction => {
  if (status === 'generating') {
    return 'wait';
  }

  if (status === 'completed' || hasFullText) {
    return 'view_result';
  }

  if (!hasOutline || status === 'created') {
    return 'generate_outline';
  }

  if (pendingSectionCount > 0) {
    return 'generate_next_section';
  }

  return 'polish';
};

const buildStatusHint = (
  stage: AiWriteStage,
  pendingSectionCount: number,
  nextAction: AiWriteNextAction,
  nextSectionIndex: number | null,
) => {
  if (nextAction === 'wait') {
    return '任务正在处理中，页面会自动刷新状态。';
  }

  if (nextAction === 'generate_next_section') {
    return nextSectionIndex !== null
      ? `建议继续生成第 ${nextSectionIndex + 1} 节，当前还剩 ${pendingSectionCount} 节待写。`
      : '建议继续推进下一节正文。';
  }

  if (nextAction === 'polish') {
    return '章节主体已准备完成，可以执行全文润色。';
  }

  if (nextAction === 'view_result') {
    return '写作任务已完成，可直接查看最终稿。';
  }

  if (stage === 'failed') {
    return '最近一次处理失败，建议重新触发下一步操作。';
  }

  return AI_WRITE_NEXT_ACTION_META[nextAction].description;
};

const buildSummary = (records: AiWriteRecord[]) => {
  const totalCompletion = records.reduce(
    (sum, item) => sum + item.completionPercent,
    0,
  );

  return {
    total: records.length,
    active: records.filter((item) => item.isActive).length,
    planning: records.filter((item) => item.stage === 'planning').length,
    drafting: records.filter((item) => item.stage === 'drafting').length,
    polishing: records.filter((item) => item.stage === 'polishing').length,
    completed: records.filter((item) => item.stage === 'completed').length,
    failed: records.filter((item) => item.stage === 'failed').length,
    actionable: records.filter(
      (item) => item.nextAction !== 'wait' && item.nextAction !== 'view_result',
    ).length,
    averageCompletionPercent:
      records.length > 0 ? Math.round(totalCompletion / records.length) : 0,
  };
};

const normalizeRecord = (task: AiWriteTaskDto): AiWriteRecordDetail => {
  const kind =
    AI_WRITE_BACKEND_TYPE_TO_KIND[task.type as keyof typeof AI_WRITE_BACKEND_TYPE_TO_KIND] ||
    'project';
  const executionMeta =
    parseExecutionMeta(task.executionMeta) || parseExecutionMeta(task.content) || null;
  const outline = parseOutline(task.outline);
  const contentMap = parseContentMap(task.content);
  const sections = buildSections(outline, contentMap);
  const generatedSectionCount = sections.filter((item) => item.content.trim()).length;
  const hasFullText = Boolean(task.hasFullText) || Boolean(task.fullText?.trim());
  const pendingSectionCount = resolvePendingSectionCount(
    outline.length,
    generatedSectionCount,
    hasFullText,
  );
  const nextSectionIndex = resolveNextSectionIndex(sections, outline.length);
  const stage = resolveStage(
    task.status,
    outline.length > 0,
    pendingSectionCount,
    hasFullText,
  );
  const currentOperation = resolveCurrentOperation(
    task.status,
    outline.length > 0,
    pendingSectionCount,
    hasFullText,
  );
  const nextAction = resolveNextAction(
    task.status,
    outline.length > 0,
    pendingSectionCount,
    hasFullText,
  );
  const wordCount = countTextUnits(
    task.fullText ||
      sections
        .map((section) => section.content)
        .join('\n\n'),
  );
  const statusMeta = AI_WRITE_STATUS_META[task.status] || {
    label: task.status || '未知状态',
    color: 'default',
  };

  return {
    id: task.id,
    title: sanitizeText(task.title, '未命名写作记录'),
    kind,
    backendType: task.type,
    typeLabel: resolveTypeLabel(kind),
    researchField: sanitizeText(task.researchField || null) || null,
    keywords: parseKeywords(task.keywords),
    kbId: task.kbId || null,
    status: task.status,
    statusLabel: statusMeta.label,
    statusColor: statusMeta.color,
    hasOutline: outline.length > 0,
    outlineCount: outline.length,
    generatedSectionCount,
    pendingSectionCount,
    nextSectionIndex,
    completionPercent: resolveCompletionPercent(outline.length, generatedSectionCount, hasFullText),
    previewText: buildPreviewText(task.fullText, sections, outline),
    hasFullText,
    wordCount,
    sectionCompletionPercent:
      outline.length > 0 ? Math.round((generatedSectionCount / outline.length) * 100) : 0,
    stage,
    stageLabel: AI_WRITE_STAGE_META[stage].label,
    statusHint: buildStatusHint(stage, pendingSectionCount, nextAction, nextSectionIndex),
    isActive: task.status === 'generating',
    currentOperation,
    currentOperationLabel: currentOperation
      ? AI_WRITE_OPERATION_META[currentOperation].label
      : null,
    currentSectionIndex:
      currentOperation === 'section' && nextSectionIndex !== null
        ? nextSectionIndex
        : null,
    nextAction,
    nextActionLabel: AI_WRITE_NEXT_ACTION_META[nextAction].label,
    nextActionHint: AI_WRITE_NEXT_ACTION_META[nextAction].description,
    activeSince: task.status === 'generating' ? task.updatedAt : null,
    generationMode: executionMeta?.generationMode || 'llm',
    generationModeLabel: executionMeta
      ? resolveGenerationModeLabel(executionMeta.generationMode)
      : '待生成',
    executionMeta,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    context: task.context || parseContext(task.content),
    outline,
    sections,
    fullText: task.fullText || null,
    errorMessage: task.errorMessage || null,
  };
};

const normalizeListRecord = (task: AiWriteListItemDto): AiWriteRecord => {
  const backendType = task.taskType || task.type;
  const kind =
    AI_WRITE_BACKEND_TYPE_TO_KIND[backendType as keyof typeof AI_WRITE_BACKEND_TYPE_TO_KIND] ||
    AI_WRITE_BACKEND_TYPE_TO_KIND[task.type as keyof typeof AI_WRITE_BACKEND_TYPE_TO_KIND] ||
    'project';
  const executionMeta =
    parseExecutionMeta(task.executionMeta) ||
    parseExecutionMeta(task.content) ||
    null;
  const outline = parseOutline(task.outline);
  const contentMap = parseContentMap(task.content);
  const sections = buildSections(outline, contentMap);
  const generatedSectionCount = sections.filter((item) => item.content.trim()).length;
  const hasOutline = Boolean(task.hasOutline) || outline.length > 0;
  const hasFullText = Boolean(task.hasFullText) || Boolean(task.fullText?.trim());
  const outlineCount = outline.length > 0 ? outline.length : hasOutline ? 1 : 0;
  const pendingSectionCount = resolvePendingSectionCount(
    outlineCount,
    generatedSectionCount,
    hasFullText,
  );
  const nextSectionIndex =
    typeof task.nextSectionIndex === 'number'
      ? task.nextSectionIndex
      : resolveNextSectionIndex(sections, outlineCount);
  const stage = resolveStage(task.status, hasOutline, pendingSectionCount, hasFullText);
  const currentOperation = resolveCurrentOperation(
    task.status,
    hasOutline,
    pendingSectionCount,
    hasFullText,
  );
  const nextAction = resolveNextAction(
    task.status,
    hasOutline,
    pendingSectionCount,
    hasFullText,
  );
  const statusMeta = AI_WRITE_STATUS_META[task.status] || {
    label: task.status || '未知状态',
    color: 'default',
  };

  return {
    id: task.id,
    title: sanitizeText(task.title, '未命名写作记录'),
    kind,
    backendType,
    typeLabel: resolveTypeLabel(kind),
    researchField: sanitizeText(task.researchField || null) || null,
    keywords: parseKeywords(task.keywords),
    kbId: null,
    status: task.status,
    statusLabel: statusMeta.label,
    statusColor: statusMeta.color,
    hasOutline,
    outlineCount,
    generatedSectionCount,
    pendingSectionCount,
    nextSectionIndex,
    completionPercent:
      hasOutline || hasFullText || generatedSectionCount > 0
        ? resolveCompletionPercent(
            Math.max(outlineCount, hasOutline ? 1 : 0),
            generatedSectionCount || (hasFullText ? 1 : 0),
            hasFullText,
          )
        : AI_WRITE_STATUS_PROGRESS[task.status] || 10,
    previewText: sanitizeText(resolveSummaryPreviewText(task), '尚未生成正文内容，可先进入详情页完善资料。'),
    hasFullText,
    wordCount:
      typeof task.wordCount === 'number'
        ? task.wordCount
        : countTextUnits(task.fullText || sections.map((item) => item.content).join('\n\n')),
    sectionCompletionPercent:
      outlineCount > 0 ? Math.round((generatedSectionCount / outlineCount) * 100) : 0,
    stage,
    stageLabel: AI_WRITE_STAGE_META[stage].label,
    statusHint: buildStatusHint(stage, pendingSectionCount, nextAction, nextSectionIndex),
    isActive: task.status === 'generating',
    currentOperation,
    currentOperationLabel: currentOperation
      ? AI_WRITE_OPERATION_META[currentOperation].label
      : null,
    currentSectionIndex:
      currentOperation === 'section' && nextSectionIndex !== null
        ? nextSectionIndex
        : null,
    nextAction,
    nextActionLabel: AI_WRITE_NEXT_ACTION_META[nextAction].label,
    nextActionHint: AI_WRITE_NEXT_ACTION_META[nextAction].description,
    activeSince: task.status === 'generating' ? task.updatedAt : null,
    generationMode: executionMeta?.generationMode || 'llm',
    generationModeLabel: executionMeta
      ? resolveGenerationModeLabel(executionMeta.generationMode)
      : '待生成',
    executionMeta,
    context: parseContext(task.content),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
};

const sortRecords = (records: AiWriteRecord[]): AiWriteRecord[] =>
  [...records].sort((left, right) => {
    const rightTime = Date.parse(right.updatedAt || right.createdAt);
    const leftTime = Date.parse(left.updatedAt || left.createdAt);
    return rightTime - leftTime;
  });

export const getAiWriteErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError(error)) {
    const serverMessage = error.response?.data;
    if (typeof serverMessage === 'string' && serverMessage.trim()) {
      return serverMessage;
    }

    if (
      serverMessage &&
      typeof serverMessage === 'object' &&
      'message' in serverMessage &&
      typeof serverMessage.message === 'string'
    ) {
      return serverMessage.message;
    }

    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

export const isAiWriteIntegrationUnavailable = (error: unknown): boolean =>
  isAxiosError(error) && unsupportedStatuses.has(error.response?.status || 0);

export const aiWriteService = {
  async listRecords(query: AiWriteListQuery = {}): Promise<AiWriteListResult> {
    const pageNo = query.pageNo || 1;
    const pageSize = query.pageSize || 10;

    try {
      const payload = await apiClient.get<unknown, unknown>('/ai-write/list', {
        params: {
          type: query.kind,
          searchKey: query.searchKey,
          writingTime: query.writingTime,
          pageNo,
          pageSize,
        },
      });

      const result = coerceListResult(payload, pageNo, pageSize);
      const records = sortRecords(result.items.map(normalizeListRecord));

      return {
        integrationAvailable: true,
        records,
        summary: buildSummary(records),
        total: result.total,
        pageNo: result.pageNo,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      };
    } catch (error) {
      if (isAiWriteIntegrationUnavailable(error)) {
        return {
          integrationAvailable: false,
          records: [],
          summary: buildSummary([]),
          total: 0,
          pageNo,
          pageSize,
          totalPages: 0,
        };
      }

      throw error;
    }
  },

  async getRecord(id: string): Promise<AiWriteRecordDetail> {
    const payload = await apiClient.get<AiWriteTaskDto, AiWriteTaskDto>(`/ai-write/${id}`);
    return normalizeRecord(payload);
  },

  async createRecord(payload: AiWriteCreateRequest): Promise<AiWriteRecordDetail> {
    const createPayload: AiWriteCreatePayload = {
      type: AI_WRITE_KIND_TO_BACKEND_TYPE[payload.kind],
      title: payload.title.trim(),
      researchField: payload.researchField?.trim() || undefined,
      keywords:
        payload.keywords
          ?.map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 12) || [],
      kbId: payload.kbId?.trim() || undefined,
      context: payload.context,
    };

    const record = await apiClient.post<AiWriteTaskDto, AiWriteTaskDto>(
      '/ai-write/create',
      createPayload,
    );
    return normalizeRecord(record);
  },

  async updateRecordProfile(
    id: string,
    payload: AiWriteUpdateRequest,
  ): Promise<AiWriteRecordDetail> {
    const record = await apiClient.put<AiWriteTaskDto, AiWriteTaskDto>(`/ai-write/${id}/profile`, {
      title: payload.title?.trim() || undefined,
      researchField: payload.researchField?.trim() || undefined,
      keywords:
        payload.keywords
          ?.map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 12) || [],
      kbId: payload.kbId?.trim() || undefined,
      context: payload.context,
    });

    return normalizeRecord(record);
  },

  async deleteRecord(id: string): Promise<void> {
    await apiClient.delete(`/ai-write/${id}`);
  },

  async generateOutline(id: string): Promise<AiWriteOutlineSection[]> {
    const payload = await apiClient.post<unknown, unknown>('/ai-write/generate-outline', {
      taskId: id,
    });
    return parseOutline(payload);
  },

  async generateSection(id: string, sectionIndex: number): Promise<string> {
    const payload = await apiClient.post<unknown, unknown>('/ai-write/generate-section', {
      taskId: id,
      sectionIndex,
    });

    return extractTextPayload(payload);
  },

  async polishRecord(id: string): Promise<string> {
    const payload = await apiClient.post<unknown, unknown>('/ai-write/polish', {
      taskId: id,
    });

    return extractTextPayload(payload);
  },
};
