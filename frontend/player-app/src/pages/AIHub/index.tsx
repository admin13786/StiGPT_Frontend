import { startTransition, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Progress, Space, Spin, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import {
  ApartmentOutlined,
  AuditOutlined,
  BookOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  ReadOutlined,
  RightOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { aiWriteService } from '../../services/ai-write.service';
import { aiCheckService } from '../../services/ai-check.service';
import { aiReviewService } from '../../services/ai-review.service';
import type { AiWriteListResult, AiWriteRecord } from '../../types/ai-write';
import type { AICheckListResult, AICheckRecord } from '../../types/aiCheck';
import type { AIReviewListResult, AIReviewRecord } from '../../types/aiReview';
import { buildAiWriteDetailPath } from '../../utils/aiWriteBridge';
import './index.css';

const { Paragraph, Text } = Typography;

type WorkflowKey = 'write' | 'check' | 'review';

type SidebarItem = {
  key: string;
  title: string;
  description: string;
  path: string;
  primary?: boolean;
};

type WorkflowCard = {
  key: WorkflowKey;
  title: string;
  subtitle: string;
  description: string;
  path: string;
  icon: ReactNode;
  categories: string[];
  statusLabel: string;
  statusColor: string;
  stats: Array<{ label: string; value: string }>;
  highlights: string[];
  primaryAction: { label: string; path: string };
  secondaryAction?: { label: string; path: string };
};

type ExtensionTool = {
  key: string;
  title: string;
  description: string;
  path: string;
  icon: ReactNode;
};

type SourceState = {
  key: WorkflowKey;
  label: string;
  status: 'loading' | 'ready' | 'warning' | 'error';
  note: string;
  countLabel: string;
};

type RecentTask = {
  key: string;
  title: string;
  stage: string;
  time: string;
  statusColor: string;
  path: string;
  description: string;
  updatedAt: string;
};

type ReadinessModel = {
  score: number;
  tone: 'success' | 'info' | 'warning' | 'error';
  label: string;
  description: string;
  nextLabel: string;
  nextPath: string;
  actions: string[];
};

const primarySidebarItems: SidebarItem[] = [
  {
    key: 'hub',
    title: '工作台首页',
    description: '汇总 AI 写作、AI 检查、AI 评审、AI 问答和知识图谱入口。',
    path: '/apps/ai-hub',
    primary: true,
  },
  {
    key: 'write',
    title: 'AI 写作',
    description: '围绕项目申请和期刊论文推进提纲、章节、全文与整改回流。',
    path: '/apps/stigpt/write',
  },
  {
    key: 'check',
    title: 'AI 检查',
    description: '上传文档后查看相似度、风险分诊、低置信命中和整改建议。',
    path: '/apps/stigpt/check',
  },
  {
    key: 'review',
    title: 'AI 评审',
    description: '模拟同行评审与编辑视角，输出评分、结论和修改方向。',
    path: '/apps/stigpt/review',
  },
  {
    key: 'webidx',
    title: 'AI 问答',
    description: '回到统一问答入口，继续追问、引用资料和切换场景路线。',
    path: '/apps/stigpt/webIdx',
  },
];

const extensionTools: ExtensionTool[] = [
  {
    key: 'achievement',
    title: '文献查真',
    description: '核验论文、作者、机构、主题与成果之间的关系。',
    path: '/apps/stigpt/achievement',
    icon: <ApartmentOutlined />,
  },
  {
    key: 'compliance',
    title: 'AI 合规检查',
    description: '围绕规范性、表述边界和提交口径做专项检查。',
    path: '/apps/stigpt/compliance',
    icon: <SafetyCertificateOutlined />,
  },
  {
    key: 'semantic',
    title: 'AI 语义查重',
    description: '聚焦语义重复、近似表达和高风险段落。',
    path: '/apps/stigpt/semantic',
    icon: <FileSearchOutlined />,
  },
  {
    key: 'inspect',
    title: 'AI 编辑建议',
    description: '从编辑修改视角整理短板、亮点和修订动作。',
    path: '/apps/stigpt/inspect',
    icon: <AuditOutlined />,
  },
  {
    key: 'policy',
    title: '政策问答',
    description: '解答资格、时间节点、限项规则和申报条款口径。',
    path: '/apps/stigpt/answer/policy',
    icon: <SafetyCertificateOutlined />,
  },
  {
    key: 'read',
    title: 'AI 阅读',
    description: '拆解论文、证据、方法、贡献和局限。',
    path: '/apps/stigpt/aiRead',
    icon: <ReadOutlined />,
  },
];

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }

  const parsed = dayjs(value);
  if (!parsed.isValid()) {
    return value;
  }

  if (parsed.isSame(dayjs(), 'day')) {
    return `今天 ${parsed.format('HH:mm')}`;
  }

  if (parsed.isSame(dayjs().subtract(1, 'day'), 'day')) {
    return `昨天 ${parsed.format('HH:mm')}`;
  }

  return parsed.format('MM-DD HH:mm');
};

