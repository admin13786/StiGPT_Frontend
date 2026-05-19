import { isAxiosError } from 'axios';
import apiClient from './api';
import type {
  AICheckBusType,
  AICheckFocusFilter,
  AICheckListQuery,
  AICheckListResult,
  AICheckMatchedSource,
  AICheckRecord,
  AICheckReport,
  AICheckReportDetail,
  AICheckRiskLevel,
  AICheckStatus,
  AICheckStatusSnapshot,
  AICheckSummary,
  AICheckTaskDto,
  AICheckUploadPayload,
  AICheckUploadResult,
} from '../types/aiCheck';
import {
  AI_CHECK_BUS_TYPE_LABELS,
  AI_CHECK_REPORT_BUCKET_META,
  AI_CHECK_RISK_META,
  AI_CHECK_STATUS_META,
  AI_CHECK_TRIAGE_META,
} from '../types/aiCheck';

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const EMPTY_SUMMARY: AICheckSummary = {
  total: 0,
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  highRisk: 0,
  mediumRisk: 0,
  lowRisk: 0,
  clean: 0,
  averageSimilarity: 0,
  needsReview: 0,
  lowConfidence: 0,
  withReport: 0,
  staleProcessing: 0,
  attention: 0,
};

const toNonEmptyString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : '';

const toFiniteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const normalizeBusType = (value: string): AICheckBusType => {
  if (value === 'project' || value === 'paper' || value === 'patent') {
    return value;
  }

  return 'paper';
};

const normalizeStatus = (value: string): AICheckStatus => {
  if (
    value === 'pending' ||
    value === 'processing' ||
    value === 'completed' ||
    value === 'failed'
  ) {
    return value;
  }

  return 'pending';
};

const normalizeMatchedSource = (value: unknown): AICheckMatchedSource | undefined => {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  return {
    title: toNonEmptyString(value.title),
    content: toNonEmptyString(value.content),
  };
};

const normalizeReportBucket = (
  value: unknown,
  isDuplicate: boolean,
  similarity: number,
  confidence?: number,
) => {
  if (value === 'duplicate' || value === 'review' || value === 'watch' || value === 'clear') {
    return value;
  }

  if (isDuplicate || similarity >= 0.85) {
    return 'duplicate';
  }

  if (similarity >= 0.7) {
    return 'review';
  }

  if ((typeof confidence === 'number' && confidence < 0.7) || similarity > 0) {
    return 'watch';
  }

  return 'clear';
};

const normalizeReportDetail = (value: unknown, index: number): AICheckReportDetail => {
  if (!isObjectRecord(value)) {
    const fallbackBucket = AI_CHECK_REPORT_BUCKET_META.clear;
    return {
      paragraphIndex: index,
      paragraph: '',
      isDuplicate: false,
      similarity: 0,
      reviewBucket: 'clear',
      reviewLabel: fallbackBucket.label,
      reviewColor: fallbackBucket.color,
      reviewAction: 'Keep this paragraph as-is and treat the current result as the baseline.',
    };
  }

  const confidence = toFiniteNumber(value.confidence);
  const reviewBucket = normalizeReportBucket(
    value.reviewBucket,
    Boolean(value.isDuplicate),
    toFiniteNumber(value.similarity) ?? 0,
    confidence,
  );
  const reviewMeta = AI_CHECK_REPORT_BUCKET_META[reviewBucket];

  return {
    paragraphIndex: toFiniteNumber(value.paragraphIndex) ?? index,
    paragraph: toNonEmptyString(value.paragraph),
    isDuplicate: Boolean(value.isDuplicate),
    similarity: toFiniteNumber(value.similarity) ?? 0,
    matchedSource: normalizeMatchedSource(value.matchedSource),
    judgement: toNonEmptyString(value.judgement) || undefined,
    confidence,
    suggestion: toNonEmptyString(value.suggestion) || undefined,
    reviewBucket,
    reviewLabel: reviewMeta.label,
    reviewColor: reviewMeta.color,
    reviewAction:
      toNonEmptyString(value.reviewAction) ||
      (reviewBucket === 'duplicate'
        ? 'Rewrite or add citations before the next submission pass.'
        : reviewBucket === 'review'
          ? 'Review the overlap manually and decide whether to rewrite, cite, or keep.'
          : reviewBucket === 'watch'
            ? 'Validate the evidence and keep monitoring on the next revision.'
            : 'Keep the paragraph unchanged and treat this result as clear.'),
  };
};

