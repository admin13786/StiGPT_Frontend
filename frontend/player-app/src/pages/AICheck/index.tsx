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
  FileSearchOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { isAxiosError } from 'axios';
import '../AIWrite/index.css';
import '../AIWrite/hub.css';
import {
  aiCheckService,
  getAICheckErrorMessage,
} from '../../services/ai-check.service';
import {
  aiWriteService,
  getAiWriteErrorMessage,
} from '../../services/ai-write.service';
import type {
  AICheckBusType,
  AICheckFocusFilter,
  AICheckRecord,
  AICheckReport,
  AICheckStatus,
  AICheckStatusSnapshot,
  AICheckSummary,
  AICheckTimeFilter,
} from '../../types/aiCheck';
import {
  AI_CHECK_BUS_TYPE_OPTIONS,
  AI_CHECK_FOCUS_FILTER_OPTIONS,
  AI_CHECK_STATUS_META,
  AI_CHECK_TIME_FILTER_OPTIONS,
} from '../../types/aiCheck';
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

const DEFAULT_PAGE_SIZE = 10;
const HIGH_RISK_THRESHOLD = 0.7;
const ACTIVE_STATUSES = new Set<AICheckStatus>(['pending', 'processing']);
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
const isUnavailableError = (error: unknown) => isAxiosError(error) && !error.response;
const CHECK_TYPE_ICONS: Record<AICheckBusType, JSX.Element> = {
  project: <FileSearchOutlined />,
  paper: <FileTextOutlined />,
  patent: <AuditOutlined />,
};

const normalizeCheckBusType = (value?: string | null): AICheckBusType | null =>
  value === 'project' || value === 'paper' || value === 'patent' ? value : null;

type AICheckSurfaceMode = 'check' | 'compliance' | 'semantic';

const AI_CHECK_SURFACE_CONFIG: Record<
  AICheckSurfaceMode,
  {
    sidebarTitle: string;
    helperText: string;
    uploadButtonText: string;
    uploadActionText: string;
    uploadTitlePrefix: string;
    reportTitle: string;
    footerText: string;
  }
> = {
  check: {
    sidebarTitle: 'AI 检查',
    helperText: '合规检查支持的项目类型',
    uploadButtonText: '上传文件',
    uploadActionText: '开始检查',
    uploadTitlePrefix: '上传',
    reportTitle: '检查报告',
    footerText: 'AI 检查结果仅供参考，正式提交前请结合人工判断完成最终核验。',
  },
  compliance: {
    sidebarTitle: 'AI 合规检查',
    helperText: '优先排查规范性、表述边界与提交风险',
    uploadButtonText: '上传检查',
    uploadActionText: '开始检查',
    uploadTitlePrefix: '上传',
    reportTitle: '合规检查报告',
    footerText: 'AI 合规检查结果用于提交前自查，不直接替代最终人工审阅与正式认定。',
  },
  semantic: {
    sidebarTitle: 'AI 语义查重',
    helperText: '优先识别语义重复、近似表达与高风险段落',
    uploadButtonText: '上传检查',
    uploadActionText: '开始查重',
    uploadTitlePrefix: '上传',
    reportTitle: '语义查重报告',
    footerText: 'AI 语义查重结果用于辅助发现高风险表达，正式处理前仍需结合人工判断。',
  },
};

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return '-';
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : value;
};

const formatSimilarity = (value?: number | null): string => {
  if (typeof value !== 'number') {
    return '-';
  }

  return `${Math.round(value * 100)}%`;
};

const buildCheckReportMarkdown = (
  record: AICheckRecord,
  report: AICheckReport,
  actions: string[],
): string => {
  const lines = [
    `# AI 检查报告 - ${record.fileName}`,
    '',
    `- 类型：${record.typeLabel}`,
    `- 任务状态：${record.statusLabel}`,
    `- 风险等级：${record.riskLabel}`,
    `- 总相似度：${formatSimilarity(report.overallSimilarity)}`,
    `- 检查段落：${report.totalParagraphs}`,
    `- 重复段落：${report.duplicateParagraphs}`,
    `- 需复核：${report.needsReviewParagraphs}`,
    `- 低置信度：${report.lowConfidenceParagraphs}`,
    `- 知识库编号：${record.kbId || '-'}`,
    `- 上传时间：${formatDateTime(record.createdAt)}`,
    `- 更新时间：${formatDateTime(record.updatedAt)}`,
    '',
  ];

  if (actions.length > 0) {
    lines.push('## 建议处理动作', '');
    actions.forEach((action, index) => {
      lines.push(`${index + 1}. ${action}`);
    });
    lines.push('');
  }

  lines.push('## 命中段落明细', '');
  report.details.forEach((detail) => {
    lines.push(`### 段落 ${detail.paragraphIndex + 1}`);
    lines.push(`- 相似度：${formatSimilarity(detail.similarity)}`);
    lines.push(`- 分诊标签：${detail.reviewLabel}`);
    if (detail.judgement) {
      lines.push(`- 判定：${detail.judgement}`);
    }
    if (typeof detail.confidence === 'number') {
      lines.push(`- 置信度：${Math.round(detail.confidence * 100)}%`);
    }
    lines.push(`- 建议动作：${detail.reviewAction}`);
    lines.push('', detail.paragraph || '暂无段落内容。', '');
    if (detail.matchedSource) {
      lines.push(`命中来源：${detail.matchedSource.title || '未命名来源'}`);
      if (detail.matchedSource.content) {
        lines.push(detail.matchedSource.content);
      }
      lines.push('');
    }
    if (detail.suggestion) {
      lines.push(`修改建议：${detail.suggestion}`, '');
    }
  });

  return lines.join('\n').trim();
};

