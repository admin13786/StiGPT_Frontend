import { isAxiosError } from 'axios';
import apiClient from './api';
import type {
  AIReviewBusType,
  AIReviewDimensionScore,
  AIReviewListResult,
  AIReviewRecommendation,
  AIReviewRecord,
  AIReviewReport,
  AIReviewStatus,
  AIReviewStatusSnapshot,
  AIReviewSummary,
  AIReviewTaskDto,
  AIReviewUploadPayload,
  AIReviewUploadResult,
} from '../types/aiReview';
import {
  AI_REVIEW_BUS_TYPE_LABELS,
  AI_REVIEW_RECOMMENDATION_META,
  AI_REVIEW_STATUS_META,
} from '../types/aiReview';

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim());
};

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
};

const pickFirstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
};

const pickFirstStringArray = (...values: unknown[]): string[] => {
  for (const value of values) {
    const normalized = normalizeStringArray(value);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
};

const normalizeDimension = (value: unknown): AIReviewDimensionScore => {
  if (!isObjectRecord(value)) {
    return {
      dimension: '未命名维度',
      weight: 0,
      score: 0,
      evidence: [],
      strengths: [],
      weaknesses: [],
      suggestions: [],
    };
  }

  return {
    dimension: typeof value.dimension === 'string' ? value.dimension : '未命名维度',
    weight: typeof value.weight === 'number' ? value.weight : 0,
    score: typeof value.score === 'number' ? value.score : 0,
    evidence: normalizeStringArray(value.evidence),
    strengths: normalizeStringArray(value.strengths),
    weaknesses: normalizeStringArray(value.weaknesses),
    suggestions: normalizeStringArray(value.suggestions),
  };
};

const normalizeReport = (value: unknown): AIReviewReport | null => {
  if (!isObjectRecord(value)) {
    return null;
  }

  const dimensions = Array.isArray(value.dimensions)
    ? value.dimensions.map(normalizeDimension)
    : [];

  const radarChartData = isObjectRecord(value.radarChartData)
    ? {
        labels: normalizeStringArray(value.radarChartData.labels),
        scores: Array.isArray(value.radarChartData.scores)
          ? value.radarChartData.scores.filter(
              (item): item is number => typeof item === 'number',
            )
          : [],
      }
    : undefined;

  const ingested = isObjectRecord(value.ingested)
    ? {
        title: typeof value.ingested.title === 'string' ? value.ingested.title : undefined,
        abstract:
          typeof value.ingested.abstract === 'string' ? value.ingested.abstract : undefined,
      }
    : undefined;

  return {
    overallScore: typeof value.overallScore === 'number' ? value.overallScore : 0,
    recommendation: typeof value.recommendation === 'string' ? value.recommendation : '',
    summary: typeof value.summary === 'string' ? value.summary : '',
    dimensions,
    conclusion: pickFirstString(value.conclusion, value.finalConclusion, value.decisionConclusion),
    keyStrengths: pickFirstStringArray(
      value.keyStrengths,
      value.highlights,
      value.topStrengths,
    ),
    keyRisks: pickFirstStringArray(
      value.keyRisks,
      value.risks,
      value.blockers,
      value.keyWeaknesses,
    ),
    nextActions: pickFirstStringArray(
      value.nextActions,
      value.actions,
      value.actionItems,
      value.followUps,
    ),
    radarChartData,
    ingested,
  };
};

const coerceTaskArray = (payload: unknown): AIReviewTaskDto[] => {
  if (Array.isArray(payload)) {
    return payload as AIReviewTaskDto[];
  }

  if (!isObjectRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.records)) {
    return payload.records as AIReviewTaskDto[];
  }

  if (Array.isArray(payload.items)) {
    return payload.items as AIReviewTaskDto[];
  }

  if (Array.isArray(payload.data)) {
    return payload.data as AIReviewTaskDto[];
  }

  return [];
};

const sortRecords = (records: AIReviewRecord[]): AIReviewRecord[] =>
  [...records].sort((left, right) => {
    const rightTime = Date.parse(right.updatedAt || right.createdAt);
    const leftTime = Date.parse(left.updatedAt || left.createdAt);
    return rightTime - leftTime;
  });

const normalizeBusType = (value: string): AIReviewBusType => {
  if (value === 'project' || value === 'paper') {
    return value;
  }

  return 'paper';
};

const normalizeStatus = (value: string): AIReviewStatus => {
  if (value === 'pending' || value === 'processing' || value === 'completed' || value === 'failed') {
    return value;
  }

  return 'pending';
};

const normalizeRecommendation = (value: string | null | undefined): string | null => {
  if (!value?.trim()) {
    return null;
  }

  return value.trim();
};