const normalizeRiskLevel = (
  value: unknown,
  overallSimilarity?: number | null,
): AICheckRiskLevel => {
  if (
    value === 'high' ||
    value === 'medium' ||
    value === 'low' ||
    value === 'clean' ||
    value === 'unknown'
  ) {
    return value;
  }

  if (typeof overallSimilarity !== 'number') {
    return 'unknown';
  }

  if (overallSimilarity >= 0.7) {
    return 'high';
  }

  if (overallSimilarity >= 0.45) {
    return 'medium';
  }

  if (overallSimilarity > 0) {
    return 'low';
  }

  return 'clean';
};

const normalizeReport = (value: unknown): AICheckReport | null => {
  if (!isObjectRecord(value)) {
    return null;
  }

  const details = Array.isArray(value.details)
    ? value.details.map(normalizeReportDetail)
    : [];
  const flaggedParagraphs =
    toFiniteNumber(value.flaggedParagraphs) ??
    details.filter((detail) => detail.similarity >= 0.7).length;
  const needsReviewParagraphs =
    toFiniteNumber(value.needsReviewParagraphs) ??
    details.filter((detail) => !detail.isDuplicate && detail.similarity >= 0.7).length;
  const lowConfidenceParagraphs =
    toFiniteNumber(value.lowConfidenceParagraphs) ??
    details.filter(
      (detail) =>
        typeof detail.confidence === 'number' &&
        detail.confidence < 0.7,
    ).length;
  const overallSimilarity = toFiniteNumber(value.overallSimilarity) ?? 0;
  const topSimilarity =
    toFiniteNumber(value.topSimilarity) ??
    details.reduce(
      (max, detail) => Math.max(max, detail.similarity),
      0,
    );
  const topSourceTitle =
    toNonEmptyString(value.topSourceTitle) ||
    details.find((detail) => detail.matchedSource?.title)?.matchedSource?.title ||
    null;
  const confidenceValues = details
    .map((detail) => detail.confidence)
    .filter((confidence): confidence is number => typeof confidence === 'number');
  const attentionCount =
    details.filter(
      (detail) => detail.reviewBucket === 'duplicate' || detail.reviewBucket === 'review',
    ).length;
  const watchCount = details.filter((detail) => detail.reviewBucket === 'watch').length;
  const clearCount = details.filter((detail) => detail.reviewBucket === 'clear').length;

  return {
    overallSimilarity,
    totalParagraphs: toFiniteNumber(value.totalParagraphs) ?? details.length,
    duplicateParagraphs:
      toFiniteNumber(value.duplicateParagraphs) ??
      details.filter((detail) => detail.isDuplicate).length,
    details,
    flaggedParagraphs,
    needsReviewParagraphs,
    lowConfidenceParagraphs,
    topSimilarity,
    topSourceTitle,
    generatedAt: toNonEmptyString(value.generatedAt) || null,
    riskLevel: normalizeRiskLevel(value.riskLevel, overallSimilarity),
    attentionCount: toFiniteNumber(value.attentionCount) ?? attentionCount,
    watchCount: toFiniteNumber(value.watchCount) ?? watchCount,
    clearCount: toFiniteNumber(value.clearCount) ?? clearCount,
    confidenceAverage:
      toFiniteNumber(value.confidenceAverage) ??
      (confidenceValues.length > 0
        ? confidenceValues.reduce((sum, confidence) => sum + confidence, 0) /
          confidenceValues.length
        : null),
  };
};

const coerceTaskArray = (payload: unknown): AICheckTaskDto[] => {
  if (Array.isArray(payload)) {
    return payload as AICheckTaskDto[];
  }

  if (!isObjectRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.records)) {
    return payload.records as AICheckTaskDto[];
  }

  if (Array.isArray(payload.items)) {
    return payload.items as AICheckTaskDto[];
  }

  if (Array.isArray(payload.data)) {
    return payload.data as AICheckTaskDto[];
  }

  return [];
};

