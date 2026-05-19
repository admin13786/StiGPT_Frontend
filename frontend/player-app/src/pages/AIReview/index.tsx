import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { UploadFile } from 'antd';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  AuditOutlined,
  CopyOutlined,
  DownloadOutlined,
  ReadOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { isAxiosError } from 'axios';
import '../AIWrite/index.css';
import '../AIWrite/hub.css';
import {
  aiReviewService,
  getAIReviewErrorMessage,
  getAIReviewRecommendationMeta,
} from '../../services/ai-review.service';
import {
  aiWriteService,
  getAiWriteErrorMessage,
} from '../../services/ai-write.service';
import type {
  AIReviewBusType,
  AIReviewFocusFilter,
  AIReviewRecord,
  AIReviewReport,
  AIReviewStatus,
  AIReviewStatusSnapshot,
  AIReviewSummary,
  AIReviewTimeFilter,
} from '../../types/aiReview';
import {
  AI_REVIEW_BUS_TYPE_OPTIONS,
  AI_REVIEW_FOCUS_FILTER_OPTIONS,
  AI_REVIEW_STATUS_META,
  AI_REVIEW_TIME_FILTER_OPTIONS,
} from '../../types/aiReview';
import {
  copyTextToClipboard,
  downloadTextFile,
  stripMarkdownSyntax,
} from '../../utils/clientExport';
import {
  buildAiWriteCreateRequestFromSeed,
  buildAiWriteDetailPath,
  savePendingAiWriteSeed,
} from '../../utils/aiWriteBridge';

const { Paragraph, Text } = Typography;

const ACTIVE_STATUSES = new Set<AIReviewStatus>(['pending', 'processing']);
const EMPTY_SUMMARY: AIReviewSummary = {
  total: 0,
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  averageScore: 0,
  accepted: 0,
  revision: 0,
  rejected: 0,
  attention: 0,
};

type AlertTone = 'success' | 'info' | 'warning' | 'error';

const MODAL_PANEL_STYLE = {
  border: '1px solid #eef2f6',
  borderRadius: 12,
  padding: 16,
  background: '#fafcff',
};

type ReviewTaskBoardSummary = {
  tone: AlertTone;
  readinessLabel: string;
  readinessColor: string;
  readinessHint: string;
  routeModeLabel: string;
  blockers: string[];
  strengths: string[];
  nextRoundFocus: string[];
};
const isUnavailableError = (error: unknown) => isAxiosError(error) && !error.response;
const REVIEW_TYPE_NAV: Record<AIReviewBusType, { label: string; icon: JSX.Element }> = {
  project: { label: '项目', icon: <AuditOutlined /> },
  paper: { label: '论文', icon: <FileTextOutlined /> },
};

const normalizeReviewBusType = (value?: string | null): AIReviewBusType | null =>
  value === 'project' || value === 'paper' ? value : null;

type AIReviewSurfaceMode = 'review' | 'inspect';

const AI_REVIEW_SURFACE_CONFIG: Record<
  AIReviewSurfaceMode,
  {
    sidebarTitle: string;
    searchPlaceholder: string;
    uploadButtonText: string;
    uploadActionText: string;
    uploadTitle: string;
    reportTitle: string;
    focusSectionTitle: string;
    footerText: string;
  }
> = {
  review: {
    sidebarTitle: 'AI 评审助理',
    searchPlaceholder: '搜索文件名称、知识库编号或评审结论',
    uploadButtonText: '上传文件',
    uploadActionText: '开始评审',
    uploadTitle: '上传',
    reportTitle: '评审报告',
    focusSectionTitle: '评审结果',
    footerText: 'AI 评审结果仅供内部辅助判断使用，不应直接替代正式评审意见、编辑结论或人工决策。',
  },
  inspect: {
    sidebarTitle: 'AI 编辑建议',
    searchPlaceholder: '搜索文件名称、知识库编号或修改建议',
    uploadButtonText: '上传文件',
    uploadActionText: '开始分析',
    uploadTitle: '上传',
    reportTitle: '编辑建议报告',
    focusSectionTitle: '关注视角',
    footerText: 'AI 编辑建议用于辅助修订，不直接替代正式编辑意见、作者判断或最终提交决策。',
  },
};

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return '-';
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : value;
};

const formatScore = (value?: number | null): string => {
  if (typeof value !== 'number') {
    return '-';
  }

  return `${Math.round(value)} 分`;
};

const getReviewRowNextStepHint = (record: AIReviewRecord): string => {
  if (record.status === 'failed') {
    return '本次评审失败，建议修复文件后重新发起。';
  }

  if (ACTIVE_STATUSES.has(record.status)) {
    return '评审仍在处理中，完成后可回流 AI 写作形成修改稿。';
  }

  if (record.recommendation === '拒稿') {
    return '建议优先围绕低分维度重写核心章节，再发起下一轮评审。';
  }

  if (record.recommendation === '修改后录用') {
    return '建议将评审结论转成作者修改清单，并回流 AI 写作继续修订。';
  }

  if (record.recommendation === '录用') {
    return '当前结果可作为定稿前留档，也可继续做小幅优化。';
  }

  return '可进入详细评审报告查看维度证据与修改建议。';
};

const matchTimeFilter = (value: string, filter: AIReviewTimeFilter): boolean => {
  if (filter === 'all') {
    return true;
  }

  const diffDays = dayjs().diff(dayjs(value), 'day', true);
  if (!Number.isFinite(diffDays) || diffDays < 0) {
    return true;
  }

  if (filter === '7d') {
    return diffDays <= 7;
  }
  if (filter === '30d') {
    return diffDays > 7 && diffDays <= 30;
  }
  if (filter === '180d') {
    return diffDays > 30 && diffDays <= 180;
  }
  if (filter === '365d') {
    return diffDays > 180 && diffDays <= 365;
  }

  return diffDays > 365;
};

const getRecommendationBucket = (record: AIReviewRecord): AIReviewFocusFilter => {
  if (record.status === 'failed') {
    return 'failed';
  }

  if (ACTIVE_STATUSES.has(record.status)) {
    return 'processing';
  }

  const recommendationMeta = getAIReviewRecommendationMeta(record.recommendation);
  if (recommendationMeta?.color === 'success') {
    return 'accepted';
  }
  if (recommendationMeta?.color === 'processing') {
    return 'revision';
  }
  if (recommendationMeta?.color === 'error') {
    return 'rejected';
  }

  return 'all';
};

const matchesFocusFilter = (record: AIReviewRecord, focus: AIReviewFocusFilter): boolean => {
  if (focus === 'all') {
    return true;
  }

  if (focus === 'attention') {
    return record.needsAttention;
  }

  return getRecommendationBucket(record) === focus;
};