const normalizeTask = (task: AIReviewTaskDto): AIReviewRecord => {
  const type = normalizeBusType(
    typeof task.docType === 'string' ? task.docType : typeof task.type === 'string' ? task.type : '',
  );
  const status = normalizeStatus(task.status);
  const report = normalizeReport(task.report);
  const recommendation = normalizeRecommendation(task.recommendation) || report?.recommendation || null;
  const overallScore =
    typeof task.overallScore === 'number' ? task.overallScore : report?.overallScore ?? null;

  return {
    id: task.id,
    type,
    typeLabel: AI_REVIEW_BUS_TYPE_LABELS[type],
    fileName: normalizeString(task.fileName) || normalizeString(task.name) || '未命名文件',
    filePath: task.filePath || undefined,
    kbId: task.kbId || null,
    status,
    statusLabel: AI_REVIEW_STATUS_META[status].label,
    statusColor: AI_REVIEW_STATUS_META[status].color,
    report,
    overallScore,
    scorePercent: typeof overallScore === 'number' ? Math.round(overallScore) : null,
    recommendation,
    hasReport: Boolean(report),
    recommendationLabel: recommendation,
    needsAttention:
      status === 'failed' ||
      recommendation === '拒稿' ||
      recommendation === '修改后录用',
    errorMessage: task.errorMessage || null,
    createdAt:
      normalizeString(task.createdAt) ||
      normalizeString(task.uploadedAt) ||
      normalizeString(task.updatedAt) ||
      new Date(0).toISOString(),
    updatedAt:
      normalizeString(task.updatedAt) ||
      normalizeString(task.createdAt) ||
      normalizeString(task.uploadedAt) ||
      new Date(0).toISOString(),
    hasKbBinding: Boolean(task.hasKbBinding) || Boolean(task.kbId),
  };
};

const buildSummary = (records: AIReviewRecord[]): AIReviewSummary => {
  const completedRecords = records.filter(
    (item): item is AIReviewRecord & { overallScore: number } =>
      item.status === 'completed' && typeof item.overallScore === 'number',
  );
  const totalScore = completedRecords.reduce((sum, item) => sum + item.overallScore, 0);

  return {
    total: records.length,
    pending: records.filter((item) => item.status === 'pending').length,
    processing: records.filter((item) => item.status === 'processing').length,
    completed: records.filter((item) => item.status === 'completed').length,
    failed: records.filter((item) => item.status === 'failed').length,
    averageScore: completedRecords.length > 0 ? totalScore / completedRecords.length : 0,
    accepted: records.filter((item) => item.recommendation === '录用').length,
    revision: records.filter((item) => item.recommendation === '修改后录用').length,
    rejected: records.filter((item) => item.recommendation === '拒稿').length,
    attention: records.filter((item) => item.needsAttention).length,
  };
};

export const getAIReviewErrorMessage = (error: unknown, fallback: string): string => {
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

export const getAIReviewRecommendationMeta = (value?: string | null) => {
  if (!value) {
    return null;
  }

  if (value in AI_REVIEW_RECOMMENDATION_META) {
    return AI_REVIEW_RECOMMENDATION_META[value as AIReviewRecommendation];
  }

  return {
    label: value,
    color: 'default',
  };
};

export const aiReviewService = {
  async listRecords(): Promise<AIReviewListResult> {
    const payload = await apiClient.get<unknown, unknown>('/ai-review/list');
    const items = sortRecords(coerceTaskArray(payload).map(normalizeTask));

    return {
      items,
      total: items.length,
      pageNo: 1,
      pageSize: items.length || 10,
      source: 'live',
      summary: buildSummary(items),
    };
  },

  async getStatus(id: string): Promise<AIReviewStatusSnapshot> {
    const payload = await apiClient.get<unknown, unknown>(`/ai-review/status/${id}`);
    if (!isObjectRecord(payload)) {
      return {
        id,
        status: 'pending',
      };
    }

    return {
      id: typeof payload.id === 'string' ? payload.id : id,
      status: normalizeStatus(typeof payload.status === 'string' ? payload.status : 'pending'),
      overallScore: typeof payload.overallScore === 'number' ? payload.overallScore : undefined,
      recommendation:
        typeof payload.recommendation === 'string' ? payload.recommendation : undefined,
      errorMessage:
        typeof payload.errorMessage === 'string' ? payload.errorMessage : null,
      updatedAt:
        typeof payload.updatedAt === 'string' ? payload.updatedAt : null,
    };
  },

  async getReport(id: string): Promise<AIReviewReport | null> {
    const payload = await apiClient.get<unknown, unknown>(`/ai-review/report/${id}`);
    return normalizeReport(payload);
  },

  async uploadRecord(file: File, payload: AIReviewUploadPayload): Promise<AIReviewUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', payload.type);
    if (payload.kbId?.trim()) {
      formData.append('kbId', payload.kbId.trim());
    }

    const task = await apiClient.post<AIReviewTaskDto, AIReviewTaskDto>(
      '/ai-review/upload',
      formData,
    );

    return {
      task: normalizeTask(task),
      source: 'live',
    };
  },

  async deleteRecord(id: string): Promise<void> {
    await apiClient.delete(`/ai-review/${id}`);
  },
};