const normalizeTask = (task: AICheckTaskDto): AICheckRecord => {
  const type = normalizeBusType(toNonEmptyString(task.busType || task.type));
  const status = normalizeStatus(toNonEmptyString(task.status) || 'pending');
  const report = normalizeReport(task.report);
  const overallSimilarity =
    toFiniteNumber(task.overallSimilarity) ?? report?.overallSimilarity ?? null;
  const flaggedParagraphs =
    toFiniteNumber(task.flaggedParagraphs) ?? report?.flaggedParagraphs ?? 0;
  const needsReviewParagraphs =
    toFiniteNumber(task.needsReviewParagraphs) ?? report?.needsReviewParagraphs ?? 0;
  const lowConfidenceParagraphs =
    toFiniteNumber(task.lowConfidenceParagraphs) ?? report?.lowConfidenceParagraphs ?? 0;
  const topSimilarity =
    toFiniteNumber(task.topSimilarity) ?? report?.topSimilarity ?? null;
  const topSourceTitle =
    toNonEmptyString(task.topSourceTitle) || report?.topSourceTitle || null;
  const riskLevel = normalizeRiskLevel(task.riskLevel, overallSimilarity);
  const staleMinutes =
    status === 'processing' && task.updatedAt
      ? (Date.now() - Date.parse(task.updatedAt)) / (1000 * 60)
      : 0;
  const isStaleProcessing =
    Boolean(task.isStaleProcessing) || (status === 'processing' && staleMinutes >= 20);
  const attentionReasons = [
    status === 'failed' ? 'The latest check run failed and needs to be rerun.' : null,
    isStaleProcessing ? 'The job has been processing for too long and may be stalled.' : null,
    riskLevel === 'high'
      ? `Overall similarity is ${Math.round((overallSimilarity ?? 0) * 100)}%, which is above the high-risk threshold.`
      : null,
    needsReviewParagraphs > 0
      ? `${needsReviewParagraphs} paragraph(s) still require manual editorial review.`
      : null,
    lowConfidenceParagraphs > 0
      ? `${lowConfidenceParagraphs} low-confidence match(es) still need source validation.`
      : null,
    (status === 'processing' || status === 'pending') && !isStaleProcessing
      ? 'The task is still running and should be monitored until the report is ready.'
      : null,
  ].filter((item): item is string => Boolean(item));
  const triageLevel =
    status === 'failed' || isStaleProcessing || riskLevel === 'high'
      ? 'urgent'
      : needsReviewParagraphs > 0 || riskLevel === 'medium'
        ? 'review'
        : lowConfidenceParagraphs > 0 || status === 'processing' || status === 'pending'
          ? 'watch'
          : 'clear';
  const triageMeta = AI_CHECK_TRIAGE_META[triageLevel];
  const triageReason =
    attentionReasons[0] ||
    (triageLevel === 'clear'
      ? 'No blocking similarity issue is visible in the latest result.'
      : 'This record should stay in the queue until the next manual pass.');

  return {
    id: task.id,
    type,
    typeLabel: AI_CHECK_BUS_TYPE_LABELS[type],
    fileName: toNonEmptyString(task.fileName) || '未命名文件',
    filePath: toNonEmptyString(task.filePath) || undefined,
    kbId: toNonEmptyString(task.kbId) || null,
    status,
    statusLabel: AI_CHECK_STATUS_META[status].label,
    statusColor: AI_CHECK_STATUS_META[status].color,
    report,
    overallSimilarity,
    errorMessage: toNonEmptyString(task.errorMessage) || null,
    createdAt: toNonEmptyString(task.createdAt || task.uploadedAt) || new Date().toISOString(),
    updatedAt: toNonEmptyString(task.updatedAt) || toNonEmptyString(task.createdAt) || new Date().toISOString(),
    riskLevel,
    riskLabel: AI_CHECK_RISK_META[riskLevel].label,
    riskColor: AI_CHECK_RISK_META[riskLevel].color,
    flaggedParagraphs,
    needsReviewParagraphs,
    lowConfidenceParagraphs,
    topSimilarity,
    topSourceTitle,
    isStaleProcessing,
    similarityPercent:
      typeof overallSimilarity === 'number' ? Math.round(overallSimilarity * 100) : null,
    hasReport: Boolean(task.reportReady) || Boolean(report),
    triageLevel,
    triageLabel: triageMeta.label,
    triageColor: triageMeta.color,
    triageReason,
    triageAction:
      triageLevel === 'urgent'
        ? 'Open the report now and resolve failed, stalled, or duplicate-heavy findings before submission.'
        : triageLevel === 'review'
          ? 'Review the flagged paragraphs and decide rewrite, citation, or keep.'
          : triageLevel === 'watch'
            ? 'Monitor the queue and validate uncertain matches on the next pass.'
            : 'Keep this result as the current clean baseline and rerun only after material edits.',
    attentionReasons,
  };
};

