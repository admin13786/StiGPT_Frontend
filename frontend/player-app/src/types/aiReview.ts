export type AIReviewBusType = 'project' | 'paper';

export type AIReviewStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type AIReviewTimeFilter = 'all' | '7d' | '30d' | '180d' | '365d' | 'older';

export type AIReviewRecommendation = '录用' | '修改后录用' | '拒稿';

export type AIReviewFocusFilter =
  | 'all'
  | 'accepted'
  | 'revision'
  | 'rejected'
  | 'processing'
  | 'failed'
  | 'attention';

export type AIReviewDataSource = 'live' | 'demo';

export interface AIReviewTaskDto {
  id: string;
  type?: string | null;
  docType?: string | null;
  name?: string | null;
  fileName?: string | null;
  filePath?: string | null;
  kbId?: string | null;
  status?: string | null;
  report?: unknown;
  reportReady?: boolean | null;
  hasKbBinding?: boolean | null;
  overallScore?: number | null;
  recommendation?: string | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  uploadedAt?: string | null;
  updatedAt?: string | null;
}

export interface AIReviewDimensionScore {
  dimension: string;
  weight: number;
  score: number;
  evidence: string[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface AIReviewReport {
  overallScore: number;
  recommendation: string;
  summary: string;
  dimensions: AIReviewDimensionScore[];
  conclusion?: string;
  keyStrengths?: string[];
  keyRisks?: string[];
  nextActions?: string[];
  radarChartData?: {
    labels: string[];
    scores: number[];
  };
  ingested?: {
    title?: string;
    abstract?: string;
  };
}

export interface AIReviewTask {
  id: string;
  type: AIReviewBusType;
  fileName: string;
  filePath?: string;
  kbId?: string | null;
  status: AIReviewStatus;
  report?: AIReviewReport | null;
  overallScore?: number | null;
  recommendation?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  hasKbBinding: boolean;
}

export interface AIReviewRecord extends AIReviewTask {
  typeLabel: string;
  statusLabel: string;
  statusColor: string;
  scorePercent: number | null;
  hasReport: boolean;
  recommendationLabel: string | null;
  needsAttention: boolean;
}

export interface AIReviewSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  averageScore: number;
  accepted: number;
  revision: number;
  rejected: number;
  attention: number;
}

export interface AIReviewListResult {
  items: AIReviewRecord[];
  total: number;
  pageNo: number;
  pageSize: number;
  source: AIReviewDataSource;
  summary: AIReviewSummary;
}

export interface AIReviewUploadPayload {
  type: AIReviewBusType;
  kbId?: string;
}

export interface AIReviewUploadResult {
  task: AIReviewRecord;
  source: AIReviewDataSource;
}

export interface AIReviewStatusSnapshot {
  id: string;
  status: AIReviewStatus;
  overallScore?: number | null;
  recommendation?: string;
  errorMessage?: string | null;
  updatedAt?: string | null;
}

export const AI_REVIEW_BUS_TYPE_LABELS: Record<AIReviewBusType, string> = {
  project: '项目评审',
  paper: '论文评审',
};

export const AI_REVIEW_BUS_TYPE_OPTIONS: Array<{
  value: AIReviewBusType;
  label: string;
  description: string;
}> = [
  {
    value: 'project',
    label: '项目评审',
    description: '面向项目申请书、立项书和方案材料的综合评审。',
  },
  {
    value: 'paper',
    label: '论文评审',
    description: '面向论文、综述和学术草稿的综合评审。',
  },
];

export const AI_REVIEW_TIME_FILTER_OPTIONS: Array<{
  value: AIReviewTimeFilter;
  label: string;
}> = [
  { value: 'all', label: '全部时间' },
  { value: '7d', label: '最近一周' },
  { value: '30d', label: '最近一月' },
  { value: '180d', label: '最近半年' },
  { value: '365d', label: '最近一年' },
  { value: 'older', label: '更早' },
];

export const AI_REVIEW_STATUS_META: Record<AIReviewStatus, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'default' },
  processing: { label: '处理中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
};

export const AI_REVIEW_RECOMMENDATION_META: Record<
  AIReviewRecommendation,
  { label: string; color: string }
> = {
  录用: { label: '录用', color: 'success' },
  修改后录用: { label: '修改后录用', color: 'processing' },
  拒稿: { label: '拒稿', color: 'error' },
};

export const AI_REVIEW_FOCUS_FILTER_OPTIONS: Array<{
  value: AIReviewFocusFilter;
  label: string;
}> = [
  { value: 'all', label: '全部结果' },
  { value: 'attention', label: '优先关注' },
  { value: 'accepted', label: '录用' },
  { value: 'revision', label: '修改后录用' },
  { value: 'rejected', label: '拒稿' },
  { value: 'processing', label: '处理中' },
  { value: 'failed', label: '失败' },
];