const resolveWriteKindFromCheckType = (type: AICheckBusType): 'project' | 'paper' =>
  type === 'paper' ? 'paper' : 'project';

const sanitizeTitleBase = (value: string): string => value.replace(/\.[^.]+$/, '').trim();

const getCheckRowRewriteHint = (record: AICheckRecord): string => {
  if (record.status === 'failed') {
    return '本次检查失败，建议修复上传内容或稍后重新发起。';
  }

  if (ACTIVE_STATUSES.has(record.status)) {
    return '报告生成中，完成后可直接回流 AI 写作生成整改稿。';
  }

  if (record.needsReviewParagraphs > 0) {
    return `建议先处理 ${record.needsReviewParagraphs} 个待复核段落，再生成整改稿。`;
  }

  if (record.flaggedParagraphs > 0) {
    return `可基于 ${record.flaggedParagraphs} 个风险段落直接生成整改写作草稿。`;
  }

  return '当前报告较干净，可作为提交前留档或再次复检基线。';
};

const buildCheckRewriteSeed = (
  record: AICheckRecord,
  report: AICheckReport,
  actions: string[],
) => {
  const sourceTitles = Array.from(
    new Set(
      report.details
        .map((detail) => detail.matchedSource?.title?.trim())
        .filter((item): item is string => Boolean(item)),
    ),
  ).slice(0, 6);

  const referenceLines = [
    `原文文件：${record.fileName}`,
    `风险等级：${record.riskLabel}`,
    `总相似度：${formatSimilarity(report.overallSimilarity)}`,
    sourceTitles.length > 0 ? `重点来源：${sourceTitles.join(' / ')}` : '',
    '',
    '整改动作：',
    ...actions.map((action, index) => `${index + 1}. ${action}`),
  ].filter(Boolean);

  return {
    version: 1 as const,
    kind: resolveWriteKindFromCheckType(record.type),
    source: 'ai-check' as const,
    sourceRecordId: record.id,
    sourceTaskType: record.type,
    sourceTitle: record.fileName,
    reason: `已根据 ${record.fileName} 的检查报告预填整改草稿，可继续生成提纲与正文修订稿。`,
    draft: {
      title: `${sanitizeTitleBase(record.fileName)}整改稿`,
      kbId: record.kbId || undefined,
      backgroundKeywords: [record.typeLabel, '相似度检查', '合规整改'],
      backgroundInnovation: ['降低高相似度段落', '补充引用依据', '提升文本原创性'],
      backgroundDescription: `本稿需要根据 AI 检查报告完成整改。当前风险等级为${record.riskLabel}，总相似度为${formatSimilarity(report.overallSimilarity)}，需重点处理 ${report.duplicateParagraphs} 处重复段落和 ${report.needsReviewParagraphs} 处待复核段落。`,
      methodKeywords: ['重写段落', '补充引文', '结构优化'],
      methodInnovation: ['逐段整改', '来源复核', '保留论点同时降低重合'],
      methodDescription: actions.join('\n'),
      collaboratorSuggestions:
        report.details
          .filter((detail) => detail.reviewLabel)
          .slice(0, 4)
          .map(
            (detail) =>
              `段落 ${detail.paragraphIndex + 1}：${detail.reviewLabel}，建议 ${detail.reviewAction}`,
          )
          .join('\n') || undefined,
      summary: '这是一份基于 AI 检查报告生成的整改写作草稿，目标是在保留核心论点的前提下，完成段落重写、补引和表达优化。',
      coreKeywords: ['整改写作', '降重', '引用补充', record.typeLabel],
      references: referenceLines.join('\n'),
    },
  };
};

const mergeStatusSnapshot = (
  record: AICheckRecord,
  snapshot: AICheckStatusSnapshot,
): AICheckRecord => {
  const statusMeta = AI_CHECK_STATUS_META[snapshot.status];
  return {
    ...record,
    status: snapshot.status,
    statusLabel: statusMeta.label,
    statusColor: statusMeta.color,
    overallSimilarity:
      typeof snapshot.overallSimilarity === 'number'
        ? snapshot.overallSimilarity
        : record.overallSimilarity,
    similarityPercent:
      typeof snapshot.overallSimilarity === 'number'
        ? Math.round(snapshot.overallSimilarity * 100)
        : record.similarityPercent,
    errorMessage: snapshot.errorMessage ?? record.errorMessage,
    updatedAt: snapshot.updatedAt || record.updatedAt,
  };
};

const attachReport = (record: AICheckRecord, report: AICheckReport | null): AICheckRecord => ({
  ...record,
  report,
  hasReport: Boolean(report),
  overallSimilarity:
    typeof report?.overallSimilarity === 'number'
      ? report.overallSimilarity
      : record.overallSimilarity,
  similarityPercent:
    typeof report?.overallSimilarity === 'number'
      ? Math.round(report.overallSimilarity * 100)
      : record.similarityPercent,
});

type AlertTone = 'success' | 'info' | 'warning' | 'error';

interface ReportExecutiveSummary {
  tone: AlertTone;
  title: string;
  description: string;
  actions: string[];
}

interface ReportTaskCenter {
  readinessScore: number;
  readinessLabel: string;
  readinessColor: string;
  shouldFixImmediately: boolean;
  fixNowLabel: string;
  fixNowColor: string;
  decisionTone: AlertTone;
  decisionTitle: string;
  decisionDescription: string;
  keyIssues: string[];
  nextRoundSuggestions: string[];
}

const MODAL_PANEL_STYLE = {
  border: '1px solid #edf1f5',
  borderRadius: 14,
  padding: 16,
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,250,252,0.96) 100%)',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)',
};

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const formatParagraphLabel = (paragraphIndex: number): string => `段落 #${paragraphIndex + 1}`;