const getAiWriteTaskPath = (record: AiWriteRecord) =>
  buildAiWriteDetailPath(record.kind, {
    kind: record.kind,
    taskId: record.id,
    from: '/apps/ai-hub',
  });

const getWriteStatus = (summary?: AiWriteListResult['summary']) => {
  if (!summary?.total) {
    return { label: '未开始', color: 'default' };
  }
  if (summary.active > 0) {
    return { label: '进行中', color: 'processing' };
  }
  if (summary.actionable > 0) {
    return { label: '待推进', color: 'warning' };
  }
  return { label: '已沉淀', color: 'success' };
};

const getCheckStatus = (summary?: AICheckListResult['summary']) => {
  if (!summary?.total) {
    return { label: '未开始', color: 'default' };
  }
  if (summary.highRisk > 0) {
    return { label: '需整改', color: 'error' };
  }
  if (summary.processing > 0 || summary.pending > 0) {
    return { label: '处理中', color: 'processing' };
  }
  return { label: '已沉淀', color: 'success' };
};

const getReviewStatus = (summary?: AIReviewListResult['summary']) => {
  if (!summary?.total) {
    return { label: '未开始', color: 'default' };
  }
  if (summary.attention > 0) {
    return { label: '需处理', color: 'warning' };
  }
  if (summary.processing > 0 || summary.pending > 0) {
    return { label: '处理中', color: 'processing' };
  }
  return { label: '已沉淀', color: 'success' };
};

const buildSourceStates = (
  loading: boolean,
  writeResult: AiWriteListResult | null,
  checkResult: AICheckListResult | null,
  reviewResult: AIReviewListResult | null,
  errors: string[],
): SourceState[] => [
  {
    key: 'write',
    label: 'AI 写作',
    status: loading ? 'loading' : writeResult ? 'ready' : 'error',
    note: writeResult
      ? `当前 ${writeResult.summary.actionable} 条记录可继续推进，平均完成度 ${writeResult.summary.averageCompletionPercent}%。`
      : '未取到写作摘要。',
    countLabel: writeResult ? `${writeResult.summary.total} 条记录` : errors.length ? '待重试' : '加载中',
  },
  {
    key: 'check',
    label: 'AI 检查',
    status: loading ? 'loading' : checkResult ? 'ready' : 'error',
    note: checkResult
      ? `高风险 ${checkResult.summary.highRisk} 条，待复核段落 ${checkResult.summary.needsReview} 处。`
      : '未取到检查摘要。',
    countLabel: checkResult ? `${checkResult.summary.total} 条记录` : errors.length ? '待重试' : '加载中',
  },
  {
    key: 'review',
    label: 'AI 评审',
    status: loading ? 'loading' : reviewResult ? 'ready' : 'error',
    note: reviewResult
      ? `优先关注 ${reviewResult.summary.attention} 条，平均评分 ${reviewResult.summary.averageScore}。`
      : '未取到评审摘要。',
    countLabel: reviewResult ? `${reviewResult.summary.total} 条记录` : errors.length ? '待重试' : '加载中',
  },
];