const getWeakestDimensions = (report: AIReviewReport | null): AIReviewReport['dimensions'] => {
  if (!report) {
    return [];
  }

  return [...report.dimensions].sort((left, right) => left.score - right.score).slice(0, 3);
};

const buildReportNextActions = (
  report: AIReviewReport | null,
  record: AIReviewRecord | null,
): string[] => {
  if (!report) {
    return [];
  }

  const actions = Array.from(
    new Set(
      [
        ...(report.nextActions || []),
        ...getWeakestDimensions(report).map((dimension) => {
          const primarySuggestion = dimension.suggestions[0] || dimension.weaknesses[0];
          return primarySuggestion
            ? `${dimension.dimension}：${primarySuggestion}`
            : `${dimension.dimension}：建议在下一轮评审前重新检查这一部分。`;
        }),
      ].filter(Boolean),
    ),
  );

  if (actions.length > 0) {
    return actions.slice(0, 4);
  }

  const recommendationMeta = getAIReviewRecommendationMeta(report.recommendation);
  const fallbackActions: string[] = [];

  if (recommendationMeta?.color === 'success') {
    fallbackActions.push('整理这份评审结果，准备进入正式送审、归档或内部流转。');
  }
  if (recommendationMeta?.color === 'processing') {
    fallbackActions.push('先围绕低分维度形成针对性的修改清单，再重新发起评审。');
  }
  if (recommendationMeta?.color === 'error') {
    fallbackActions.push('优先解决关键阻塞项，再决定是否重投或退出当前流程。');
  }
  if (record && !record.hasKbBinding) {
    fallbackActions.push('下一轮建议绑定知识库，让评审建议更贴合上下文材料。');
  }

  return fallbackActions.slice(0, 4);
};

const buildReviewTaskBoardSummary = (
  report: AIReviewReport,
  record: AIReviewRecord,
  weakestDimensions: AIReviewReport['dimensions'],
  nextActions: string[],
  recommendationColor?: string,
): ReviewTaskBoardSummary => {
  const strongestDimensions = [...report.dimensions]
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  const blockers = Array.from(
    new Set(
      [
        ...(report.keyRisks || []),
        ...weakestDimensions.map(
          (dimension) =>
            dimension.weaknesses[0] ||
            dimension.suggestions[0] ||
            `${dimension.dimension} 仍需优先补强。`,
        ),
        !record.hasKbBinding ? '当前未绑定知识库，下一轮评审建议补充上下文资料。' : '',
      ].filter(Boolean),
    ),
  ).slice(0, 4);
  const strengths = Array.from(
    new Set(
      [
        ...(report.keyStrengths || []),
        ...strongestDimensions.map(
          (dimension) =>
            dimension.strengths[0] ||
            `${dimension.dimension} 当前得分 ${Math.round(dimension.score)} 分，建议作为保留优势继续维持。`,
        ),
      ].filter(Boolean),
    ),
  ).slice(0, 4);
  const nextRoundFocus = Array.from(
    new Set(
      [
        ...nextActions,
        ...weakestDimensions.map((dimension) =>
          dimension.suggestions[0]
            ? `${dimension.dimension}：${dimension.suggestions[0]}`
            : `${dimension.dimension}：围绕这一维度补强证据、结构和表达。`,
        ),
      ].filter(Boolean),
    ),
  ).slice(0, 4);

  if (recommendationColor === 'success') {
    return {
      tone: 'success',
      readinessLabel: '可直接轻修或归档',
      readinessColor: 'success',
      readinessHint:
        '本轮评审已达到录用水平。若回流 AI 写作，建议以轻量润色、格式收口和定稿整理为主。',
      routeModeLabel: '轻修定稿',
      blockers,
      strengths,
      nextRoundFocus,
    };
  }

  if (recommendationColor === 'processing') {
    return {
      tone: 'warning',
      readinessLabel: '建议立即回流写作',
      readinessColor: 'processing',
      readinessHint:
        '本轮已经形成明确的修改清单，适合直接生成修订稿，再组织下一轮评审验证。',
      routeModeLabel: '修订稿',
      blockers,
      strengths,
      nextRoundFocus,
    };
  }

  if (recommendationColor === 'error') {
    return {
      tone: 'error',
      readinessLabel: '先处理阻塞再回流',
      readinessColor: 'error',
      readinessHint:
        '当前存在较强阻塞项。建议先围绕最低分维度和关键风险重构核心章节，再回流 AI 写作生成新稿。',
      routeModeLabel: '重写稿',
      blockers,
      strengths,
      nextRoundFocus,
    };
  }

  return {
    tone: 'info',
    readinessLabel: '可进入下一轮整理',
    readinessColor: 'default',
    readinessHint: '当前已拿到可执行评审结果，可继续整理修改任务并视情况回流写作。',
    routeModeLabel: '整理稿',
    blockers,
    strengths,
    nextRoundFocus,
  };
};

const buildReviewReportMarkdown = (
  record: AIReviewRecord,
  report: AIReviewReport,
  actions: string[],
): string => {
  const lines = [
    `# AI 评审报告 - ${record.fileName}`,
    '',
    `- 类型：${record.typeLabel}`,
    `- 任务状态：${record.statusLabel}`,
    `- 评审结论：${getAIReviewRecommendationMeta(report.recommendation)?.label || report.recommendation || '-'}`,
    `- 总分：${Math.round(report.overallScore)} 分`,
    `- 评审维度：${report.dimensions.length}`,
    `- 知识库绑定：${record.hasKbBinding ? '已绑定' : '未绑定'}`,
    `- 知识库编号：${record.kbId || '-'}`,
    `- 创建时间：${formatDateTime(record.createdAt)}`,
    `- 更新时间：${formatDateTime(record.updatedAt)}`,
    '',
  ];

  if (report.summary) {
    lines.push('## 摘要结论', '', report.summary, '');
  }

  if (report.conclusion) {
    lines.push('## 最终结论', '', report.conclusion, '');
  }

  if (actions.length > 0) {
    lines.push('## 下一步动作', '');
    actions.forEach((action, index) => {
      lines.push(`${index + 1}. ${action}`);
    });
    lines.push('');
  }

  if (report.keyStrengths && report.keyStrengths.length > 0) {
    lines.push('## 主要优点', '');
    report.keyStrengths.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  }

  if (report.keyRisks && report.keyRisks.length > 0) {
    lines.push('## 主要风险', '');
    report.keyRisks.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  }

  lines.push('## 维度拆解', '');
  report.dimensions.forEach((dimension) => {
    lines.push(`### ${dimension.dimension}`);
    lines.push(`- 分数：${Math.round(dimension.score)} 分`);
    lines.push(`- 权重：${dimension.weight}`);
    if (dimension.evidence.length > 0) {
      lines.push(`- 证据：${dimension.evidence.join(' | ')}`);
    }
    if (dimension.strengths.length > 0) {
      lines.push(`- 优点：${dimension.strengths.join(' | ')}`);
    }
    if (dimension.weaknesses.length > 0) {
      lines.push(`- 问题：${dimension.weaknesses.join(' | ')}`);
    }
    if (dimension.suggestions.length > 0) {
      lines.push(`- 建议：${dimension.suggestions.join(' | ')}`);
    }
    lines.push('');
  });

  if (report.ingested?.title || report.ingested?.abstract) {
    lines.push('## 文档快照', '');
    lines.push(`- 标题：${report.ingested?.title || '-'}`);
    lines.push(`- 摘要：${report.ingested?.abstract || '-'}`);
    lines.push('');
  }

  return lines.join('\n').trim();
};