const buildReportTaskCenter = (
  record: AICheckRecord,
  report: AICheckReport,
  summary: ReportExecutiveSummary,
  reviewCount: number,
  lowConfidenceCount: number,
): ReportTaskCenter => {
  const rankedDetails = [...report.details].sort((left, right) => right.similarity - left.similarity);
  const topRiskDetail = rankedDetails[0];
  const lowConfidenceDetail = report.details
    .filter((detail) => typeof detail.confidence === 'number')
    .sort((left, right) => (left.confidence ?? 1) - (right.confidence ?? 1))[0];
  const actionableDetail = report.details.find(
    (detail) => Boolean(detail.suggestion) || detail.reviewBucket !== 'clear',
  );
  const shouldFixImmediately =
    summary.tone === 'error' ||
    report.duplicateParagraphs > 0 ||
    report.overallSimilarity >= HIGH_RISK_THRESHOLD;

  const penalty =
    report.duplicateParagraphs * 18 +
    reviewCount * 10 +
    lowConfidenceCount * 7 +
    (report.overallSimilarity >= HIGH_RISK_THRESHOLD
      ? 18
      : report.overallSimilarity >= 0.45
        ? 8
        : 0);
  const readinessScore = clampNumber(100 - penalty, shouldFixImmediately ? 12 : 36, 98);

  let readinessLabel = '可直接回流 AI 写作';
  let readinessColor = 'success';
  if (readinessScore < 65) {
    readinessLabel = '需先整改后再回流';
    readinessColor = 'error';
  } else if (readinessScore < 85) {
    readinessLabel = '补完重点问题再回流';
    readinessColor = 'warning';
  }

  const keyIssues: string[] = [];
  if (report.duplicateParagraphs > 0) {
    keyIssues.push(`已判定重复段落 ${report.duplicateParagraphs} 处，优先重写或补引。`);
  }
  if (topRiskDetail) {
    keyIssues.push(
      `${formatParagraphLabel(topRiskDetail.paragraphIndex)} 相似度 ${formatSimilarity(
        topRiskDetail.similarity,
      )}${topRiskDetail.matchedSource?.title ? `，主要命中 ${topRiskDetail.matchedSource.title}` : ''}。`,
    );
  }
  if (reviewCount > 0) {
    keyIssues.push(`仍有 ${reviewCount} 处高相似段落需要人工复核后才能放行。`);
  }
  if (lowConfidenceCount > 0 && lowConfidenceDetail) {
    keyIssues.push(
      `低置信度命中 ${lowConfidenceCount} 处，最低的是 ${formatParagraphLabel(
        lowConfidenceDetail.paragraphIndex,
      )}，建议核对命中来源是否成立。`,
    );
  }
  if (report.topSourceTitle) {
    keyIssues.push(`重合风险主要集中在来源“${report.topSourceTitle}”，下一轮应优先切断该链路。`);
  }
  if (keyIssues.length === 0) {
    keyIssues.push('本轮没有明显阻塞项，可以把当前报告作为写作回流的基线。');
  }

  const nextRoundSuggestions = Array.from(
    new Set(
      [
        ...summary.actions,
        actionableDetail
          ? `下一轮优先处理 ${formatParagraphLabel(actionableDetail.paragraphIndex)}：${
              actionableDetail.suggestion || actionableDetail.reviewAction
            }`
          : '',
        !shouldFixImmediately
          ? '进入 AI 写作前，先保留这份报告作为基线，改稿后再复检一次。'
          : '',
      ].filter(Boolean),
    ),
  ).slice(0, 4);

  return {
    readinessScore,
    readinessLabel,
    readinessColor,
    shouldFixImmediately,
    fixNowLabel: shouldFixImmediately ? '建议立即整改' : '可先进入回流',
    fixNowColor: shouldFixImmediately ? 'error' : 'success',
    decisionTone: shouldFixImmediately ? 'error' : summary.tone === 'warning' ? 'warning' : 'success',
    decisionTitle: shouldFixImmediately
      ? '当前更适合先做整改，再进入 AI 写作回流。'
      : summary.tone === 'warning'
        ? '可以进入下一轮，但建议先处理本轮重点问题。'
        : '当前稿件已具备较好的 AI 写作回流准备度。',
    decisionDescription: shouldFixImmediately
      ? `准备度 ${readinessScore}% 。建议先消化重复、复核和低置信度问题，再发起整稿回流。`
      : `准备度 ${readinessScore}% 。${summary.description}`,
    keyIssues,
    nextRoundSuggestions,
  };
};

const getReportExecutiveSummary = (
  record: AICheckRecord,
  report: AICheckReport,
  reviewCount: number,
  lowConfidenceCount: number,
): ReportExecutiveSummary => {
  const actions: string[] = [];

  if (report.duplicateParagraphs > 0) {
    actions.push(
      `请在下一轮提交前处理 ${report.duplicateParagraphs} 个重复段落，补引或重写。`,
    );
  }

  if (reviewCount > 0) {
    actions.push(
      `请复核 ${reviewCount} 个高相似但尚未确认重复的段落，并做出编辑判断。`,
    );
  }

  if (lowConfidenceCount > 0) {
    actions.push(
      `请核对 ${lowConfidenceCount} 处低置信度命中与源文内容，再决定是否放行。`,
    );
  }

  if (report.topSourceTitle) {
    actions.push(`请重点检查与“${report.topSourceTitle}”的重合关系，确认范围与补引需求。`);
  }

  if (actions.length === 0) {
    actions.push('当前没有发现明显阻塞问题，可先把这份报告作为基线，重大修改后再复检。');
  }

  const descriptionParts = [
    `共检查 ${report.totalParagraphs} 个段落`,
    `${report.duplicateParagraphs} 处重复`,
    `${reviewCount} 处人工复核`,
    `${lowConfidenceCount} 处低置信度`,
  ];

  if (report.topSourceTitle) {
    descriptionParts.push(`最高重合来源：${report.topSourceTitle}`);
  }

  if (record.status === 'failed') {
    return {
      tone: 'error',
      title: '在失败任务恢复前，这条记录暂时无法进入分诊。',
      description: record.errorMessage || '检查任务在生成稳定报告前就已经失败。',
      actions,
    };
  }

  if (report.duplicateParagraphs > 0 || report.overallSimilarity >= HIGH_RISK_THRESHOLD) {
    return {
      tone: 'error',
      title: '高风险相似度需要先重写或补引后再提交。',
      description: descriptionParts.join(' | '),
      actions,
    };
  }

  if (reviewCount > 0 || lowConfidenceCount > 0) {
    return {
      tone: 'warning',
      title: '在放行当前草稿前，仍需人工分诊。',
      description: descriptionParts.join(' | '),
      actions,
    };
  }

  return {
    tone: 'success',
    title: '当前报告中没有发现明显阻塞性的相似度问题。',
    description: descriptionParts.join(' | '),
    actions,
  };
};

const AICheckPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const surfaceMode: AICheckSurfaceMode = location.pathname.includes('/semantic')
    ? 'semantic'
    : location.pathname.includes('/compliance')
      ? 'compliance'
      : 'check';
  const surfaceConfig = AI_CHECK_SURFACE_CONFIG[surfaceMode];
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<{ kbId?: string }>();
  const [activeType, setActiveType] = useState<AICheckBusType>('project');
  const [searchText, setSearchText] = useState('');
  const [timeFilter, setTimeFilter] = useState<AICheckTimeFilter>('all');
  const [focusFilter, setFocusFilter] = useState<AICheckFocusFilter>('all');
  const [records, setRecords] = useState<AICheckRecord[]>([]);
  const [summary, setSummary] = useState<AICheckSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
  });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportRecord, setReportRecord] = useState<AICheckRecord | null>(null);
  const [reportData, setReportData] = useState<AICheckReport | null>(null);
  const [writeOutlineLaunching, setWriteOutlineLaunching] = useState(false);
  const deepLinkTaskId = useMemo(
    () => new URLSearchParams(location.search).get('taskId')?.trim() || null,
    [location.search],
  );
  const deepLinkTaskType = useMemo(
    () => normalizeCheckBusType(new URLSearchParams(location.search).get('taskType')),
    [location.search],
  );
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(deepLinkTaskId);

  const deferredSearchText = useDeferredValue(searchText.trim());
  const currentTypeOption = useMemo(
    () => AI_CHECK_BUS_TYPE_OPTIONS.find((item) => item.value === activeType),
    [activeType],
  );
  const hasActiveFilters = Boolean(deferredSearchText) || timeFilter !== 'all';
  const reportReviewCount = useMemo(
    () =>
      reportData?.details.filter(
        (detail) => !detail.isDuplicate && detail.similarity >= HIGH_RISK_THRESHOLD,
      ).length || 0,
    [reportData],
  );
  const lowConfidenceCount = useMemo(
    () =>
      reportData?.details.filter(
        (detail) =>
          typeof detail.confidence === 'number' && detail.confidence < HIGH_RISK_THRESHOLD,
      ).length || 0,
    [reportData],
  );
  const emptyDescription = hasActiveFilters
    ? '当前筛选条件下没有匹配的记录。'
    : '暂无历史数据，你可以点击上传文件进行检查';
  const reportExecutiveSummary = useMemo(() => {
    if (!reportRecord || !reportData) {
      return null;
    }

    return getReportExecutiveSummary(reportRecord, reportData, reportReviewCount, lowConfidenceCount);
  }, [lowConfidenceCount, reportData, reportRecord, reportReviewCount]);
  const reportTaskCenter = useMemo(() => {
    if (!reportRecord || !reportData || !reportExecutiveSummary) {
      return null;
    }

    return buildReportTaskCenter(
      reportRecord,
      reportData,
      reportExecutiveSummary,
      reportReviewCount,
      lowConfidenceCount,
    );
  }, [
    lowConfidenceCount,
    reportData,
    reportExecutiveSummary,
    reportRecord,
    reportReviewCount,
  ]);
  const reportMarkdown = useMemo(
    () =>
      reportRecord && reportData && reportExecutiveSummary
        ? buildCheckReportMarkdown(reportRecord, reportData, reportExecutiveSummary.actions)
        : '',
    [reportData, reportExecutiveSummary, reportRecord],
  );
  const reportPlainText = useMemo(() => stripMarkdownSyntax(reportMarkdown), [reportMarkdown]);

  const syncRecord = useCallback((nextRecord: AICheckRecord) => {
    setRecords((current) =>
      current.map((item) => (item.id === nextRecord.id ? nextRecord : item)),
    );
    setReportRecord((current) => (current?.id === nextRecord.id ? nextRecord : current));
  }, []);

  useEffect(() => {
    setPendingTaskId(deepLinkTaskId);
  }, [deepLinkTaskId]);

  const loadRecords = useCallback(
    async (pageNo = pagination.current, pageSize = pagination.pageSize, silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const result = await aiCheckService.listRecords({
          busType: activeType,
          searchKey: deferredSearchText || undefined,
          checkTime: timeFilter,
          focus: focusFilter,
          pageNo,
          pageSize,
        });

        setRecords(result.items);
        setSummary(result.summary);
        setPagination((current) => ({
          ...current,
          current: result.pageNo || pageNo,
          pageSize: result.pageSize || pageSize,
          total: result.total,
        }));
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
            setSummary(EMPTY_SUMMARY);
            setPagination((current) => ({
              ...current,
              current: 1,
              total: 0,
            }));
            return;
          }
          const errorMessage = getAICheckErrorMessage(
            error,
            '加载 AI 检查记录失败，请稍后再试。',
          );
          messageApi.error(errorMessage);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [
      activeType,
      deferredSearchText,
      focusFilter,
      messageApi,
      pagination.current,
      pagination.pageSize,
      timeFilter,
    ],
  );

  const refreshReport = useCallback(
    async (targetRecord?: AICheckRecord | null, silent = false) => {
      const baseRecord = targetRecord || reportRecord || null;
      if (!baseRecord) {
        return null;
      }

      if (!silent) {
        setReportLoading(true);
      }

      try {
        const snapshot = await aiCheckService.getStatus(baseRecord.id);
        const statusSyncedRecord = mergeStatusSnapshot(baseRecord, snapshot);
        syncRecord(statusSyncedRecord);

        if (snapshot.status !== 'completed') {
          if (snapshot.status === 'failed') {
            setReportData(null);
          }
          return statusSyncedRecord;
        }

        const report = await aiCheckService.getReport(baseRecord.id);
        setReportData(report);
        const completedRecord = attachReport(statusSyncedRecord, report);
        syncRecord(completedRecord);
        return completedRecord;
      } catch (error) {
        if (!silent) {
          messageApi.error(getAICheckErrorMessage(error, '加载 AI 检查报告失败。'));
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
    void loadRecords(pagination.current, pagination.pageSize);
  }, [loadRecords, pagination.current, pagination.pageSize]);

  useEffect(() => {
    if (!records.some((item) => ACTIVE_STATUSES.has(item.status))) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void loadRecords(pagination.current, pagination.pageSize, true);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [loadRecords, pagination.current, pagination.pageSize, records]);

  useEffect(() => {
    if (!reportOpen || !reportRecord || !ACTIVE_STATUSES.has(reportRecord.status)) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void refreshReport(reportRecord, true);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [refreshReport, reportOpen, reportRecord]);

  const openFirstPage = () => {
    setPagination((current) =>
      current.current === 1 ? current : { ...current, current: 1 },
    );
  };

  const handleTypeChange = (nextType: AICheckBusType) => {
    if (nextType === activeType) {
      return;
    }

    startTransition(() => {
      setActiveType(nextType);
      openFirstPage();
    });
  };

  const handleTimeFilterChange = (nextFilter: AICheckTimeFilter) => {
    if (nextFilter === timeFilter) {
      return;
    }

    startTransition(() => {
      setTimeFilter(nextFilter);
      openFirstPage();
    });
  };

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    openFirstPage();
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
      messageApi.warning('请先选择要上传的检查文件。');
      return;
    }

    setUploading(true);
    try {
      await aiCheckService.uploadRecord(file, {
        type: activeType,
        kbId: values.kbId?.trim() || undefined,
      });
      messageApi.success('检查文件已上传，任务已开始执行。');
      setUploadOpen(false);
      form.resetFields();
      setUploadFileList([]);

      if (pagination.current !== 1) {
        setPagination((current) => ({ ...current, current: 1 }));
      } else {
        await loadRecords(1, pagination.pageSize);
      }
    } catch (error) {
      messageApi.error(getAICheckErrorMessage(error, '上传 AI 检查文件失败。'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (record: AICheckRecord) => {
    try {
      await aiCheckService.deleteRecord(record.id);
      messageApi.success('检查记录已删除。');

      if (reportRecord?.id === record.id) {
        setReportOpen(false);
        setReportRecord(null);
        setReportData(null);
      }

      const shouldGoPrevPage = records.length === 1 && pagination.current > 1;
      if (shouldGoPrevPage) {
        setPagination((current) => ({
          ...current,
          current: Math.max(1, current.current - 1),
        }));
        return;
      }

      await loadRecords(pagination.current, pagination.pageSize);
    } catch (error) {
      messageApi.error(getAICheckErrorMessage(error, '删除 AI 检查记录失败。'));
    }
  };

  const handleViewReport = useCallback(async (record: AICheckRecord) => {
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
      setPagination((current) => ({ ...current, current: 1 }));
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
      messageApi.warning('当前还没有可复制的检查报告。');
      return;
    }

    try {
      await copyTextToClipboard(reportMarkdown);
      messageApi.success('检查报告已复制。');
    } catch (error) {
      messageApi.error(getAICheckErrorMessage(error, '复制检查报告失败。'));
    }
  };

  const handleExportCurrentReport = (extension: 'md' | 'txt') => {
    if (!reportRecord || !reportMarkdown) {
      messageApi.warning('当前还没有可导出的检查报告。');
      return;
    }

    downloadTextFile(
      extension === 'md' ? reportMarkdown : reportPlainText,
      `${reportRecord.fileName}-ai-check-report`,
      extension,
    );
    messageApi.success(extension === 'md' ? '检查报告 Markdown 已导出。' : '检查报告 TXT 已导出。');
  };

  const handleSendToWrite = () => {
    if (!reportRecord || !reportData || !reportExecutiveSummary) {
      messageApi.warning('当前还没有可回流到 AI 写作的检查报告。');
      return;
    }

    const seed = buildCheckRewriteSeed(reportRecord, reportData, reportExecutiveSummary.actions);
    const seedKey = savePendingAiWriteSeed(seed);

    const search = new URLSearchParams();
    search.set('kind', seed.kind);
    search.set('seedKey', seedKey);
    search.set('from', `${location.pathname}${location.search}`);

    navigate(buildAiWriteDetailPath(seed.kind, search));
  };

  const handleCreateWriteOutline = async () => {
    if (!reportRecord || !reportData || !reportExecutiveSummary) {
      messageApi.warning('当前还没有可用于生成整改提纲的检查报告。');
      return;
    }

    const seed = buildCheckRewriteSeed(reportRecord, reportData, reportExecutiveSummary.actions);
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

  const columns: TableColumnsType<AICheckRecord> = [
    {
      title: '名称',
      dataIndex: 'fileName',
      key: 'fileName',
      width: '46%',
      render: (_, record) => (
        <div className="ai-write-table-title-cell">
          <div className="ai-write-table-title-line">
            <div className="ai-write-table-title">{record.fileName}</div>
          </div>
          <div className="ai-write-table-meta-line">
            <span>{record.typeLabel}</span>
            {record.kbId ? <span>知识库：{record.kbId}</span> : null}
            {record.topSourceTitle ? <span>{record.topSourceTitle}</span> : null}
          </div>
        </div>
      ),
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 176,
      render: (_, record) => (
        <div className="ai-write-table-date-cell">
          <div>{formatDateTime(record.createdAt)}</div>
          <span>更新于 {formatDateTime(record.updatedAt)}</span>
        </div>
      ),
    },
    {
      title: '检查',
      key: 'check',
      width: 240,
      render: (_, record) => (
        <div className="ai-write-table-progress-cell">
          <div className="ai-write-table-progress-head">
            <span>{record.statusLabel}</span>
            <span>{formatSimilarity(record.overallSimilarity)}</span>
          </div>
          <div className="ai-write-table-meta-line">
            <span>{record.riskLabel}</span>
            <span>
              {record.needsReviewParagraphs > 0
                ? `${record.needsReviewParagraphs} 个段落待复核`
                : record.lowConfidenceParagraphs > 0
                  ? `${record.lowConfidenceParagraphs} 处低置信度命中`
                  : ACTIVE_STATUSES.has(record.status)
                    ? '检查进行中'
                    : '可查看报告'}
            </span>
          </div>
          <div className="ai-write-table-progress-hint">
            {record.errorMessage || record.topSourceTitle || '系统将返回相似片段与人工复核建议。'}
          </div>
          <div className="ai-write-table-progress-subhint">{getCheckRowRewriteHint(record)}</div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 156,
      align: 'right',
      render: (_, record) => (
        <div className="ai-write-table-actions">
          <Button type="link" size="small" onClick={() => void handleViewReport(record)}>
            查看报告
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
      <section className="ai-tool-hero ai-tool-hero-check">
        <div className="ai-tool-hero-copy">
          <span className="ai-tool-hero-kicker">ScholarMate AI Check</span>
          <h1>{surfaceConfig.sidebarTitle}</h1>
          <p>
            上传项目、论文或专利文档，集中查看相似度风险、待复核段落、低置信命中和回流 AI 写作的整改动作。
          </p>
          <div className="ai-tool-hero-tags">
            <Tag bordered={false}>相似度检查</Tag>
            <Tag bordered={false}>合规自查</Tag>
            <Tag bordered={false}>语义查重</Tag>
          </div>
        </div>
        <div className="ai-tool-hero-side">
          <div className="ai-tool-hero-metric">
            <strong>{summary.attention}</strong>
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
                  <FileSearchOutlined />
                </div>
                  <div className="ai-write-sidebar-brand-copy">
                  <div className="ai-tool-sidebar-title">{surfaceConfig.sidebarTitle}</div>
                </div>
              </div>
            </div>
            <div className="ai-tool-sidebar-nav">
              {AI_CHECK_BUS_TYPE_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`ai-tool-nav-item ${
                    activeType === item.value ? 'ai-sidebar-nav-item-active' : ''
                  }`}
                  onClick={() => handleTypeChange(item.value)}
                >
                  <div className="ai-tool-nav-icon">{CHECK_TYPE_ICONS[item.value]}</div>
                  <div className="ai-tool-nav-copy">
                    <div className="ai-write-sidebar-nav-title">{item.label}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="ai-tool-sidebar-divider" />
            <div className="ai-tool-sidebar-section">
              <div className="ai-write-filter-head">
                <div className="ai-write-sidebar-section-label">筛选条件</div>
                <button
                  type="button"
                  className="ai-write-filter-reset"
                  onClick={() => {
                    startTransition(() => {
                      setTimeFilter('all');
                      setFocusFilter('all');
                      setSearchText('');
                      openFirstPage();
                    });
                  }}
                >
                  重置
                </button>
              </div>
              <div className="ai-write-sidebar-section-label ai-write-sidebar-section-label-sub">
                上传时间
              </div>
              {AI_CHECK_TIME_FILTER_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`ai-sidebar-filter-item ${
                    timeFilter === item.value ? 'ai-sidebar-filter-item-active' : ''
                  }`}
                  onClick={() => handleTimeFilterChange(item.value)}
                >
                  {item.label}
                </button>
              ))}
              <div className="ai-write-sidebar-section-label ai-write-sidebar-section-label-sub">
                关注重点
              </div>
              {AI_CHECK_FOCUS_FILTER_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`ai-sidebar-filter-item ${
                    focusFilter === item.value ? 'ai-sidebar-filter-item-active' : ''
                  }`}
                  onClick={() => {
                    startTransition(() => {
                      setFocusFilter(item.value);
                      openFirstPage();
                    });
                  }}
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
                  placeholder="请输入关键词..."
                  value={searchText}
                  onChange={(event) => handleSearchChange(event.target.value)}
                />
                <div className="ai-tool-inline-note">
                  <InfoCircleOutlined />
                  <span>{surfaceConfig.helperText}</span>
                </div>
                <Button type="primary" icon={<UploadOutlined />} onClick={handleOpenUpload}>
                  {surfaceConfig.uploadButtonText}
                </Button>
              </div>
            </div>

            <div className="ai-write-stats">
              <Card variant="borderless" className="ai-write-stat-card">
                <Statistic title="当前记录" value={summary.total} suffix="份" />
              </Card>
              <Card variant="borderless" className="ai-write-stat-card">
                <Statistic title="优先关注" value={summary.attention} suffix="份" />
              </Card>
              <Card variant="borderless" className="ai-write-stat-card">
                <Statistic title="已出报告" value={summary.withReport} suffix="份" />
              </Card>
              <Card variant="borderless" className="ai-write-stat-card">
                <Statistic
                  title="平均相似度"
                  value={Math.round(summary.averageSimilarity * 100)}
                  suffix="%"
                />
              </Card>
            </div>

            <div className="ai-write-table-card">
              <Table
                rowKey="id"
                loading={loading}
                columns={columns}
                dataSource={records}
                scroll={{ x: 960 }}
                locale={{
                  emptyText: (
                    <Empty
                      image={<FileSearchOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
                      description={emptyDescription}
                    >
                      <Button type="primary" icon={<UploadOutlined />} onClick={handleOpenUpload}>
                        {surfaceConfig.uploadButtonText}
                      </Button>
                    </Empty>
                  ),
                }}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (value) => `共 ${value} 条`,
                  onChange: (pageNo, pageSize) => {
                    setPagination((current) => ({
                      ...current,
                      current: pageNo,
                      pageSize: pageSize || current.pageSize,
                    }));
                  },
                }}
              />
            </div>

            <div className="ai-page-footer">
              {surfaceConfig.footerText}
            </div>
          </div>
        </section>
      </div>

      <Modal
        title={`${surfaceConfig.uploadTitlePrefix}${currentTypeOption?.label || ''}文件`}
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
            extra="可留空。只有在你希望限定到指定知识库时才需要填写。"
          >
            <Input placeholder="如需指定知识库，可在此输入编号" allowClear />
          </Form.Item>
          <Form.Item label="文件" required>
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
        width={920}
      >
        {reportRecord && (
          <Space
            align="start"
            style={{ width: '100%', justifyContent: 'space-between', marginTop: 8 }}
          >
            <Space wrap>
              <Tag color={reportRecord.statusColor}>{reportRecord.statusLabel}</Tag>
              {typeof reportRecord.overallSimilarity === 'number' && (
                <Tag
                  color={
                    reportRecord.overallSimilarity >= HIGH_RISK_THRESHOLD
                      ? 'error'
                      : 'processing'
                  }
                >
                  总相似度 {formatSimilarity(reportRecord.overallSimilarity)}
                </Tag>
              )}
              <Text type="secondary">
                最后更新：{formatDateTime(reportRecord.updatedAt)}
              </Text>
            </Space>
            <Space wrap size={[8, 8]}>
              <Button
                type="primary"
                disabled={!reportData || !reportExecutiveSummary}
                loading={writeOutlineLaunching}
                onClick={() => void handleCreateWriteOutline()}
              >
                一键生成整改提纲
              </Button>
              <Button
                disabled={!reportData || !reportExecutiveSummary}
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
            description="只要任务仍在运行，这个弹窗就会每 5 秒自动刷新一次。"
            style={{ marginTop: 16 }}
          />
        )}

        {reportRecord && reportData && (
          <div style={{ marginTop: 16 }}>
            {reportExecutiveSummary && (
              <>
                <Alert
                  type={reportExecutiveSummary.tone}
                  showIcon
                  message={reportExecutiveSummary.title}
                  description={reportExecutiveSummary.description}
                  style={{ marginBottom: 16 }}
                />

                {reportTaskCenter && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ ...MODAL_PANEL_STYLE, gridColumn: '1 / -1' }}>
                      <Space
                        align="start"
                        style={{ width: '100%', justifyContent: 'space-between', marginBottom: 14 }}
                      >
                        <div>
                          <Text strong style={{ fontSize: 16 }}>
                            任务中心
                          </Text>
                          <Paragraph style={{ margin: '6px 0 0', color: '#5f6f7d' }}>
                            用一屏先判断这份报告是否适合直接回流 AI 写作，以及本轮最值得先处理的阻塞项。
                          </Paragraph>
                        </div>
                        <Space wrap size={[8, 8]}>
                          <Tag color={reportTaskCenter.readinessColor}>
                            回流准备度 {reportTaskCenter.readinessScore}%
                          </Tag>
                          <Tag color={reportTaskCenter.fixNowColor}>
                            {reportTaskCenter.fixNowLabel}
                          </Tag>
                        </Space>
                      </Space>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(220px, 280px) 1fr',
                          gap: 16,
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <Progress
                            percent={reportTaskCenter.readinessScore}
                            strokeColor={
                              reportTaskCenter.readinessColor === 'error'
                                ? '#ff4d4f'
                                : reportTaskCenter.readinessColor === 'warning'
                                  ? '#faad14'
                                  : '#52c41a'
                            }
                          />
                          <Paragraph style={{ margin: '8px 0 0', color: '#22313d' }}>
                            <Text strong>{reportTaskCenter.readinessLabel}</Text>
                          </Paragraph>
                        </div>
                        <Alert
                          type={reportTaskCenter.decisionTone}
                          showIcon
                          message={reportTaskCenter.decisionTitle}
                          description={reportTaskCenter.decisionDescription}
                        />
                      </div>
                    </div>

                    <div style={MODAL_PANEL_STYLE}>
                      <Space
                        align="start"
                        style={{ width: '100%', justifyContent: 'space-between', marginBottom: 10 }}
                      >
                        <Text strong>本轮重点问题摘要</Text>
                        <Space wrap size={[8, 8]}>
                          <Tag color="error">{reportData.duplicateParagraphs} 处重复</Tag>
                          <Tag color="warning">{reportReviewCount} 处待复核</Tag>
                          <Tag color="processing">{lowConfidenceCount} 处低置信度</Tag>
                        </Space>
                      </Space>
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        {reportTaskCenter.keyIssues.map((issue, index) => (
                          <div
                            key={`${issue}-${index}`}
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
                            <Text style={{ lineHeight: 1.7 }}>{issue}</Text>
                          </div>
                        ))}
                      </Space>
                    </div>

                    <div style={MODAL_PANEL_STYLE}>
                      <Text strong>下一轮建议</Text>
                      <Paragraph style={{ marginTop: 8, marginBottom: 12, color: '#5f6f7d' }}>
                        尽量沿用本轮执行摘要，直接整理成下一轮整改或 AI 写作回流的任务单。
                      </Paragraph>
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        {reportTaskCenter.nextRoundSuggestions.map((action, index) => (
                          <div
                            key={`${action}-${index}`}
                            style={{
                              paddingBottom:
                                index === reportTaskCenter.nextRoundSuggestions.length - 1 ? 0 : 10,
                              borderBottom:
                                index === reportTaskCenter.nextRoundSuggestions.length - 1
                                  ? 'none'
                                  : '1px solid #f0f0f0',
                            }}
                          >
                            <Text strong>{`0${index + 1}`.slice(-2)}</Text>
                            <Paragraph style={{ margin: '4px 0 0' }}>{action}</Paragraph>
                          </div>
                        ))}
                      </Space>
                    </div>
                  </div>
                )}

                <Card
                  size="small"
                  title="建议处理动作"
                  className="ai-write-detail-card"
                  style={{ marginBottom: 16 }}
                  extra={
                    <Space wrap size={[8, 8]}>
                      <Tag color="error">{reportData.duplicateParagraphs} 处重复</Tag>
                      <Tag color="warning">{reportReviewCount} 处待复核</Tag>
                      <Tag color="processing">{lowConfidenceCount} 处低置信度</Tag>
                    </Space>
                  }
                >
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    {reportExecutiveSummary.actions.map((action, index) => (
                      <div
                        key={`${action}-${index}`}
                        style={{
                          paddingBottom:
                            index === reportExecutiveSummary.actions.length - 1 ? 0 : 10,
                          borderBottom:
                            index === reportExecutiveSummary.actions.length - 1
                              ? 'none'
                              : '1px solid #f0f0f0',
                        }}
                      >
                        <Text strong>{`0${index + 1}`.slice(-2)}</Text>
                        <Paragraph style={{ margin: '4px 0 0' }}>{action}</Paragraph>
                      </div>
                    ))}
                  </Space>
                </Card>
              </>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <Statistic
                title="总相似度"
                value={Math.round(reportData.overallSimilarity * 100)}
                suffix="%"
              />
              <Statistic title="检查段落数" value={reportData.totalParagraphs} />
              <Statistic title="重复段落数" value={reportData.duplicateParagraphs} />
              <Statistic title="需复核" value={reportReviewCount} />
              <Statistic title="低置信度" value={lowConfidenceCount} />
            </div>

            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="文件名">{reportRecord.fileName}</Descriptions.Item>
              <Descriptions.Item label="上传时间">
                {formatDateTime(reportRecord.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="知识库编号">
                {reportRecord.kbId || '-'}
              </Descriptions.Item>
            </Descriptions>

            {reportData.details.length === 0 ? (
              <Empty description="报告已生成，但当前没有需要展示的高亮段落。" />
            ) : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {reportData.details.map((detail) => (
                  <div
                    key={`${detail.paragraphIndex}-${detail.similarity}`}
                    style={{
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                      padding: 16,
                      background: detail.isDuplicate ? '#fff2f0' : '#fafafa',
                    }}
                  >
                    <Space
                      align="start"
                      style={{ width: '100%', justifyContent: 'space-between' }}
                    >
                      <Text strong>段落 #{detail.paragraphIndex + 1}</Text>
                      <Space wrap size={[6, 6]}>
                        <Tag color={detail.isDuplicate ? 'error' : 'processing'}>
                          相似度 {formatSimilarity(detail.similarity)}
                        </Tag>
                        <Tag color={detail.reviewColor}>{detail.reviewLabel}</Tag>
                      </Space>
                    </Space>
                    <Paragraph style={{ marginTop: 8, marginBottom: 12 }}>
                      {detail.paragraph || '暂无段落内容。'}
                    </Paragraph>
                    {detail.judgement && (
                      <Paragraph style={{ marginBottom: 8 }}>
                        <Text strong>判定： </Text>
                        {detail.judgement}
                        {typeof detail.confidence === 'number' && (
                          <Text type="secondary">
                            {' '}
                            （置信度 {Math.round(detail.confidence * 100)}%）
                          </Text>
                        )}
                      </Paragraph>
                    )}
                    {detail.matchedSource && (
                      <div style={{ marginBottom: 8 }}>
                        <Text strong>命中来源： </Text>
                        <div>{detail.matchedSource.title || '未命名来源'}</div>
                        <Text type="secondary">{detail.matchedSource.content}</Text>
                      </div>
                    )}
                    {detail.suggestion && (
                      <Paragraph style={{ marginBottom: 0 }}>
                        <Text strong>修改建议： </Text>
                        {detail.suggestion}
                      </Paragraph>
                    )}
                    <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                      <Text strong>处理动作： </Text>
                      {detail.reviewAction}
                    </Paragraph>
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
            <Empty
              description="当前记录还没有可展示的报告内容。"
              style={{ marginTop: 24 }}
            />
          )}
      </Modal>
    </div>
  );
};

export default AICheckPage;