const buildWorkflowCards = (
  writeResult: AiWriteListResult | null,
  checkResult: AICheckListResult | null,
  reviewResult: AIReviewListResult | null,
): WorkflowCard[] => {
  const writeStatus = getWriteStatus(writeResult?.summary);
  const checkStatus = getCheckStatus(checkResult?.summary);
  const reviewStatus = getReviewStatus(reviewResult?.summary);
  const latestWrite = writeResult?.records[0];
  const latestCheck = checkResult?.items[0];
  const latestReview = reviewResult?.items[0];

  return [
    {
      key: 'write',
      title: 'AI 写作',
      subtitle: '从资料准备到提纲、章节和全文润色的连续写作链路。',
      description:
        '先建立写作资料，再按提纲、章节、全文推进；检查和评审结果可以继续回流为整改写作任务。',
      path: '/apps/stigpt/write',
      icon: <BookOutlined />,
      categories: ['项目申请', '期刊论文', '整改回流'],
      statusLabel: writeStatus.label,
      statusColor: writeStatus.color,
      stats: [
        { label: '累计记录', value: `${writeResult?.summary.total || 0} 条` },
        { label: '进行中', value: `${writeResult?.summary.active || 0} 条` },
        { label: '待推进', value: `${writeResult?.summary.actionable || 0} 条` },
      ],
      highlights: latestWrite
        ? [
            `最近任务《${latestWrite.title}》正在 ${latestWrite.stageLabel || '写作'} 阶段。`,
            latestWrite.nextActionHint || '建议继续补齐提纲、章节和全文润色结果。',
            `已生成 ${latestWrite.wordCount || 0} 字，完成度 ${latestWrite.completionPercent || 0}%。`,
          ]
        : [
            '先从项目申请或期刊论文入口建立第一条写作记录。',
            '完成提纲和章节后，再回流 AI 检查与 AI 评审结果继续修订。',
            '写作记录会持续沉淀为可追溯的科研文档资产。',
          ],
      primaryAction: { label: '进入写作中心', path: '/apps/stigpt/write' },
      secondaryAction: { label: '新建项目写作', path: '/apps/stigpt/write/detail' },
    },
    {
      key: 'check',
      title: 'AI 检查',
      subtitle: '围绕提交前风险排查建立上传、状态轮询与报告闭环。',
      description:
        '把文档上传、相似度风险、低置信命中、整改建议和回流写作放到同一条检查链路中。',
      path: '/apps/stigpt/check',
      icon: <FileSearchOutlined />,
      categories: ['项目', '论文', '专利'],
      statusLabel: checkStatus.label,
      statusColor: checkStatus.color,
      stats: [
        { label: '累计记录', value: `${checkResult?.summary.total || 0} 条` },
        { label: '高风险', value: `${checkResult?.summary.highRisk || 0} 条` },
        { label: '待复核段落', value: `${checkResult?.summary.needsReview || 0} 处` },
      ],
      highlights: latestCheck
        ? [
            `最近检查《${latestCheck.fileName}》风险等级为 ${latestCheck.riskLabel || '待判断'}。`,
            latestCheck.triageReason || '建议优先处理高相似度和低置信命中段落。',
            `当前相似度 ${latestCheck.similarityPercent ?? 0}%，待复核 ${latestCheck.needsReviewParagraphs} 处。`,
          ]
        : [
            '写作形成正文后，优先补跑 AI 检查。',
            '语义查重与合规检查已收编为同一套检查底座的不同模式。',
            '检查结果会沉淀为提交前风险台账。',
          ],
      primaryAction: { label: '进入检查中心', path: '/apps/stigpt/check' },
      secondaryAction: { label: '查看合规检查', path: '/apps/stigpt/compliance' },
    },
    {
      key: 'review',
      title: 'AI 评审',
      subtitle: '模拟项目评审和论文评审，沉淀结论、维度与下一步动作。',
      description:
        '把评审报告从“看结果”推进到“形成修改任务并回流写作”，更接近真实投稿前决策。',
      path: '/apps/stigpt/review',
      icon: <AuditOutlined />,
      categories: ['项目评审', '论文评审', '编辑建议'],
      statusLabel: reviewStatus.label,
      statusColor: reviewStatus.color,
      stats: [
        { label: '累计记录', value: `${reviewResult?.summary.total || 0} 条` },
        { label: '优先关注', value: `${reviewResult?.summary.attention || 0} 条` },
        { label: '修改后可投', value: `${reviewResult?.summary.revision || 0} 条` },
      ],
      highlights: latestReview
        ? [
            `最近评审《${latestReview.fileName}》评分 ${latestReview.overallScore ?? '-'}。`,
            latestReview.needsAttention ? '该结果需要优先处理阻塞项和修改建议。' : '该结果暂无高优先级阻塞项。',
            '评审报告可继续回流为 AI 写作整改任务。',
          ]
        : [
            '检查收口后继续跑 AI 评审，补齐提交前决策层信息。',
            '评审结果会沉淀维度分数、结论、阻塞项和下一轮动作。',
            '编辑建议模式已并入评审底座，作为同类结果的不同观察视角。',
          ],
      primaryAction: { label: '进入评审中心', path: '/apps/stigpt/review' },
      secondaryAction: { label: '查看编辑建议', path: '/apps/stigpt/inspect' },
    },
  ];
};