const sanitizeTitleBase = (value: string): string => value.replace(/\.[^.]+$/, '').trim();

const buildReviewRewriteSeed = (
  record: AIReviewRecord,
  report: AIReviewReport,
  actions: string[],
) => {
  const weakestDimensions = [...report.dimensions]
    .sort((left, right) => left.score - right.score)
    .slice(0, 3);
  const strongestDimensions = [...report.dimensions]
    .sort((left, right) => right.score - left.score)
    .slice(0, 2);

  const referenceLines = [
    `原文文件：${record.fileName}`,
    `评审结论：${getAIReviewRecommendationMeta(report.recommendation)?.label || report.recommendation || '-'}`,
    `总分：${Math.round(report.overallScore)} 分`,
    report.ingested?.title ? `文档标题：${report.ingested.title}` : '',
    report.ingested?.abstract ? `文档摘要：${report.ingested.abstract}` : '',
    '',
    '整改动作：',
    ...actions.map((action, index) => `${index + 1}. ${action}`),
  ].filter(Boolean);

  return {
    version: 1 as const,
    kind: record.type,
    source: 'ai-review' as const,
    sourceRecordId: record.id,
    sourceTaskType: record.type,
    sourceTitle: record.fileName,
    reason: `已根据 ${record.fileName} 的评审报告预填修改草稿，你可以直接展开提纲与修订正文。`,
    draft: {
      title: `${sanitizeTitleBase(record.fileName)}评审修改稿`,
      kbId: record.kbId || undefined,
      backgroundKeywords: [record.typeLabel, '同行评审', '修改稿'],
      backgroundInnovation: strongestDimensions.map((dimension) => `${dimension.dimension} 保持优势`),
      backgroundDescription:
        report.conclusion ||
        report.summary ||
        '需要根据本次 AI 评审结论完成一轮针对性修订，并形成新的提纲与正文。',
      methodKeywords: weakestDimensions.map((dimension) => dimension.dimension).slice(0, 5),
      methodInnovation: ['围绕低分维度整改', '补强关键证据', '提高评审可读性'],
      methodDescription: actions.join('\n'),
      collaboratorSuggestions:
        weakestDimensions
          .map((dimension) => {
            const primarySuggestion = dimension.suggestions[0] || dimension.weaknesses[0];
            return primarySuggestion
              ? `${dimension.dimension}：${primarySuggestion}`
              : `${dimension.dimension}：建议优先补强该维度。`;
          })
          .join('\n') || undefined,
      summary: report.summary || '这是一份基于 AI 评审报告生成的修改写作草稿。',
      coreKeywords: Array.from(
        new Set(['评审修改', '结构优化', ...report.dimensions.map((dimension) => dimension.dimension)]),
      ).slice(0, 8),
      references: referenceLines.join('\n'),
    },
  };
};

const buildSummary = (records: AIReviewRecord[]): AIReviewSummary => {
  const completed = records.filter(
    (item): item is AIReviewRecord & { overallScore: number } =>
      item.status === 'completed' && typeof item.overallScore === 'number',
  );
  const totalScore = completed.reduce((sum, item) => sum + item.overallScore, 0);

  return {
    total: records.length,
    pending: records.filter((item) => item.status === 'pending').length,
    processing: records.filter((item) => item.status === 'processing').length,
    completed: records.filter((item) => item.status === 'completed').length,
    failed: records.filter((item) => item.status === 'failed').length,
    averageScore: completed.length > 0 ? totalScore / completed.length : 0,
    accepted: records.filter((item) => getRecommendationBucket(item) === 'accepted').length,
    revision: records.filter((item) => getRecommendationBucket(item) === 'revision').length,
    rejected: records.filter((item) => getRecommendationBucket(item) === 'rejected').length,
    attention: records.filter((item) => item.needsAttention).length,
  };
};

const mergeStatusSnapshot = (
  record: AIReviewRecord,
  snapshot: AIReviewStatusSnapshot,
): AIReviewRecord => {
  const statusMeta = AI_REVIEW_STATUS_META[snapshot.status];
  const recommendation = snapshot.recommendation || record.recommendation;
  const recommendationMeta = getAIReviewRecommendationMeta(recommendation);

  return {
    ...record,
    status: snapshot.status,
    statusLabel: statusMeta.label,
    statusColor: statusMeta.color,
    overallScore:
      typeof snapshot.overallScore === 'number' ? snapshot.overallScore : record.overallScore,
    scorePercent:
      typeof snapshot.overallScore === 'number'
        ? Math.round(snapshot.overallScore)
        : record.scorePercent,
    recommendation,
    recommendationLabel: recommendationMeta?.label || recommendation || null,
    needsAttention:
      snapshot.status === 'failed' ||
      recommendationMeta?.color === 'error' ||
      recommendationMeta?.color === 'processing',
    errorMessage: snapshot.errorMessage ?? record.errorMessage,
    updatedAt: snapshot.updatedAt || record.updatedAt,
  };
};

const attachReport = (record: AIReviewRecord, report: AIReviewReport | null): AIReviewRecord => {
  const recommendation = report?.recommendation || record.recommendation;
  const recommendationMeta = getAIReviewRecommendationMeta(recommendation);

  return {
    ...record,
    report,
    hasReport: Boolean(report),
    overallScore: typeof report?.overallScore === 'number' ? report.overallScore : record.overallScore,
    scorePercent:
      typeof report?.overallScore === 'number'
        ? Math.round(report.overallScore)
        : record.scorePercent,
    recommendation,
    recommendationLabel: recommendationMeta?.label || recommendation || null,
    needsAttention:
      record.status === 'failed' ||
      recommendationMeta?.color === 'error' ||
      recommendationMeta?.color === 'processing',
  };
};

const AIReviewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const surfaceMode: AIReviewSurfaceMode = location.pathname.includes('/inspect')
    ? 'inspect'
    : 'review';
  const surfaceConfig = AI_REVIEW_SURFACE_CONFIG[surfaceMode];
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<{ kbId?: string }>();
  const [activeType, setActiveType] = useState<AIReviewBusType>('project');
  const [searchText, setSearchText] = useState('');
  const [timeFilter, setTimeFilter] = useState<AIReviewTimeFilter>('all');
  const [focusFilter, setFocusFilter] = useState<AIReviewFocusFilter>('all');
  const [records, setRecords] = useState<AIReviewRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportRecord, setReportRecord] = useState<AIReviewRecord | null>(null);
  const [reportData, setReportData] = useState<AIReviewReport | null>(null);
  const [writeOutlineLaunching, setWriteOutlineLaunching] = useState(false);
  const deepLinkTaskId = useMemo(
    () => new URLSearchParams(location.search).get('taskId')?.trim() || null,
    [location.search],
  );
  const deepLinkTaskType = useMemo(
    () => normalizeReviewBusType(new URLSearchParams(location.search).get('taskType')),
    [location.search],
  );
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(deepLinkTaskId);

  const deferredSearchText = useDeferredValue(searchText.trim().toLowerCase());
  const currentTypeOption = useMemo(
    () => AI_REVIEW_BUS_TYPE_OPTIONS.find((item) => item.value === activeType),
    [activeType],
  );

  const typeRecords = useMemo(
    () => records.filter((item) => item.type === activeType),
    [activeType, records],
  );

  const filteredRecords = useMemo(
    () =>
      typeRecords.filter((item) => {
        if (!matchTimeFilter(item.createdAt, timeFilter)) {
          return false;
        }

        if (!matchesFocusFilter(item, focusFilter)) {
          return false;
        }

        if (!deferredSearchText) {
          return true;
        }

        return (
          item.fileName.toLowerCase().includes(deferredSearchText) ||
          item.typeLabel.toLowerCase().includes(deferredSearchText) ||
          (item.kbId || '').toLowerCase().includes(deferredSearchText) ||
          (item.recommendationLabel || '').toLowerCase().includes(deferredSearchText)
        );
      }),
    [deferredSearchText, focusFilter, timeFilter, typeRecords],
  );
  const hasActiveFilters = Boolean(deferredSearchText) || timeFilter !== 'all';
  const reportRecommendationMeta = useMemo(
    () => getAIReviewRecommendationMeta(reportData?.recommendation || reportRecord?.recommendation),
    [reportData, reportRecord],
  );
  const filteredSummary = useMemo(() => buildSummary(filteredRecords), [filteredRecords]);
  const emptyDescription = hasActiveFilters
    ? '当前筛选条件下没有匹配的记录。'
    : '暂无历史数据，你可以点击上传文件进行检查';
  const reportConclusionAlert = useMemo(() => {
    if (!reportData) {
      return null;
    }

    return {
      type:
        reportRecommendationMeta?.color === 'success'
          ? ('success' as const)
          : reportRecommendationMeta?.color === 'processing'
            ? ('warning' as const)
            : reportRecommendationMeta?.color === 'error'
              ? ('error' as const)
              : ('info' as const),
      message: `最终结论：${reportRecommendationMeta?.label || '待定'}`,
      description:
        reportData.conclusion || reportData.summary || '后端已返回分数，但没有提供更详细的结论说明。',
    };
  }, [reportData, reportRecommendationMeta]);
  const weakestDimensions = useMemo(() => getWeakestDimensions(reportData), [reportData]);
  const reportNextActions = useMemo(
    () => buildReportNextActions(reportData, reportRecord),
    [reportData, reportRecord],
  );
  const reviewTaskBoard = useMemo(
    () =>
      reportData && reportRecord
        ? buildReviewTaskBoardSummary(
            reportData,
            reportRecord,
            weakestDimensions,
            reportNextActions,
            reportRecommendationMeta?.color,
          )
        : null,
    [reportData, reportNextActions, reportRecommendationMeta?.color, reportRecord, weakestDimensions],
  );
  const reportMarkdown = useMemo(
    () =>
      reportRecord && reportData
        ? buildReviewReportMarkdown(reportRecord, reportData, reportNextActions)
        : '',
    [reportData, reportNextActions, reportRecord],
  );
  const reportPlainText = useMemo(() => stripMarkdownSyntax(reportMarkdown), [reportMarkdown]);

  useEffect(() => {
    setPendingTaskId(deepLinkTaskId);
  }, [deepLinkTaskId]);

  const loadRecords = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const result = await aiReviewService.listRecords();
        setRecords(result.items);
        setReportRecord((current) => {
          if (!current) {
            return current;
          }

          return result.items.find((item) => item.id === current.id) || current;
        });
      } catch (error) {
        if (!silent) {
          if (isUnavailableError(error)) {
            setRecords([]);
            return;
          }
          const errorMessage = getAIReviewErrorMessage(error, '加载 AI 评审记录失败。');
          messageApi.error(errorMessage);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [messageApi],
  );

  const syncRecord = useCallback((nextRecord: AIReviewRecord) => {
    setRecords((current) => current.map((item) => (item.id === nextRecord.id ? nextRecord : item)));
    setReportRecord((current) => (current?.id === nextRecord.id ? nextRecord : current));
  }, []);

  const refreshReport = useCallback(
    async (targetRecord?: AIReviewRecord | null, silent = false) => {
      const baseRecord = targetRecord || reportRecord || null;
      if (!baseRecord) {
        return null;
      }

      if (!silent) {
        setReportLoading(true);
      }

      try {
        const snapshot = await aiReviewService.getStatus(baseRecord.id);
        const statusSyncedRecord = mergeStatusSnapshot(baseRecord, snapshot);
        syncRecord(statusSyncedRecord);

        if (snapshot.status !== 'completed') {
          if (snapshot.status === 'failed') {
            setReportData(null);
          }
          return statusSyncedRecord;
        }

        const report = await aiReviewService.getReport(baseRecord.id);
        setReportData(report);
        const completedRecord = attachReport(statusSyncedRecord, report);
        syncRecord(completedRecord);
        return completedRecord;
      } catch (error) {
        if (!silent) {
          messageApi.error(getAIReviewErrorMessage(error, '加载 AI 评审报告失败。'));
        }
        return null;
      } finally {
        if (!silent) {
          setReportLoading(false);
        }
      }
    },
    [messageApi, reportRecord, syncRecord],
  );

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (!records.some((item) => ACTIVE_STATUSES.has(item.status))) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void loadRecords(true);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [loadRecords, records]);

  useEffect(() => {
    if (!reportOpen || !reportRecord || !ACTIVE_STATUSES.has(reportRecord.status)) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void refreshReport(reportRecord, true);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [refreshReport, reportOpen, reportRecord]);

  const resetFilters = () => {
    startTransition(() => {
      setSearchText('');
      setTimeFilter('all');
      setFocusFilter('all');
    });
  };

  const handleOpenUpload = () => {
    form.resetFields();
    setUploadFileList([]);
    setUploadOpen(true);
  };

  const handleUpload = async () => {
    const values = await form.validateFields();
    const file = uploadFileList[0]?.originFileObj;

    if (!file) {
      messageApi.warning('请先选择要上传的评审文件。');
      return;
    }

    setUploading(true);
    try {
      await aiReviewService.uploadRecord(file, {
        type: activeType,
        kbId: values.kbId?.trim() || undefined,
      });
      messageApi.success('评审文件已上传，任务已开始执行。');
      setUploadOpen(false);
      form.resetFields();
      setUploadFileList([]);
      await loadRecords(true);
    } catch (error) {
      messageApi.error(getAIReviewErrorMessage(error, '上传 AI 评审文件失败。'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (record: AIReviewRecord) => {
    try {
      await aiReviewService.deleteRecord(record.id);
      messageApi.success('评审记录已删除。');
      setRecords((current) => current.filter((item) => item.id !== record.id));
      if (reportRecord?.id === record.id) {
        setReportOpen(false);
        setReportRecord(null);
        setReportData(null);
      }
    } catch (error) {
      messageApi.error(getAIReviewErrorMessage(error, '删除 AI 评审记录失败。'));
    }
  };

  const handleViewReport = useCallback(async (record: AIReviewRecord) => {
    startTransition(() => {
      setReportOpen(true);
      setReportRecord(record);
      setReportData(record.report || null);
    });
    await refreshReport(record);
  }, [refreshReport]);

  useEffect(() => {
    if (!deepLinkTaskType || deepLinkTaskType === activeType) {
      return;
    }

    startTransition(() => {
      setActiveType(deepLinkTaskType);
    });
  }, [activeType, deepLinkTaskType]);

  useEffect(() => {
    if (!pendingTaskId) {
      return;
    }

    const matchedRecord = records.find((item) => item.id === pendingTaskId);
    if (!matchedRecord) {
      return;
    }

    void handleViewReport(matchedRecord).finally(() => {
      setPendingTaskId((current) => (current === matchedRecord.id ? null : current));
    });
  }, [handleViewReport, pendingTaskId, records]);

  const handleCopyCurrentReport = async () => {
    if (!reportMarkdown) {
      messageApi.warning('当前还没有可复制的评审报告。');
      return;
    }

    try {
      await copyTextToClipboard(reportMarkdown);
      messageApi.success('评审报告已复制。');
    } catch (error) {
      messageApi.error(getAIReviewErrorMessage(error, '复制评审报告失败。'));
    }
  };

  const handleExportCurrentReport = (extension: 'md' | 'txt') => {
    if (!reportRecord || !reportMarkdown) {
      messageApi.warning('当前还没有可导出的评审报告。');
      return;
    }

    downloadTextFile(
      extension === 'md' ? reportMarkdown : reportPlainText,
      `${reportRecord.fileName}-ai-review-report`,
      extension,
    );
    messageApi.success(extension === 'md' ? '评审报告 Markdown 已导出。' : '评审报告 TXT 已导出。');
  };

  const handleSendToWrite = () => {
    if (!reportRecord || !reportData) {
      messageApi.warning('当前还没有可回流到 AI 写作的评审报告。');
      return;
    }

    const seed = buildReviewRewriteSeed(reportRecord, reportData, reportNextActions);
    const seedKey = savePendingAiWriteSeed(seed);

    const search = new URLSearchParams();
    search.set('kind', seed.kind);
    search.set('seedKey', seedKey);
    search.set('from', `${location.pathname}${location.search}`);

    navigate(buildAiWriteDetailPath(seed.kind, search));
  };

  const handleCreateWriteOutline = async () => {
    if (!reportRecord || !reportData) {
      messageApi.warning('当前还没有可用于生成整改提纲的评审报告。');
      return;
    }

    const seed = buildReviewRewriteSeed(reportRecord, reportData, reportNextActions);
    setWriteOutlineLaunching(true);

    try {
      const created = await aiWriteService.createRecord(buildAiWriteCreateRequestFromSeed(seed));
      let outlineReady = false;

      try {
        await aiWriteService.generateOutline(created.id);
        outlineReady = true;
      } catch (error) {
        message.warning(
          getAiWriteErrorMessage(
            error,
            '已创建整改写作任务，但提纲生成失败，可在 AI 写作页继续重试。',
          ),
        );
      }

      const search = new URLSearchParams();
      search.set('kind', seed.kind);
      search.set('taskId', created.id);
      search.set('from', `${location.pathname}${location.search}`);

      if (outlineReady) {
        message.success('已创建整改写作任务并生成首版提纲。');
      }

      navigate(buildAiWriteDetailPath(seed.kind, search));
    } catch (error) {
      messageApi.error(getAiWriteErrorMessage(error, '创建整改写作任务失败。'));
    } finally {
      setWriteOutlineLaunching(false);
    }
  };

  const columns: TableColumnsType<AIReviewRecord> = [
    {
      title: '名称',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (_, record) => (
        <div className="ai-write-table-title-cell">
          <div className="ai-write-table-title-line">
            <span className="ai-write-table-title">{record.fileName}</span>
          </div>
          <div className="ai-write-table-meta-line">
            <span>{REVIEW_TYPE_NAV[record.type].label}</span>
            {record.kbId ? <span>知识库 {record.kbId}</span> : null}
          </div>
        </div>
      ),
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (_, record) => (
        <div className="ai-write-table-date-cell">
          {formatDateTime(record.createdAt)}
          <span>最近更新 {formatDateTime(record.updatedAt)}</span>
        </div>
      ),
    },
    {
      title: '评审',
      dataIndex: 'status',
      key: 'status',
      width: 260,
      render: (_, record) => {
        const recommendationMeta = getAIReviewRecommendationMeta(record.recommendation);

        return (
          <Space direction="vertical" size={8}>
            <Space wrap size={[6, 6]}>
              <Tag color={record.statusColor}>{record.statusLabel}</Tag>
              {recommendationMeta ? (
                <Tag color={recommendationMeta.color}>{recommendationMeta.label}</Tag>
              ) : null}
            </Space>

            {record.status === 'failed' ? (
              <Text type="danger">{record.errorMessage || '任务执行失败，请重新上传或稍后重试。'}</Text>
            ) : ACTIVE_STATUSES.has(record.status) ? (
              <Text type="secondary">评审进行中，完成后可查看详细报告与维度结论。</Text>
            ) : (
              <div className="ai-write-table-progress-cell">
                <Text strong>{formatScore(record.overallScore)}</Text>
                <div className="ai-write-table-progress-subhint">{getReviewRowNextStepHint(record)}</div>
              </div>
            )}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 170,
      render: (_, record) => (
        <div className="ai-write-table-actions">
          <Button type="link" size="small" onClick={() => void handleViewReport(record)}>
            查看评审
          </Button>
          <Popconfirm
            title="删除记录"
            description="该操作不可撤销，是否继续？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => void handleDelete(record)}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="ai-write-hub-page">
      {contextHolder}

      <section className="ai-tool-hero ai-tool-hero-review">
        <div className="ai-tool-hero-copy">
          <span className="ai-tool-hero-kicker">ScholarMate AI Review</span>
          <h1>{surfaceConfig.sidebarTitle}</h1>
          <p>
            模拟项目或论文评审过程，沉淀评分维度、阻塞项、修改后录用建议，并把评审意见回流为可执行写作任务。
          </p>
          <div className="ai-tool-hero-tags">
            <Tag bordered={false}>专家评审</Tag>
            <Tag bordered={false}>编辑建议</Tag>
            <Tag bordered={false}>整改提纲</Tag>
          </div>
        </div>
        <div className="ai-tool-hero-side">
          <div className="ai-tool-hero-metric">
            <strong>{filteredSummary.attention}</strong>
            <span>优先关注</span>
          </div>
          <Button type="primary" icon={<UploadOutlined />} onClick={handleOpenUpload}>
            {surfaceConfig.uploadButtonText}
          </Button>
        </div>
      </section>

      <div className="ai-page-layout ai-write-hub-layout">
        <aside className="ai-page-sidebar ai-write-hub-sidebar">
          <Card className="ai-write-sidebar-card ai-tool-sidebar-panel" variant="borderless">
            <div className="ai-tool-sidebar-header">
              <div className="ai-write-sidebar-brand">
                <div className="ai-write-sidebar-brand-icon">
                  <ReadOutlined />
                </div>
                  <div className="ai-write-sidebar-brand-copy">
                  <div className="ai-tool-sidebar-title">{surfaceConfig.sidebarTitle}</div>
                </div>
              </div>
            </div>
            <div className="ai-tool-sidebar-nav">
              {AI_REVIEW_BUS_TYPE_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`ai-tool-nav-item ${
                    activeType === item.value ? 'ai-sidebar-nav-item-active' : ''
                  }`}
                  onClick={() => setActiveType(item.value)}
                >
                  <div className="ai-tool-nav-icon">{REVIEW_TYPE_NAV[item.value].icon}</div>
                  <div className="ai-tool-nav-copy">
                    <div className="ai-write-sidebar-nav-title">
                      {REVIEW_TYPE_NAV[item.value].label}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="ai-tool-sidebar-divider" />
            <div className="ai-tool-sidebar-section">
              <div className="ai-write-filter-head">
                <div className="ai-write-sidebar-section-label">筛选条件</div>
                <button type="button" className="ai-write-filter-reset" onClick={resetFilters}>
                  重置
                </button>
              </div>

              <div className="ai-write-sidebar-section-label ai-write-sidebar-section-label-sub">
                上传时间
              </div>
              {AI_REVIEW_TIME_FILTER_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`ai-sidebar-filter-item ${
                    timeFilter === item.value ? 'ai-sidebar-filter-item-active' : ''
                  }`}
                  onClick={() => setTimeFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}

              <div className="ai-write-sidebar-section-label ai-write-sidebar-section-label-sub">
                {surfaceConfig.focusSectionTitle}
              </div>
              {AI_REVIEW_FOCUS_FILTER_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`ai-sidebar-filter-item ${
                    focusFilter === item.value ? 'ai-sidebar-filter-item-active' : ''
                  }`}
                  onClick={() => setFocusFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Card>
        </aside>

        <section className="ai-page-content ai-write-page-content ai-write-hub-content">
          <div className="ai-write-list-shell">
            <div className="ai-write-list-head">
              <div className="ai-write-list-heading">
                <h2 className="ai-content-title">所有文件</h2>
              </div>

              <div className="ai-write-head-actions">
                <Input
                  allowClear
                  className="ai-search-input ai-write-search"
                  prefix={<SearchOutlined />}
                  placeholder={surfaceConfig.searchPlaceholder}
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
                <Button type="primary" icon={<UploadOutlined />} onClick={handleOpenUpload}>
                  {surfaceConfig.uploadButtonText}
                </Button>
              </div>
            </div>

            <div className="ai-write-stats">
              <Card variant="borderless" className="ai-write-stat-card">
                <Statistic title="当前记录" value={filteredSummary.total} suffix="份" />
              </Card>
              <Card variant="borderless" className="ai-write-stat-card">
                <Statistic title="优先关注" value={filteredSummary.attention} suffix="份" />
              </Card>
              <Card variant="borderless" className="ai-write-stat-card">
                <Statistic
                  title="平均得分"
                  value={Math.round(filteredSummary.averageScore)}
                  suffix="分"
                />
              </Card>
              <Card variant="borderless" className="ai-write-stat-card">
                <Statistic title="修改后录用" value={filteredSummary.revision} suffix="份" />
              </Card>
            </div>

            <div className="ai-write-table-card">
              <Table
                rowKey="id"
                loading={loading}
                columns={columns}
                dataSource={filteredRecords}
                rowClassName={() => 'ai-write-record-row'}
                locale={{
                  emptyText: (
                    <Empty
                      image={<AuditOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
                      description={emptyDescription}
                    >
                      <Button type="primary" icon={<UploadOutlined />} onClick={handleOpenUpload}>
                        {surfaceConfig.uploadButtonText}
                      </Button>
                    </Empty>
                  ),
                }}
                pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true }}
              />
            </div>

            <div className="ai-page-footer">
              {surfaceConfig.footerText}
            </div>
          </div>
        </section>
      </div>

      <Modal
        title={`${surfaceConfig.uploadTitle}${currentTypeOption?.label || '评审'}文件`}
        open={uploadOpen}
        forceRender
        confirmLoading={uploading}
        okText={surfaceConfig.uploadActionText}
        cancelText="取消"
        onOk={() => void handleUpload()}
        onCancel={() => {
          setUploadOpen(false);
          form.resetFields();
          setUploadFileList([]);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="当前类型">
            <Text>{currentTypeOption?.label}</Text>
          </Form.Item>
          <Form.Item
            label="知识库编号（可选）"
            name="kbId"
            extra="留空则沿用默认知识库策略；如需限定到指定知识库，可在这里输入编号。"
          >
            <Input placeholder="请输入知识库编号" allowClear />
          </Form.Item>
          <Form.Item label="评审文件" required>
            <Upload
              beforeUpload={() => false}
              fileList={uploadFileList}
              maxCount={1}
              onChange={({ fileList }) => setUploadFileList(fileList.slice(-1))}
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          reportRecord
            ? `${surfaceConfig.reportTitle} - ${reportRecord.fileName}`
            : surfaceConfig.reportTitle
        }
        open={reportOpen}
        footer={null}
        onCancel={() => {
          setReportOpen(false);
          setReportRecord(null);
          setReportData(null);
        }}
        width={960}
      >
        {reportRecord && (
          <Space align="start" style={{ width: '100%', justifyContent: 'space-between', marginTop: 8 }}>
            <Space wrap>
              <Tag color={reportRecord.statusColor}>{reportRecord.statusLabel}</Tag>
              {reportRecord.recommendationLabel ? (
                <Tag color={getAIReviewRecommendationMeta(reportRecord.recommendation)?.color}>
                  {reportRecord.recommendationLabel}
                </Tag>
              ) : null}
              <Text type="secondary">最后更新：{formatDateTime(reportRecord.updatedAt)}</Text>
            </Space>
            <Space wrap size={[8, 8]}>
              <Button
                type="primary"
                disabled={!reportData}
                loading={writeOutlineLaunching}
                onClick={() => void handleCreateWriteOutline()}
              >
                一键生成整改提纲
              </Button>
              <Button
                disabled={!reportData}
                loading={writeOutlineLaunching}
                onClick={handleSendToWrite}
              >
                转到 AI 写作整改
              </Button>
              <Button
                icon={<CopyOutlined />}
                disabled={!reportMarkdown}
                onClick={() => void handleCopyCurrentReport()}
              >
                复制报告
              </Button>
              <Button
                icon={<DownloadOutlined />}
                disabled={!reportMarkdown}
                onClick={() => handleExportCurrentReport('md')}
              >
                导出 Markdown
              </Button>
              <Button
                icon={<DownloadOutlined />}
                disabled={!reportMarkdown}
                onClick={() => handleExportCurrentReport('txt')}
              >
                导出 TXT
              </Button>
              <Button
                icon={<ReloadOutlined />}
                loading={reportLoading}
                onClick={() => void refreshReport(reportRecord)}
              >
                刷新
              </Button>
            </Space>
          </Space>
        )}

        {reportLoading && <Progress percent={100} size="small" status="active" showInfo={false} />}

        {reportRecord?.status === 'failed' && (
          <Alert
            type="error"
            showIcon
            message="任务执行失败"
            description={reportRecord.errorMessage || '后端没有返回更详细的失败原因。'}
            style={{ marginTop: 16 }}
          />
        )}

        {reportRecord && ACTIVE_STATUSES.has(reportRecord.status) && (
          <Alert
            type="info"
            showIcon
            message="报告生成中"
            description="只要任务仍在执行，这个弹窗就会每 5 秒自动刷新一次。"
            style={{ marginTop: 16 }}
          />
        )}

        {reportRecord && reportData && (
          <div style={{ marginTop: 16 }}>
            {reportConclusionAlert && (
              <Alert
                type={reportConclusionAlert.type}
                showIcon
                message={reportConclusionAlert.message}
                description={reportConclusionAlert.description}
                style={{ marginBottom: 16 }}
              />
            )}

            {reviewTaskBoard && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div style={MODAL_PANEL_STYLE}>
                  <Text strong>回流写作准备度</Text>
                  <Space wrap size={[8, 8]} style={{ marginTop: 10, marginBottom: 12 }}>
                    <Tag color={reviewTaskBoard.readinessColor}>{reviewTaskBoard.readinessLabel}</Tag>
                    <Tag color="blue">{reviewTaskBoard.routeModeLabel}</Tag>
                    {!reportRecord.hasKbBinding && <Tag>未绑知识库</Tag>}
                  </Space>
                  <Paragraph style={{ margin: 0, color: '#22313d', lineHeight: 1.7 }}>
                    {reviewTaskBoard.readinessHint}
                  </Paragraph>
                </div>

                <div style={MODAL_PANEL_STYLE}>
                  <Text strong>本轮阻塞项</Text>
                  <Paragraph style={{ marginTop: 8, marginBottom: 12, color: '#5f6f7d' }}>
                    这些问题决定了当前稿件是直接进入修订，还是需要先做结构性重写。
                  </Paragraph>
                  {reviewTaskBoard.blockers.length > 0 ? (
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      {reviewTaskBoard.blockers.map((item, index) => (
                        <Text key={`${item}-${index}`} style={{ lineHeight: 1.7 }}>
                          {index + 1}. {item}
                        </Text>
                      ))}
                    </Space>
                  ) : (
                    <Text type="secondary">当前没有明显阻塞项，可按下一轮动作继续推进。</Text>
                  )}
                </div>

                <div style={MODAL_PANEL_STYLE}>
                  <Text strong>优势保留</Text>
                  <Paragraph style={{ marginTop: 8, marginBottom: 12, color: '#5f6f7d' }}>
                    这些内容建议在后续修订时保留，避免改稿时把已有优势一起削弱。
                  </Paragraph>
                  {reviewTaskBoard.strengths.length > 0 ? (
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      {reviewTaskBoard.strengths.map((item, index) => (
                        <Text key={`${item}-${index}`} style={{ lineHeight: 1.7 }}>
                          {index + 1}. {item}
                        </Text>
                      ))}
                    </Space>
                  ) : (
                    <Text type="secondary">当前报告没有返回可复用的优势项。</Text>
                  )}
                </div>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <Statistic title="总分" value={Math.round(reportData.overallScore)} suffix="分" />
              <Statistic
                title="评审结论"
                value={getAIReviewRecommendationMeta(reportData.recommendation)?.label || '-'}
              />
              <Statistic title="评审维度" value={reportData.dimensions.length} />
              <Statistic title="知识库绑定" value={reportRecord.hasKbBinding ? '已绑定' : '未绑定'} />
            </div>

            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="文件名称">{reportRecord.fileName}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDateTime(reportRecord.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {formatDateTime(reportRecord.updatedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="知识库编号">{reportRecord.kbId || '-'}</Descriptions.Item>
              <Descriptions.Item label="摘要结论">
                {reportData.summary || '当前没有返回摘要结论。'}
              </Descriptions.Item>
            </Descriptions>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div style={MODAL_PANEL_STYLE}>
                <Text strong>下一步动作</Text>
                <Paragraph style={{ marginTop: 8, marginBottom: 12, color: '#5f6f7d' }}>
                  可以把这里的内容直接整理成作者修改意见，或作为下一轮评审的任务清单。
                </Paragraph>
                {reportNextActions.length > 0 ? (
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    {reportNextActions.map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '22px 1fr',
                          gap: 10,
                          alignItems: 'start',
                        }}
                      >
                        <Text strong style={{ color: '#1677ff' }}>
                          {index + 1}.
                        </Text>
                        <Text style={{ lineHeight: 1.7 }}>{item}</Text>
                      </div>
                    ))}
                  </Space>
                ) : (
                  <Text type="secondary">当前报告没有返回明确的下一步动作。</Text>
                )}

                {reportData.keyRisks && reportData.keyRisks.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <Text strong>当前阻塞项</Text>
                    <Space direction="vertical" size={6} style={{ width: '100%', marginTop: 8 }}>
                      {reportData.keyRisks.slice(0, 3).map((risk, index) => (
                        <Text key={`${risk}-${index}`} style={{ lineHeight: 1.7 }}>
                          - {risk}
                        </Text>
                      ))}
                    </Space>
                  </div>
                )}

                {reportData.keyStrengths && reportData.keyStrengths.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <Text strong>当前优势</Text>
                    <Space direction="vertical" size={6} style={{ width: '100%', marginTop: 8 }}>
                      {reportData.keyStrengths.slice(0, 3).map((strength, index) => (
                        <Text key={`${strength}-${index}`} style={{ lineHeight: 1.7 }}>
                          - {strength}
                        </Text>
                      ))}
                    </Space>
                  </div>
                )}

                {reviewTaskBoard && reviewTaskBoard.nextRoundFocus.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <Text strong>下一轮重点</Text>
                    <Space direction="vertical" size={6} style={{ width: '100%', marginTop: 8 }}>
                      {reviewTaskBoard.nextRoundFocus.map((item, index) => (
                        <Text key={`${item}-${index}`} style={{ lineHeight: 1.7 }}>
                          - {item}
                        </Text>
                      ))}
                    </Space>
                  </div>
                )}
              </div>

              <div style={MODAL_PANEL_STYLE}>
                <Text strong>最弱维度摘要</Text>
                <Paragraph style={{ marginTop: 8, marginBottom: 12, color: '#5f6f7d' }}>
                  这些是当前报告里得分最低的维度，下一轮修改应优先围绕它们展开。
                </Paragraph>
                {weakestDimensions.length > 0 ? (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {weakestDimensions.map((dimension) => (
                      <div
                        key={`${dimension.dimension}-${dimension.score}`}
                        style={{
                          border: '1px solid #edf1f5',
                          borderRadius: 10,
                          padding: 12,
                          background: '#fff',
                        }}
                      >
                        <Space
                          align="start"
                          style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}
                        >
                          <Text strong>{dimension.dimension}</Text>
                          <Tag
                            color={
                              dimension.score < 60 ? 'error' : dimension.score < 75 ? 'warning' : 'default'
                            }
                          >
                            {Math.round(dimension.score)} 分
                          </Tag>
                        </Space>
                        <Paragraph style={{ marginBottom: 8, color: '#22313d' }}>
                          {dimension.weaknesses[0] ||
                            dimension.suggestions[0] ||
                            dimension.evidence[0] ||
                            '当前维度没有返回更细的薄弱点说明。'}
                        </Paragraph>
                        {dimension.suggestions[0] ? (
                          <Text type="secondary">建议修正：{dimension.suggestions[0]}</Text>
                        ) : null}
                      </div>
                    ))}
                  </Space>
                ) : (
                  <Text type="secondary">当前报告暂时没有可展示的维度拆解。</Text>
                )}
              </div>
            </div>

            {reportData.ingested?.title || reportData.ingested?.abstract ? (
              <div style={{ marginBottom: 16 }}>
                <Text strong>文档快照</Text>
                <Paragraph style={{ marginTop: 8, marginBottom: 4 }}>
                  <Text strong>标题：</Text>
                  {reportData.ingested?.title || '-'}
                </Paragraph>
                <Paragraph style={{ marginBottom: 0 }}>
                  <Text strong>摘要：</Text>
                  {reportData.ingested?.abstract || '-'}
                </Paragraph>
              </div>
            ) : null}

            {reportData.dimensions.length === 0 ? (
              <Empty description="报告已生成，但当前没有可展示的维度得分。" />
            ) : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {reportData.dimensions.map((dimension) => (
                  <div
                    key={`${dimension.dimension}-${dimension.score}`}
                    style={{
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                      padding: 16,
                      background: '#fafafa',
                    }}
                  >
                    <Space
                      align="start"
                      style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}
                    >
                      <Space direction="vertical" size={2}>
                        <Text strong>{dimension.dimension}</Text>
                        <Text type="secondary">权重：{dimension.weight}</Text>
                      </Space>
                      <Text strong>{Math.round(dimension.score)} 分</Text>
                    </Space>

                    <Progress
                      percent={Math.max(0, Math.min(100, Math.round(dimension.score)))}
                      size="small"
                      style={{ marginBottom: 12 }}
                    />

                    {dimension.evidence.length > 0 && (
                      <Paragraph style={{ marginBottom: 8 }}>
                        <Text strong>证据：</Text>
                        {dimension.evidence.join(' | ')}
                      </Paragraph>
                    )}
                    {dimension.strengths.length > 0 && (
                      <Paragraph style={{ marginBottom: 8 }}>
                        <Text strong>优点：</Text>
                        {dimension.strengths.join(' | ')}
                      </Paragraph>
                    )}
                    {dimension.weaknesses.length > 0 && (
                      <Paragraph style={{ marginBottom: 8 }}>
                        <Text strong>问题：</Text>
                        {dimension.weaknesses.join(' | ')}
                      </Paragraph>
                    )}
                    {dimension.suggestions.length > 0 && (
                      <Paragraph style={{ marginBottom: 0 }}>
                        <Text strong>建议：</Text>
                        {dimension.suggestions.join(' | ')}
                      </Paragraph>
                    )}
                  </div>
                ))}
              </Space>
            )}
          </div>
        )}

        {reportRecord &&
          !ACTIVE_STATUSES.has(reportRecord.status) &&
          reportRecord.status !== 'failed' &&
          !reportData &&
          !reportLoading && (
            <Empty description="当前记录还没有可展示的评审报告内容。" style={{ marginTop: 24 }} />
          )}
      </Modal>
    </div>
  );
};

export default AIReviewPage;
