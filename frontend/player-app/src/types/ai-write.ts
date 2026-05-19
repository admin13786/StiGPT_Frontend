export type AiWriteRecordKind = 'project' | 'paper';

export type AiWriteBackendType = 'project_proposal' | 'journal_paper';

export type AiWriteRecordStatus =
  | 'created'
  | 'outline_ready'
  | 'generating'
  | 'completed'
  | 'failed';

export type AiWriteTimeFilter = 'all' | '7d' | '30d' | '180d' | '365d' | 'older';

export type AiWriteStage = 'planning' | 'drafting' | 'polishing' | 'completed' | 'failed';

export type AiWriteOperation = 'outline' | 'section' | 'polish';

export type AiWriteGenerationMode = 'llm' | 'mixed' | 'fallback';

export type AiWriteDependencyState =
  | 'ready'
  | 'not_requested'
  | 'missing_config'
  | 'unauthorized'
  | 'rate_limited'
  | 'timeout'
  | 'unavailable'
  | 'empty';

export type AiWriteContextPayload = Record<string, unknown>;

export type AiWriteNextAction =
  | 'wait'
  | 'generate_outline'
  | 'generate_next_section'
  | 'polish'
  | 'view_result';

export interface AiWriteTaskDto {
  id: string;
  type: string;
  title: string;
  researchField?: string | null;
  keywords?: string[] | null;
  kbId?: string | null;
  context?: AiWriteContextPayload | null;
  status: string;
  outline?: unknown;
  content?: unknown;
  fullText?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  hasOutline?: boolean;
  outlineCount?: number;
  generatedSectionCount?: number;
  pendingSectionCount?: number;
  nextSectionIndex?: number | null;
  completionPercent?: number;
  previewText?: string;
  hasFullText?: boolean;
  wordCount?: number;
  sectionCompletionPercent?: number;
  stage?: string;
  stageLabel?: string;
  statusHint?: string;
  isActive?: boolean;
  currentOperation?: string | null;
  currentOperationLabel?: string | null;
  currentSectionIndex?: number | null;
  nextAction?: string | null;
  nextActionLabel?: string | null;
  nextActionHint?: string | null;
  activeSince?: string | null;
  executionMeta?: AiWriteExecutionMeta | null;
}

export interface AiWriteListItemDto extends AiWriteTaskDto {
  taskType?: string;
}

export interface AiWriteSummaryDto {
  total: number;
  active: number;
  planning: number;
  drafting: number;
  polishing: number;
  completed: number;
  failed: number;
  actionable: number;
  averageCompletionPercent: number;
}

export interface AiWriteListDto {
  items: AiWriteListItemDto[];
  total: number;
  pageNo: number;
  pageSize: number;
  totalPages: number;
  summary?: AiWriteSummaryDto | null;
}

export interface AiWriteListQuery {
  kind?: AiWriteRecordKind;
  searchKey?: string;
  writingTime?: AiWriteTimeFilter;
  pageNo?: number;
  pageSize?: number;
}

export interface AiWriteOutlineSection {
  title: string;
  description?: string;
  minWords?: number;
}

export interface AiWriteSectionContent {
  index: number;
  title: string;
  description?: string;
  minWords?: number;
  content: string;
}

export interface AiWriteSummary {
  total: number;
  active: number;
  planning: number;
  drafting: number;
  polishing: number;
  completed: number;
  failed: number;
  actionable: number;
  averageCompletionPercent: number;
}