const buildRecentTasks = (
  writeResult: AiWriteListResult | null,
  checkResult: AICheckListResult | null,
  reviewResult: AIReviewListResult | null,
): RecentTask[] => {
  const writeTasks: RecentTask[] =
    writeResult?.records.slice(0, 3).map((record) => ({
      key: `write-${record.id}`,
      title: record.title,
      stage: record.nextActionLabel || record.stageLabel || '继续写作',
      time: formatDateTime(record.updatedAt),
      statusColor: record.statusColor || 'processing',
      path: getAiWriteTaskPath(record),
      description: `${record.typeLabel || '写作'} · ${record.wordCount > 0 ? `${record.wordCount} 字` : '未生成正文'}`,
      updatedAt: record.updatedAt,
    })) || [];

  const checkTasks: RecentTask[] =
    checkResult?.items.slice(0, 3).map((record) => ({
      key: `check-${record.id}`,
      title: record.fileName,
      stage: record.riskLabel || '待判断',
      time: formatDateTime(record.updatedAt),
      statusColor: record.riskColor || record.statusColor || 'processing',
      path: `/apps/stigpt/check?taskId=${record.id}&taskType=${record.type}`,
      description: `${record.triageLabel || '检查'} · 待复核 ${record.needsReviewParagraphs} 处`,
      updatedAt: record.updatedAt,
    })) || [];

  const reviewTasks: RecentTask[] =
    reviewResult?.items.slice(0, 3).map((record) => ({
      key: `review-${record.id}`,
      title: record.fileName,
      stage: record.needsAttention ? '优先关注' : record.statusLabel || '评审结果',
      time: formatDateTime(record.updatedAt),
      statusColor: record.needsAttention ? 'warning' : record.statusColor || 'processing',
      path: `/apps/stigpt/review?taskId=${record.id}&taskType=${record.type}`,
      description: `${typeof record.overallScore === 'number' ? `${Math.round(record.overallScore)} 分` : record.statusLabel} · ${record.typeLabel}`,
      updatedAt: record.updatedAt,
    })) || [];

  return [...writeTasks, ...checkTasks, ...reviewTasks]
    .sort((left, right) => dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf())
    .slice(0, 6);
};

const buildReadinessModel = (
  writeResult: AiWriteListResult | null,
  checkResult: AICheckListResult | null,
  reviewResult: AIReviewListResult | null,
): ReadinessModel => {
  const writeSummary = writeResult?.summary;
  const checkSummary = checkResult?.summary;
  const reviewSummary = reviewResult?.summary;

  if (!writeSummary?.total && !checkSummary?.total && !reviewSummary?.total) {
    return {
      score: 12,
      tone: 'info',
      label: '先建立第一条主链路',
      description:
        '当前还没有真实任务记录。建议先从 AI 写作或 AI 问答进入，再逐步补齐检查与评审。',
      nextLabel: '新建项目写作',
      nextPath: '/apps/stigpt/write/detail',
      actions: [
        '先建立项目申请或期刊论文写作记录。',
        '形成正文后补跑 AI 检查，不要把风险留到最后。',
        '检查收口后再进入 AI 评审，形成提交前决策依据。',
      ],
    };
  }

  let score = 100;
  score -= Math.min(30, (writeSummary?.actionable || 0) * 6 + (writeSummary?.failed || 0) * 10);
  score -= Math.min(35, (checkSummary?.highRisk || 0) * 14 + Math.ceil((checkSummary?.needsReview || 0) / 2) * 4);
  score -= Math.min(30, (reviewSummary?.rejected || 0) * 15 + (reviewSummary?.revision || 0) * 8);
  const boundedScore = Math.max(10, Math.min(100, score));

  if ((checkSummary?.highRisk || 0) > 0) {
    return {
      score: boundedScore,
      tone: 'error',
      label: '先处理检查风险',
      description: '检查链路存在高风险记录，应该先整改相似度、低置信命中或合规问题。',
      nextLabel: '进入 AI 检查',
      nextPath: '/apps/stigpt/check',
      actions: [
        '优先处理高风险和待复核段落。',
        '把整改建议回流到 AI 写作页面生成修订稿。',
        '整改完成后再跑 AI 评审。',
      ],
    };
  }

  if ((reviewSummary?.attention || 0) > 0) {
    return {
      score: boundedScore,
      tone: 'warning',
      label: '评审意见待收口',
      description: '评审链路仍有需要关注的结论，建议先处理阻塞项再进入最终提交。',
      nextLabel: '进入 AI 评审',
      nextPath: '/apps/stigpt/review',
      actions: [
        '先看低分维度、关键风险和下一步动作。',
        '把评审建议转成可执行写作任务。',
        '复核修改后再进入提交前检查。',
      ],
    };
  }

  if ((writeSummary?.actionable || 0) > 0) {
    return {
      score: boundedScore,
      tone: 'info',
      label: '写作链路可继续推进',
      description: '写作链路还有可推进记录，建议继续补齐提纲、章节或全文润色。',
      nextLabel: '继续 AI 写作',
      nextPath: '/apps/stigpt/write',
      actions: [
        '补齐未完成章节和全文润色。',
        '把检查和评审意见回填到修订稿。',
        '保持每次修改都有来源与原因。',
      ],
    };
  }

  return {
    score: boundedScore,
    tone: 'success',
    label: '可进入提交准备',
    description: '当前主链路风险相对收口，可以进入最终人工核验和材料归档。',
    nextLabel: '查看 AI 问答',
    nextPath: '/apps/stigpt/webIdx',
    actions: [
      '人工复核政策、引用和关键结论。',
      '归档最终稿、检查报告和评审意见。',
      '把成果关系沉淀到知识图谱。',
    ],
  };
};