const sortRecords = (records: AICheckRecord[]): AICheckRecord[] =>
  [...records].sort((left, right) => {
    const attentionWeight = (record: AICheckRecord) => {
      if (record.status === 'failed') return 5;
      if (record.isStaleProcessing) return 4;
      if (record.riskLevel === 'high') return 3;
      if (record.riskLevel === 'medium') return 2;
      if (record.status === 'processing' || record.status === 'pending') return 1;
      return 0;
    };

    const weightDelta = attentionWeight(right) - attentionWeight(left);
    if (weightDelta !== 0) {
      return weightDelta;
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });

const buildSummary = (records: AICheckRecord[]): AICheckSummary => {
  const completedWithSimilarity = records.filter(
    (item): item is AICheckRecord & { overallSimilarity: number } =>
      item.status === 'completed' && typeof item.overallSimilarity === 'number',
  );
  const similarityTotal = completedWithSimilarity.reduce(
    (sum, item) => sum + item.overallSimilarity,
    0,
  );

  return {
    total: records.length,
    pending: records.filter((item) => item.status === 'pending').length,
    processing: records.filter((item) => item.status === 'processing').length,
    completed: records.filter((item) => item.status === 'completed').length,
    failed: records.filter((item) => item.status === 'failed').length,
    highRisk: records.filter((item) => item.riskLevel === 'high').length,
    mediumRisk: records.filter((item) => item.riskLevel === 'medium').length,
    lowRisk: records.filter((item) => item.riskLevel === 'low').length,
    clean: records.filter((item) => item.riskLevel === 'clean').length,
    averageSimilarity:
      completedWithSimilarity.length > 0
        ? similarityTotal / completedWithSimilarity.length
        : 0,
    needsReview: records.reduce((sum, item) => sum + item.needsReviewParagraphs, 0),
    lowConfidence: records.reduce((sum, item) => sum + item.lowConfidenceParagraphs, 0),
    withReport: records.filter((item) => item.hasReport).length,
    staleProcessing: records.filter((item) => item.isStaleProcessing).length,
    attention: records.filter(
      (item) =>
        item.status === 'failed' ||
        item.isStaleProcessing ||
        item.riskLevel === 'high' ||
        item.needsReviewParagraphs > 0,
    ).length,
  };
};

const normalizeSummary = (value: unknown): AICheckSummary | null => {
  if (!isObjectRecord(value)) {
    return null;
  }

  return {
    total: toFiniteNumber(value.total) ?? 0,
    pending: toFiniteNumber(value.pending) ?? 0,
    processing: toFiniteNumber(value.processing) ?? 0,
    completed: toFiniteNumber(value.completed) ?? 0,
    failed: toFiniteNumber(value.failed) ?? 0,
    highRisk: toFiniteNumber(value.highRisk) ?? 0,
    mediumRisk: toFiniteNumber(value.mediumRisk) ?? 0,
    lowRisk: toFiniteNumber(value.lowRisk) ?? 0,
    clean: toFiniteNumber(value.clean) ?? 0,
    averageSimilarity: toFiniteNumber(value.averageSimilarity) ?? 0,
    needsReview: toFiniteNumber(value.needsReview) ?? 0,
    lowConfidence: toFiniteNumber(value.lowConfidence) ?? 0,
    withReport: toFiniteNumber(value.withReport) ?? 0,
    staleProcessing: toFiniteNumber(value.staleProcessing) ?? 0,
    attention: toFiniteNumber(value.attention) ?? 0,
  };
};

const applyFocusFilter = (records: AICheckRecord[], focus?: AICheckFocusFilter) => {
  if (!focus || focus === 'all') {
    return records;
  }

  switch (focus) {
    case 'attention':
      return records.filter(
        (item) =>
          item.status === 'failed' ||
          item.isStaleProcessing ||
          item.riskLevel === 'high' ||
          item.needsReviewParagraphs > 0,
      );
    case 'needsReview':
      return records.filter(
        (item) => item.riskLevel === 'medium' || item.needsReviewParagraphs > 0,
      );
    case 'lowConfidence':
      return records.filter((item) => item.lowConfidenceParagraphs > 0);
    case 'stale':
      return records.filter((item) => item.isStaleProcessing);
    default:
      return records;
  }
};

export const getAICheckErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError(error)) {
    const serverPayload = error.response?.data;

    if (typeof serverPayload === 'string' && serverPayload.trim()) {
      return serverPayload;
    }

    if (
      isObjectRecord(serverPayload) &&
      typeof serverPayload.message === 'string' &&
      serverPayload.message.trim()
    ) {
      return serverPayload.message;
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

export const aiCheckService = {
  async listRecords(query: AICheckListQuery = {}): Promise<AICheckListResult> {
    const payload = await apiClient.get<unknown, unknown>('/ai-check/list', {
      params: {
        busType: query.busType,
        searchKey: query.searchKey,
        checkTime: query.checkTime,
        pageNo: query.pageNo,
        pageSize: query.pageSize,
        status: query.status,
        riskLevel: query.riskLevel,
      },
    });

    const rawItems = sortRecords(coerceTaskArray(payload).map(normalizeTask));
    const container = isObjectRecord(payload) ? payload : null;

    let items = rawItems;
    if (query.status && query.status !== 'all') {
      items = items.filter((item) => item.status === query.status);
    }
    if (query.riskLevel && query.riskLevel !== 'all') {
      items = items.filter((item) => item.riskLevel === query.riskLevel);
    }
    items = applyFocusFilter(items, query.focus);

    const summary = normalizeSummary(container?.summary) ?? buildSummary(items);

    return {
      items,
      total:
        typeof container?.total === 'number'
          ? container.total
          : items.length,
      pageNo:
        typeof container?.pageNo === 'number'
          ? container.pageNo
          : query.pageNo || 1,
      pageSize:
        typeof container?.pageSize === 'number'
          ? container.pageSize
          : query.pageSize || items.length || 10,
      totalPages:
        typeof container?.totalPages === 'number'
          ? container.totalPages
          : 1,
      source: 'live',
      summary,
    };
  },

  async getStatus(id: string): Promise<AICheckStatusSnapshot> {
    const payload = await apiClient.get<unknown, unknown>(`/ai-check/status/${id}`);
    if (!isObjectRecord(payload)) {
      return {
        id,
        status: 'pending',
      };
    }

    return {
      id: toNonEmptyString(payload.id) || id,
      status: normalizeStatus(toNonEmptyString(payload.status) || 'pending'),
      overallSimilarity: toFiniteNumber(payload.overallSimilarity),
      errorMessage: toNonEmptyString(payload.errorMessage) || null,
      updatedAt: toNonEmptyString(payload.updatedAt) || null,
      riskLevel: normalizeRiskLevel(payload.riskLevel, toFiniteNumber(payload.overallSimilarity) ?? null),
      flaggedParagraphs: toFiniteNumber(payload.flaggedParagraphs),
      needsReviewParagraphs: toFiniteNumber(payload.needsReviewParagraphs),
      lowConfidenceParagraphs: toFiniteNumber(payload.lowConfidenceParagraphs),
      topSimilarity: toFiniteNumber(payload.topSimilarity) ?? null,
      topSourceTitle: toNonEmptyString(payload.topSourceTitle) || null,
      isStaleProcessing: Boolean(payload.isStaleProcessing),
    };
  },

  async getReport(id: string): Promise<AICheckReport | null> {
    const payload = await apiClient.get<unknown, unknown>(`/ai-check/report/${id}`);
    return normalizeReport(payload);
  },

  async uploadRecord(file: File, payload: AICheckUploadPayload): Promise<AICheckUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', payload.type);
    if (payload.kbId?.trim()) {
      formData.append('kbId', payload.kbId.trim());
    }

    const task = await apiClient.post<AICheckTaskDto, AICheckTaskDto>('/ai-check/upload', formData);

    return {
      task: normalizeTask(task),
      source: 'live',
    };
  },

  async deleteRecord(id: string): Promise<void> {
    await apiClient.delete(`/ai-check/${id}`);
  },
};
