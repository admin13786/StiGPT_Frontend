export type AICheckBusType = 'project' | 'paper' | 'patent';

export type AICheckStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type AICheckRiskLevel = 'high' | 'medium' | 'low' | 'clean' | 'unknown';

export type AICheckTriageLevel = 'urgent' | 'review' | 'watch' | 'clear';

export type AICheckReportBucket = 'duplicate' | 'review' | 'watch' | 'clear';

export type AICheckTimeFilter = 'all' | '7d' | '30d' | '180d' | '365d' | 'older';

export type AICheckFocusFilter =
  | 'all'
  | 'attention'
  | 'needsReview'
  | 'lowConfidence'
  | 'stale';

export type AICheckDataSource = 'live' | 'demo';

export interface AICheckTaskDto {
  id: string;
  type?: string | null;
  busType?: string | null;
  fileName?: string | null;
  filePath?: string | null;
  kbId?: string | null;
  status?: string | null;
  report?: unknown;
  reportReady?: boolean | null;
  overallSimilarity?: number | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  uploadedAt?: string | null;
  updatedAt?: string | null;
  riskLevel?: string | null;
  flaggedParagraphs?: number | null;
  needsReviewParagraphs?: number | null;
  lowConfidenceParagraphs?: number | null;
  topSimilarity?: number | null;
  topSourceTitle?: string | null;
  isStaleProcessing?: boolean | null;
}

export interface AICheckMatchedSource {
  title: string;
  content: string;
}

export interface AICheckReportDetail {
  paragraphIndex: number;
  paragraph: string;
  isDuplicate: boolean;
  similarity: number;
  matchedSource?: AICheckMatchedSource;
  judgement?: string;
  confidence?: number;
  suggestion?: string;
  reviewBucket: AICheckReportBucket;
  reviewLabel: string;
  reviewColor: string;
  reviewAction: string;
}

export interface AICheckReport {
  overallSimilarity: number;
  totalParagraphs: number;
  duplicateParagraphs: number;
  details: AICheckReportDetail[];
  flaggedParagraphs: number;
  needsReviewParagraphs: number;
  lowConfidenceParagraphs: number;
  topSimilarity: number;
  topSourceTitle: string | null;
  generatedAt?: string | null;
  riskLevel: AICheckRiskLevel;
  attentionCount: number;
  watchCount: number;
  clearCount: number;
  confidenceAverage: number | null;
}

export interface AICheckTask {
  id: string;
  type: AICheckBusType;
  fileName: string;
  filePath?: string;
  kbId?: string | null;
  status: AICheckStatus;
  report?: AICheckReport | null;
  overallSimilarity?: number | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  riskLevel: AICheckRiskLevel;
  flaggedParagraphs: number;
  needsReviewParagraphs: number;
  lowConfidenceParagraphs: number;
  topSimilarity: number | null;
  topSourceTitle: string | null;
  isStaleProcessing: boolean;
}

export interface AICheckRecord extends AICheckTask {
  typeLabel: string;
  statusLabel: string;
  statusColor: string;
  riskLabel: string;
  riskColor: string;
  similarityPercent: number | null;
  hasReport: boolean;
  triageLevel: AICheckTriageLevel;
  triageLabel: string;
  triageColor: string;
  triageReason: string;
  triageAction: string;
  attentionReasons: string[];
}

export interface AICheckListQuery {
  pageNo?: number;
  pageSize?: number;
  busType?: 'all' | AICheckBusType;
  searchKey?: string;
  checkTime?: AICheckTimeFilter;
  status?: 'all' | AICheckStatus;
  riskLevel?: 'all' | AICheckRiskLevel;
  focus?: AICheckFocusFilter;
}

export interface AICheckSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  clean: number;
  averageSimilarity: number;
  needsReview: number;
  lowConfidence: number;
  withReport: number;
  staleProcessing: number;
  attention: number;
}

export interface AICheckListResult {
  items: AICheckRecord[];
  total: number;
  pageNo: number;
  pageSize: number;
  totalPages: number;
  source: AICheckDataSource;
  summary: AICheckSummary;
}