const buildFlowSteps = (
  writeResult: AiWriteListResult | null,
  checkResult: AICheckListResult | null,
  reviewResult: AIReviewListResult | null,
) => [
  {
    key: 'ask',
    index: '01',
    title: '先用 AI 问答澄清问题',
    description: '围绕政策、论文、项目设想和知识库资料形成第一轮判断。',
    path: '/apps/stigpt/webIdx',
    status: '可随时开始',
    color: 'processing',
  },
  {
    key: 'write',
    index: '02',
    title: '进入 AI 写作形成正文',
    description: writeResult?.summary.total
      ? `已有 ${writeResult.summary.total} 条写作记录，${writeResult.summary.actionable} 条可继续推进。`
      : '当前还没有写作记录，建议先建立第一条主线稿件。',
    path: '/apps/stigpt/write',
    status: writeResult?.summary.total ? '已接通' : '待开始',
    color: writeResult?.summary.total ? 'processing' : 'default',
  },
  {
    key: 'check',
    index: '03',
    title: '提交前做 AI 检查',
    description: checkResult?.summary.total
      ? `当前高风险 ${checkResult.summary.highRisk} 条，待复核 ${checkResult.summary.needsReview} 处。`
      : '正文形成后尽快做检查，不要把相似度风险留到最后。',
    path: '/apps/stigpt/check',
    status: (checkResult?.summary.highRisk || 0) > 0 ? '先整改' : checkResult?.summary.total ? '已接通' : '待开始',
    color: (checkResult?.summary.highRisk || 0) > 0 ? 'error' : checkResult?.summary.total ? 'processing' : 'default',
  },
  {
    key: 'review',
    index: '04',
    title: '最后跑 AI 评审',
    description: reviewResult?.summary.total
      ? `当前优先关注 ${reviewResult.summary.attention} 条，修改后可投 ${reviewResult.summary.revision} 条。`
      : '检查收口后继续跑评审，补齐提交前决策层信息。',
    path: '/apps/stigpt/review',
    status: (reviewResult?.summary.attention || 0) > 0 ? '需处理' : reviewResult?.summary.total ? '已接通' : '待开始',
    color: (reviewResult?.summary.attention || 0) > 0 ? 'warning' : reviewResult?.summary.total ? 'processing' : 'default',
  },
];

const buildGraphNodes = (
  writeResult: AiWriteListResult | null,
  checkResult: AICheckListResult | null,
  reviewResult: AIReviewListResult | null,
) => [
  {
    title: '项目 / 论文',
    value: `${(writeResult?.summary.total || 0) + (reviewResult?.summary.total || 0)} 个对象`,
    description: '写作任务、评审任务和材料主体作为图谱核心节点。',
  },
  {
    title: '风险与建议',
    value: `${(checkResult?.summary.attention || 0) + (reviewResult?.summary.attention || 0)} 条线索`,
    description: '检查风险、评审意见和整改动作作为可追踪关系边。',
  },
  {
    title: '知识来源',
    value: '政策 / 文献 / 成果',
    description: '问答引用、检查来源和阅读材料沉淀为后续检索入口。',
  },
];

const AIHubPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [writeResult, setWriteResult] = useState<AiWriteListResult | null>(null);
  const [checkResult, setCheckResult] = useState<AICheckListResult | null>(null);
  const [reviewResult, setReviewResult] = useState<AIReviewListResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const [writeSettled, checkSettled, reviewSettled] = await Promise.allSettled([
        aiWriteService.listRecords({ pageNo: 1, pageSize: 6 }),
        aiCheckService.listRecords({ busType: 'all', pageNo: 1, pageSize: 6, focus: 'all' }),
        aiReviewService.listRecords(),
      ]);

      if (cancelled) {
        return;
      }

      const nextErrors: string[] = [];
      const nextWrite =
        writeSettled.status === 'fulfilled'
          ? writeSettled.value
          : (nextErrors.push('加载 AI 写作摘要失败。'), null);
      const nextCheck =
        checkSettled.status === 'fulfilled'
          ? checkSettled.value
          : (nextErrors.push('加载 AI 检查摘要失败。'), null);
      const nextReview =
        reviewSettled.status === 'fulfilled'
          ? reviewSettled.value
          : (nextErrors.push('加载 AI 评审摘要失败。'), null);

      startTransition(() => {
        setWriteResult(nextWrite);
        setCheckResult(nextCheck);
        setReviewResult(nextReview);
        setErrors(nextErrors);
        setLoading(false);
      });
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const sourceStates = useMemo(
    () => buildSourceStates(loading, writeResult, checkResult, reviewResult, errors),
    [checkResult, errors, loading, reviewResult, writeResult],
  );
  const workflowCards = useMemo(
    () => buildWorkflowCards(writeResult, checkResult, reviewResult),
    [checkResult, reviewResult, writeResult],
  );
  const recentTasks = useMemo(
    () => buildRecentTasks(writeResult, checkResult, reviewResult),
    [checkResult, reviewResult, writeResult],
  );
  const readiness = useMemo(
    () => buildReadinessModel(writeResult, checkResult, reviewResult),
    [checkResult, reviewResult, writeResult],
  );
  const flowSteps = useMemo(
    () => buildFlowSteps(writeResult, checkResult, reviewResult),
    [checkResult, reviewResult, writeResult],
  );
  const graphNodes = useMemo(
    () => buildGraphNodes(writeResult, checkResult, reviewResult),
    [checkResult, reviewResult, writeResult],
  );

  return (
    <div className="ai-hub-page">
      <aside className="ai-hub-sidebar">
        <Card className="ai-hub-panel ai-hub-sidebar-panel" variant="borderless">
          <div className="ai-hub-sidebar-title">科研之友 AI</div>
          <div className="ai-hub-sidebar-subtitle">
            这里把写作、检查、评审、问答和知识图谱组织成同一个科研工作台。
          </div>

          <div className="ai-hub-sidebar-section-label">主工作流</div>
          <div className="ai-hub-sidebar-list">
            {primarySidebarItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`ai-hub-sidebar-item ${item.primary ? 'is-primary' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <div className="ai-hub-sidebar-item-title">{item.title}</div>
                <div className="ai-hub-sidebar-item-description">{item.description}</div>
              </button>
            ))}
          </div>

          <div className="ai-hub-sidebar-section-label ai-hub-sidebar-section-label-secondary">
            扩展能力
          </div>
          <div className="ai-hub-sidebar-compact-list">
            {extensionTools.map((item) => (
              <button
                key={item.key}
                type="button"
                className="ai-hub-compact-item"
                onClick={() => navigate(item.path)}
              >
                <span className="ai-hub-compact-item-icon">{item.icon}</span>
                <span className="ai-hub-compact-item-copy">
                  <span className="ai-hub-compact-item-title">{item.title}</span>
                  <span className="ai-hub-compact-item-description">{item.description}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      </aside>

      <section className="ai-hub-main">
        <Card className="ai-hub-panel ai-hub-hero" variant="borderless">
          <div className="ai-hub-hero-copy">
            <Tag className="ai-hub-hero-tag" bordered={false}>
              真实任务工作台
            </Tag>
            <h1>围绕写作、检查、评审组织你的科研 AI 主链路</h1>
            <p>
              这里展示三条真实业务线的实时摘要。你可以直接看到哪些任务正在推进、
              哪些风险还没有收口，以及下一步应该先写作、检查还是评审。
            </p>
            <div className="ai-hub-hero-actions">
              <Button type="primary" size="large" onClick={() => navigate(readiness.nextPath)}>
                {readiness.nextLabel}
              </Button>
              <Button size="large" onClick={() => navigate('/apps/stigpt/webIdx')}>
                <RobotOutlined />
                <span>先去 AI 问答</span>
              </Button>
            </div>

            <div className="ai-hub-source-strip">
              {sourceStates.map((item) => (
                <div key={item.key} className="ai-hub-source-chip">
                  <Space wrap size={[8, 8]}>
                    <Text strong>{item.label}</Text>
                    <Tag
                      color={
                        item.status === 'ready'
                          ? 'success'
                          : item.status === 'warning'
                            ? 'warning'
                            : item.status === 'error'
                              ? 'error'
                              : 'processing'
                      }
                    >
                      {item.status === 'ready'
                        ? '已接通'
                        : item.status === 'warning'
                          ? '部分可用'
                          : item.status === 'error'
                            ? '加载失败'
                            : '加载中'}
                    </Tag>
                  </Space>
                  <div className="ai-hub-source-chip-note">{item.note}</div>
                  <div className="ai-hub-source-chip-count">{item.countLabel}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="ai-hub-hero-summary">
            <div className="ai-hub-summary-card">
              <div className="ai-hub-summary-value">{writeResult?.summary.active || 0}</div>
              <div className="ai-hub-summary-label">AI 写作进行中记录</div>
              <div className="ai-hub-summary-note">
                待继续推进 {writeResult?.summary.actionable || 0} 条
              </div>
            </div>
            <div className="ai-hub-summary-card">
              <div className="ai-hub-summary-value">{checkResult?.summary.attention || 0}</div>
              <div className="ai-hub-summary-label">AI 检查需关注记录</div>
              <div className="ai-hub-summary-note">
                高风险 {checkResult?.summary.highRisk || 0} 条
              </div>
            </div>
            <div className="ai-hub-summary-card">
              <div className="ai-hub-summary-value">{reviewResult?.summary.attention || 0}</div>
              <div className="ai-hub-summary-label">AI 评审需处理结果</div>
              <div className="ai-hub-summary-note">
                修改后可投 {reviewResult?.summary.revision || 0} 条
              </div>
            </div>
          </div>
        </Card>

        {errors.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            message="部分工作台摘要未加载成功"
            description={errors.join('；')}
          />
        ) : null}

        <div className="ai-hub-section-head">
          <div>
            <h2>主工作流</h2>
            <p>每条入口都展示实时摘要、当前状态和下一步动作，而不只是静态说明。</p>
          </div>
        </div>

        {loading ? (
          <Card className="ai-hub-panel" variant="borderless">
            <div className="ai-hub-loading-wrap">
              <Spin size="large" />
              <div className="ai-hub-loading-text">正在汇总 AI 工作台数据...</div>
            </div>
          </Card>
        ) : (
          <div className="ai-hub-workflow-stack">
            {workflowCards.map((item) => (
              <Card key={item.key} className="ai-hub-panel ai-hub-workflow-card" variant="borderless">
                <div className="ai-hub-workflow-head">
                  <div className="ai-hub-workflow-brand">
                    <div className="ai-hub-workflow-icon">{item.icon}</div>
                    <div>
                      <div className="ai-hub-workflow-title-row">
                        <div className="ai-hub-workflow-title">{item.title}</div>
                        <Tag color={item.statusColor}>{item.statusLabel}</Tag>
                      </div>
                      <div className="ai-hub-workflow-subtitle">{item.subtitle}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="ai-hub-workflow-link"
                    onClick={() => navigate(item.path)}
                  >
                    <span>进入记录中心</span>
                    <RightOutlined />
                  </button>
                </div>

                <div className="ai-hub-workflow-description">{item.description}</div>

                <div className="ai-hub-workflow-tags">
                  {item.categories.map((category) => (
                    <Tag key={category} bordered={false} className="ai-hub-workflow-tag">
                      {category}
                    </Tag>
                  ))}
                </div>

                <div className="ai-hub-workflow-stats">
                  {item.stats.map((stat) => (
                    <div key={stat.label} className="ai-hub-workflow-stat">
                      <div className="ai-hub-workflow-stat-value">{stat.value}</div>
                      <div className="ai-hub-workflow-stat-label">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="ai-hub-workflow-highlights">
                  {item.highlights.map((highlight) => (
                    <div key={highlight} className="ai-hub-workflow-highlight">
                      <span className="ai-hub-workflow-highlight-dot" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>

                <div className="ai-hub-workflow-actions">
                  <Button type="primary" onClick={() => navigate(item.primaryAction.path)}>
                    {item.primaryAction.label}
                  </Button>
                  {item.secondaryAction ? (
                    <Button onClick={() => navigate(item.secondaryAction.path)}>
                      {item.secondaryAction.label}
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="ai-hub-panel ai-hub-extension-panel" variant="borderless">
          <div className="ai-hub-block-title">扩展能力</div>
          <div className="ai-hub-extension-grid">
            {extensionTools.map((tool) => (
              <button
                key={tool.key}
                type="button"
                className="ai-hub-extension-card"
                onClick={() => navigate(tool.path)}
              >
                <div className="ai-hub-extension-icon">{tool.icon}</div>
                <div className="ai-hub-extension-copy">
                  <div className="ai-hub-extension-title">{tool.title}</div>
                  <div className="ai-hub-extension-description">{tool.description}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="ai-hub-panel ai-hub-extension-panel" variant="borderless">
          <div className="ai-hub-block-title">知识图谱视角</div>
          <div className="ai-hub-extension-grid">
            {graphNodes.map((node) => (
              <div key={node.title} className="ai-hub-extension-card">
                <div className="ai-hub-extension-icon">
                  <ApartmentOutlined />
                </div>
                <div className="ai-hub-extension-copy">
                  <div className="ai-hub-extension-title">{node.title}</div>
                  <div className="ai-hub-summary-value">{node.value}</div>
                  <div className="ai-hub-extension-description">{node.description}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <aside className="ai-hub-right">
        <Card className="ai-hub-panel ai-hub-right-panel" variant="borderless">
          <div className="ai-hub-block-title">提交前准备度</div>
          <div className="ai-hub-readiness-value">{readiness.score}%</div>
          <div className="ai-hub-readiness-meta">
            <Tag
              color={
                readiness.tone === 'success'
                  ? 'success'
                  : readiness.tone === 'warning'
                    ? 'warning'
                    : readiness.tone === 'error'
                      ? 'error'
                      : 'processing'
              }
            >
              {readiness.label}
            </Tag>
          </div>
          <Progress
            percent={readiness.score}
            showInfo={false}
            strokeColor={
              readiness.tone === 'success'
                ? '#52c41a'
                : readiness.tone === 'warning'
                  ? '#faad14'
                  : readiness.tone === 'error'
                    ? '#ff4d4f'
                    : '#1677ff'
            }
            style={{ marginTop: 12 }}
          />
          <Paragraph style={{ margin: '12px 0 0', color: '#5f6f7d' }}>
            {readiness.description}
          </Paragraph>
          <div className="ai-hub-bullet-list">
            {readiness.actions.map((item) => (
              <div key={item} className="ai-hub-bullet-item">
                <span className="ai-hub-bullet-dot" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <Button type="primary" block style={{ marginTop: 14 }} onClick={() => navigate(readiness.nextPath)}>
            {readiness.nextLabel}
          </Button>
        </Card>

        <Card className="ai-hub-panel ai-hub-right-panel" variant="borderless">
          <div className="ai-hub-block-title">最近任务</div>
          {recentTasks.length > 0 ? (
            <div className="ai-hub-task-list">
              {recentTasks.map((task) => (
                <button
                  key={task.key}
                  type="button"
                  className="ai-hub-task-item"
                  onClick={() => navigate(task.path)}
                >
                  <div className="ai-hub-task-top">
                    <div className="ai-hub-task-title">{task.title}</div>
                    <Tag color={task.statusColor}>{task.stage}</Tag>
                  </div>
                  <div className="ai-hub-task-description">{task.description}</div>
                  <div className="ai-hub-task-meta">
                    <ClockCircleOutlined />
                    <span>{task.time}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="ai-hub-state-empty">
              当前还没有可展示的任务记录，先从 AI 写作或 AI 问答开始。
            </div>
          )}
        </Card>

        <Card className="ai-hub-panel ai-hub-right-panel" variant="borderless">
          <div className="ai-hub-block-title">推荐链路</div>
          <div className="ai-hub-process-list">
            {flowSteps.map((step) => (
              <button
                key={step.key}
                type="button"
                className="ai-hub-task-item"
                onClick={() => navigate(step.path)}
              >
                <div className="ai-hub-process-item">
                  <span className="ai-hub-process-index">{step.index}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="ai-hub-task-top">
                      <div className="ai-hub-process-title">{step.title}</div>
                      <Tag color={step.color}>{step.status}</Tag>
                    </div>
                    <div className="ai-hub-process-description">{step.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="ai-hub-panel ai-hub-right-panel" variant="borderless">
          <div className="ai-hub-block-title">快捷开始</div>
          <div className="ai-hub-quick-actions">
            <Button block onClick={() => navigate('/apps/stigpt/write/detail')}>
              新建项目写作
            </Button>
            <Button block onClick={() => navigate('/apps/stigpt/write/detail/essay')}>
              新建论文写作
            </Button>
            <Button block onClick={() => navigate('/apps/stigpt/check')}>
              上传检查文件
            </Button>
            <Button block onClick={() => navigate('/apps/stigpt/review')}>
              上传评审文件
            </Button>
          </div>
        </Card>
      </aside>
    </div>
  );
};

export default AIHubPage;