export interface AiWriteRecord {
  id: string;
  title: string;
  kind: AiWriteRecordKind;
  backendType: string;
  typeLabel: string;
  researchField?: string | null;
  keywords: string[];
  kbId?: string | null;
  status: string;
  statusLabel: string;
  statusColor: string;
  hasOutline: boolean;
  outlineCount: number;
  generatedSectionCount: number;
  pendingSectionCount: number;
  nextSectionIndex?: number | null;
  completionPercent: number;
  previewText: string;
  hasFullText: boolean;
  wordCount: number;
  sectionCompletionPercent: number;
  stage: AiWriteStage;
  stageLabel: string;
  statusHint: string;
  isActive: boolean;
  currentOperation?: AiWriteOperation | null;
  currentOperationLabel?: string | null;
  currentSectionIndex?: number | null;
  nextAction: AiWriteNextAction;
  nextActionLabel: string;
  nextActionHint: string;
  activeSince?: string | null;
  generationMode: AiWriteGenerationMode;
  generationModeLabel: string;
  executionMeta?: AiWriteExecutionMeta | null;
  context?: AiWriteContextPayload | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiWriteRecordDetail extends AiWriteRecord {
  context?: AiWriteContextPayload | null;
  outline: AiWriteOutlineSection[];
  sections: AiWriteSectionContent[];
  fullText?: string | null;
  errorMessage?: string | null;
}

export interface AiWriteDependencySnapshot {
  state: AiWriteDependencyState;
  message: string;
  checkedAt: string;
  provider?: string;
  model?: string;
  kbId?: string | null;
}

export interface AiWriteExecutionEntry {
  stage: string;
  mode: AiWriteGenerationMode;
  warnings: string[];
  at: string;
  llm: AiWriteDependencySnapshot;
  knowledge: AiWriteDependencySnapshot;
}

export interface AiWriteExecutionMeta {
  lastStage: string;
  generationMode: AiWriteGenerationMode;
  warnings: string[];
  updatedAt: string;
  llm: AiWriteDependencySnapshot;
  knowledge: AiWriteDependencySnapshot;
  history: AiWriteExecutionEntry[];
}

export interface AiWriteListResult {
  integrationAvailable: boolean;
  records: AiWriteRecord[];
  summary: AiWriteSummary;
  total: number;
  pageNo: number;
  pageSize: number;
  totalPages: number;
}

export interface AiWriteCreateRequest {
  kind: AiWriteRecordKind;
  title: string;
  researchField?: string;
  keywords?: string[];
  kbId?: string;
  context?: AiWriteContextPayload;
}

export interface AiWriteUpdateRequest {
  title?: string;
  researchField?: string;
  keywords?: string[];
  kbId?: string;
  context?: AiWriteContextPayload;
}

export interface AiWriteCreatePayload {
  type: AiWriteBackendType;
  title: string;
  researchField?: string;
  keywords?: string[];
  kbId?: string;
  context?: AiWriteContextPayload;
}

export const AI_WRITE_KIND_TO_BACKEND_TYPE: Record<AiWriteRecordKind, AiWriteBackendType> = {
  project: 'project_proposal',
  paper: 'journal_paper',
};

export const AI_WRITE_BACKEND_TYPE_TO_KIND: Record<AiWriteBackendType, AiWriteRecordKind> = {
  project_proposal: 'project',
  journal_paper: 'paper',
};

export const AI_WRITE_KIND_OPTIONS: Array<{
  value: AiWriteRecordKind;
  label: string;
  description: string;
}> = [
  {
    value: 'project',
    label: '项目申请',
    description: '从提纲到章节再到全文润色，适合基金、立项书和方案申请。',
  },
  {
    value: 'paper',
    label: '期刊论文',
    description: '按论文写作链路推进提纲、章节草稿与全文润色。',
  },
];

export const AI_WRITE_TIME_FILTER_OPTIONS: Array<{
  value: AiWriteTimeFilter;
  label: string;
}> = [
  { value: 'all', label: '全部时间' },
  { value: '7d', label: '近一周' },
  { value: '30d', label: '近一月' },
  { value: '180d', label: '近半年' },
  { value: '365d', label: '近一年' },
  { value: 'older', label: '更早' },
];

export const AI_WRITE_STATUS_META: Record<string, { label: string; color: string }> = {
  created: { label: '待开始', color: 'default' },
  outline_ready: { label: '可继续撰写', color: 'processing' },
  generating: { label: '处理中', color: 'blue' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '处理失败', color: 'error' },
};

export const AI_WRITE_STAGE_META: Record<AiWriteStage, { label: string; color: string }> = {
  planning: { label: '提纲规划', color: 'gold' },
  drafting: { label: '章节撰写', color: 'blue' },
  polishing: { label: '全文润色', color: 'purple' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '待修复', color: 'error' },
};

export const AI_WRITE_OPERATION_META: Record<AiWriteOperation, { label: string }> = {
  outline: { label: '提纲生成' },
  section: { label: '章节生成' },
  polish: { label: '全文润色' },
};

export const AI_WRITE_NEXT_ACTION_META: Record<
  AiWriteNextAction,
  { label: string; description: string }
> = {
  wait: {
    label: '自动刷新中',
    description: '任务正在处理中，等待结果返回即可。',
  },
  generate_outline: {
    label: '生成提纲',
    description: '先补出提纲，再继续生成正文内容。',
  },
  generate_next_section: {
    label: '生成下一节',
    description: '建议先推进下一节正文，再考虑全文润色。',
  },
  polish: {
    label: '全文润色',
    description: '章节已齐备，可以合并并生成完整润色稿。',
  },
  view_result: {
    label: '查看结果',
    description: '任务已完成，可直接查看最终内容。',
  },
};

export const AI_WRITE_STATUS_PROGRESS: Record<string, number> = {
  created: 12,
  outline_ready: 48,
  generating: 72,
  completed: 100,
  failed: 18,
};