export interface AICheckUploadPayload {
  type: AICheckBusType;
  kbId?: string;
}

export interface AICheckUploadResult {
  task: AICheckRecord;
  source: AICheckDataSource;
}

export interface AICheckStatusSnapshot {
  id: string;
  status: AICheckStatus;
  overallSimilarity?: number | null;
  errorMessage?: string | null;
  updatedAt?: string | null;
  riskLevel?: AICheckRiskLevel;
  flaggedParagraphs?: number;
  needsReviewParagraphs?: number;
  lowConfidenceParagraphs?: number;
  topSimilarity?: number | null;
  topSourceTitle?: string | null;
  isStaleProcessing?: boolean;
}

export const AI_CHECK_BUS_TYPE_LABELS: Record<AICheckBusType, string> = {
  project: '项目',
  paper: '论文',
  patent: '专利',
};

export const AI_CHECK_BUS_TYPE_OPTIONS: Array<{
  value: AICheckBusType;
  label: string;
  description: string;
}> = [
  {
    value: 'project',
    label: '项目',
    description: '适用于项目申请书、立项材料和方案文档的重复与相似性检查。',
  },
  {
    value: 'paper',
    label: '论文',
    description: '适用于论文草稿、综述与正文内容的相似性检查。',
  },
  {
    value: 'patent',
    label: '专利',
    description: '适用于专利申请材料的段落重复与来源匹配检查。',
  },
];

export const AI_CHECK_TIME_FILTER_OPTIONS: Array<{
  value: AICheckTimeFilter;
  label: string;
}> = [
  { value: 'all', label: '全部时间' },
  { value: '7d', label: '最近一周' },
  { value: '30d', label: '最近一月' },
  { value: '180d', label: '最近半年' },
  { value: '365d', label: '最近一年' },
  { value: 'older', label: '更早' },
];

export const AI_CHECK_STATUS_META: Record<AICheckStatus, { label: string; color: string }> = {
  pending: { label: '排队中', color: 'default' },
  processing: { label: '处理中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
};

export const AI_CHECK_RISK_META: Record<AICheckRiskLevel, { label: string; color: string }> = {
  high: { label: '高风险', color: 'error' },
  medium: { label: '需复核', color: 'warning' },
  low: { label: '低风险', color: 'processing' },
  clean: { label: '较干净', color: 'success' },
  unknown: { label: '待出结果', color: 'default' },
};

export const AI_CHECK_TRIAGE_META: Record<AICheckTriageLevel, { label: string; color: string }> = {
  urgent: { label: '立即处理', color: 'error' },
  review: { label: '提交前复核', color: 'warning' },
  watch: { label: '持续关注', color: 'processing' },
  clear: { label: '可进入终审', color: 'success' },
};

export const AI_CHECK_REPORT_BUCKET_META: Record<
  AICheckReportBucket,
  { label: string; color: string }
> = {
  duplicate: { label: '重写或补引', color: 'error' },
  review: { label: '需人工复核', color: 'warning' },
  watch: { label: '待人工确认', color: 'processing' },
  clear: { label: '上下文清晰', color: 'success' },
};

export const AI_CHECK_STATUS_FILTER_OPTIONS: Array<{
  value: 'all' | AICheckStatus;
  label: string;
}> = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '排队中' },
  { value: 'processing', label: '处理中' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
];

export const AI_CHECK_RISK_FILTER_OPTIONS: Array<{
  value: 'all' | AICheckRiskLevel;
  label: string;
}> = [
  { value: 'all', label: '全部风险等级' },
  { value: 'high', label: '高风险' },
  { value: 'medium', label: '需复核' },
  { value: 'low', label: '低风险' },
  { value: 'clean', label: '较干净' },
  { value: 'unknown', label: '待出结果' },
];

export const AI_CHECK_FOCUS_FILTER_OPTIONS: Array<{
  value: AICheckFocusFilter;
  label: string;
}> = [
  { value: 'all', label: '全部关注项' },
  { value: 'attention', label: '优先关注' },
  { value: 'needsReview', label: '需复核' },
  { value: 'lowConfidence', label: '低置信度' },
  { value: 'stale', label: '滞留任务' },
];
