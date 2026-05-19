import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Progress,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  BgColorsOutlined,
  CopyOutlined,
  DownloadOutlined,
  FileTextOutlined,
  LinkOutlined,
  ReloadOutlined,
  SaveOutlined,
  SendOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AiWriteContextPayload, AiWriteRecordDetail, AiWriteRecordKind } from '../../types/ai-write';
import { aiWriteService, getAiWriteErrorMessage } from '../../services/ai-write.service';
import {
  clearPendingAiWriteSeed,
  getAiWriteSeedSourceLabel,
  readPendingAiWriteSeed,
  type PendingAiWriteSeed,
} from '../../utils/aiWriteBridge';
import '../AIWrite/index.css';
import './index.css';

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

type WizardStepKey =
  | 'basic'
  | 'journal'
  | 'collaborators'
  | 'title'
  | 'summary'
  | 'keywords'
  | 'references'
  | 'outline';

type WizardStep = {
  key: WizardStepKey;
  label: string;
  sectionTitle: string;
  description: string;
};

type WizardFormValues = {
  fundingAgency?: string;
  projectCategory?: string;
  journalTarget?: string;
  journalRequirements?: string;
  researchField?: string;
  backgroundKeywords?: string[];
  backgroundInnovation?: string[];
  backgroundDescription?: string;
  methodKeywords?: string[];
  methodInnovation?: string[];
  methodDescription?: string;
  collaboratorSuggestions?: string;
  title?: string;
  summary?: string;
  coreKeywords?: string[];
  references?: string;
  kbId?: string;
};

type BriefField = {
  label: string;
  value: string | string[];
  tone?: 'text' | 'multiline';
};

type BriefSection = {
  title: string;
  fields: BriefField[];
};

const MARKDOWN_PLUGINS = [remarkGfm];

const PROJECT_STEPS: WizardStep[] = [
  {
    key: 'basic',
    label: '基本条件',
    sectionTitle: '基本信息',
    description: '设定好下方的基本信息后点击开始写作，科研之友 AI 将据此生成项目申请写作框架。',
  },
  {
    key: 'collaborators',
    label: '推荐合作者',
    sectionTitle: '合作团队',
    description: '补充合作者画像、分工方向或希望推荐的专家类型。',
  },
  {
    key: 'title',
    label: '项目标题',
    sectionTitle: '标题设计',
    description: '整理项目题目与命名方向，确保标题能够准确承载问题与创新。',
  },
  {
    key: 'summary',
    label: '项目摘要',
    sectionTitle: '摘要草拟',
    description: '先写清楚项目摘要主线，后续提纲与章节会更稳定。',
  },
  {
    key: 'keywords',
    label: '核心关键词',
    sectionTitle: '关键词设置',
    description: '提炼项目核心概念、方法标签和应用场景。',
  },
  {
    key: 'references',
    label: '参考文献',
    sectionTitle: '参考依据',
    description: '整理项目申请中会引用的文献、政策或前期基础信息。',
  },
  {
    key: 'outline',
    label: '生成大纲',
    sectionTitle: '提纲与正文',
    description: '在这里生成提纲、逐节写作并完成全文润色。',
  },
];

const PAPER_STEPS: WizardStep[] = [
  {
    key: 'basic',
    label: '基本条件',
    sectionTitle: '论文基础',
    description: '先交代研究方向、问题背景和方法思路，系统会据此进入论文写作链路。',
  },
  {
    key: 'journal',
    label: '期刊选择',
    sectionTitle: '期刊目标',
    description: '补充目标期刊及其风格要求，让后续提纲和写法更贴近真实投稿场景。',
  },
  {
    key: 'collaborators',
    label: '推荐合作者',
    sectionTitle: '作者协作',
    description: '补充作者分工、需要推荐的合作方向或潜在通讯作者角色。',
  },
  {
    key: 'title',
    label: '论文标题',
    sectionTitle: '标题设计',
    description: '明确题目与贡献主张，避免标题过空或偏宣传化。',
  },
  {
    key: 'summary',
    label: '论文摘要',
    sectionTitle: '摘要草拟',
    description: '摘要将直接影响后续提纲和正文生成的聚焦度。',
  },
  {
    key: 'keywords',
    label: '核心关键词',
    sectionTitle: '关键词设置',
    description: '补足方法、任务、数据和评价相关关键词。',
  },
  {
    key: 'references',
    label: '参考文献',
    sectionTitle: '参考依据',
    description: '记录关键引用、基线工作和相关背景文献。',
  },
  {
    key: 'outline',
    label: '生成提纲',
    sectionTitle: '提纲与正文',
    description: '在这里生成提纲、逐节撰写并合并全文。',
  },
];

const PROJECT_FUNDING_OPTIONS = [
  '国家自然科学基金',
  '国家社会科学基金',
  '教育部人文社科',
  '省部级基金',
  '重点研发计划',
  '企业合作项目',
].map((value) => ({ label: value, value }));

const PROJECT_CATEGORY_OPTIONS = [
  '面上项目',
  '青年项目',
  '重点项目',
  '一般项目',
  '横向课题',
].map((value) => ({ label: value, value }));

const resolveKind = (
  pathname: string,
  searchParams: URLSearchParams,
): AiWriteRecordKind => {
  if (pathname.includes('/essay')) {
    return 'paper';
  }

  const kind = searchParams.get('kind');
  if (kind === 'paper' || kind === 'project') {
    return kind;
  }

  return searchParams.get('type') === '2' ? 'paper' : 'project';
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

const buildFallbackTitle = (kind: AiWriteRecordKind, values: WizardFormValues): string => {
  const field = values.researchField?.trim();
  const journal = values.journalTarget?.trim();
  const fundingAgency = values.fundingAgency?.trim();

  if (kind === 'paper') {
    if (journal && field) {
      return `${field}面向${journal}投稿的论文草稿`;
    }
    return `${field || '期刊论文'}写作草稿`;
  }

  if (fundingAgency && field) {
    return `${fundingAgency}${field}项目申请草稿`;
  }

  return `${field || '科研项目'}申请草稿`;
};

const defaultFormValues = (): WizardFormValues => ({
  fundingAgency: undefined,
  projectCategory: undefined,
  journalTarget: '',
  journalRequirements: '',
  researchField: '',
  backgroundKeywords: [],
  backgroundInnovation: [],
  backgroundDescription: '',
  methodKeywords: [],
  methodInnovation: [],
  methodDescription: '',
  collaboratorSuggestions: '',
  title: '',
  summary: '',
  coreKeywords: [],
  references: '',
  kbId: '',
});

const readText = (value?: string | null): string => value?.trim() || '';

const clipText = (value?: string | null, maxLength = 140): string => {
  const text = readText(value);
  if (!text) {
    return '';
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return '尚未保存';
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return '尚未保存';
  }

  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const buildReferenceItems = (value?: string): string[] =>
  readText(value)
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);

const resolveDependencyStateLabel = (state?: string): string => {
  switch (state) {
    case 'ready':
      return '可用';
    case 'not_requested':
      return '未启用';
    case 'missing_config':
      return '未配置';
    case 'unauthorized':
      return '无权限';
    case 'rate_limited':
      return '限流中';
    case 'timeout':
      return '超时';
    case 'empty':
      return '无结果';
    case 'unavailable':
    default:
      return '不可用';
  }
};

const resolveExecutionStageLabel = (stage?: string): string => {
  if (!stage) {
    return '未知阶段';
  }

  if (stage === 'generate-outline') {
    return '生成提纲';
  }

  if (stage === 'polish') {
    return '全文润色';
  }

  if (stage.startsWith('generate-section-')) {
    const index = Number.parseInt(stage.replace('generate-section-', ''), 10);
    return Number.isFinite(index) ? `生成第 ${index} 节` : '生成章节';
  }

  return stage;
};

const buildExecutionFacts = (record: AiWriteRecordDetail): Array<{ label: string; value: string }> => {
  const execution = record.executionMeta;
  if (!execution) {
    return [];
  }

  const context = (record.context || {}) as Record<string, unknown>;
  const facts: Array<{ label: string; value: string }> = [
    { label: '最近阶段', value: resolveExecutionStageLabel(execution.lastStage) },
    { label: '生成模式', value: record.generationModeLabel },
    {
      label: '大模型',
      value: `${resolveDependencyStateLabel(execution.llm.state)} · ${execution.llm.model || execution.llm.provider || execution.llm.message}`,
    },
    {
      label: '知识库',
      value: `${resolveDependencyStateLabel(execution.knowledge.state)} · ${execution.knowledge.kbId || execution.knowledge.message}`,
    },
  ];

  if (typeof context.bridgeSource === 'string') {
    facts.push({
      label: '回流来源',
      value: getAiWriteSeedSourceLabel(context.bridgeSource as PendingAiWriteSeed['source']),
    });
  }

  if (typeof context.bridgeSourceTitle === 'string' && readText(context.bridgeSourceTitle)) {
    facts.push({
      label: '来源标题',
      value: readText(context.bridgeSourceTitle),
    });
  }

  return facts;
};

const buildSourceReportPath = (context?: Record<string, unknown> | null): string | null => {
  if (!context) {
    return null;
  }

  const source = context.bridgeSource;
  const recordId =
    typeof context.bridgeSourceRecordId === 'string' ? context.bridgeSourceRecordId.trim() : '';
  const taskType =
    typeof context.bridgeSourceTaskType === 'string' ? context.bridgeSourceTaskType.trim() : '';

  if (!recordId) {
    return null;
  }

  if (source === 'ai-check') {
    const search = new URLSearchParams({ taskId: recordId });
    if (taskType) {
      search.set('taskType', taskType);
    }
    return `/apps/stigpt/check?${search.toString()}`;
  }

  if (source === 'ai-review') {
    const search = new URLSearchParams({ taskId: recordId });
    if (taskType) {
      search.set('taskType', taskType);
    }
    return `/apps/stigpt/review?${search.toString()}`;
  }

  return null;
};

const buildBriefSections = (
  kind: AiWriteRecordKind,
  values: WizardFormValues,
): BriefSection[] => {
  const sections: BriefSection[] = [];
  const basicFields: BriefField[] = [];

  if (kind === 'project' && readText(values.fundingAgency)) {
    basicFields.push({ label: '资助机构', value: readText(values.fundingAgency) });
  }

  if (kind === 'project' && readText(values.projectCategory)) {
    basicFields.push({ label: '项目类型', value: readText(values.projectCategory) });
  }

  if (kind === 'paper' && readText(values.journalTarget)) {
    basicFields.push({ label: '目标期刊', value: readText(values.journalTarget) });
  }

  if (kind === 'paper' && readText(values.journalRequirements)) {
    basicFields.push({
      label: '投稿要求',
      value: clipText(values.journalRequirements, 120),
      tone: 'multiline',
    });
  }

  if (readText(values.researchField)) {
    basicFields.push({ label: '学科分类', value: readText(values.researchField) });
  }

  if (readText(values.kbId)) {
    basicFields.push({ label: '知识库编号', value: readText(values.kbId) });
  }

  if (basicFields.length > 0) {
    sections.push({ title: '基本条件', fields: basicFields });
  }

  const backgroundFields: BriefField[] = [];

  if ((values.backgroundKeywords || []).length > 0) {
    backgroundFields.push({ label: '问题关键词', value: normalizeTagValues(values.backgroundKeywords) });
  }

  if ((values.backgroundInnovation || []).length > 0) {
    backgroundFields.push({ label: '背景创新', value: normalizeTagValues(values.backgroundInnovation) });
  }

  if (readText(values.backgroundDescription)) {
    backgroundFields.push({
      label: '背景说明',
      value: clipText(values.backgroundDescription, 150),
      tone: 'multiline',
    });
  }

  if (backgroundFields.length > 0) {
    sections.push({ title: '问题与背景', fields: backgroundFields });
  }

  const methodFields: BriefField[] = [];

  if ((values.methodKeywords || []).length > 0) {
    methodFields.push({ label: '方法关键词', value: normalizeTagValues(values.methodKeywords) });
  }

  if ((values.methodInnovation || []).length > 0) {
    methodFields.push({ label: '方法创新', value: normalizeTagValues(values.methodInnovation) });
  }

  if (readText(values.methodDescription)) {
    methodFields.push({
      label: '方法说明',
      value: clipText(values.methodDescription, 150),
      tone: 'multiline',
    });
  }

  if (methodFields.length > 0) {
    sections.push({ title: '方法与路径', fields: methodFields });
  }

  const outputFields: BriefField[] = [];

  if (readText(values.title)) {
    outputFields.push({ label: '工作标题', value: readText(values.title) });
  }

  if (readText(values.summary)) {
    outputFields.push({
      label: kind === 'paper' ? '摘要草稿' : '项目摘要',
      value: clipText(values.summary, 150),
      tone: 'multiline',
    });
  }

  if ((values.coreKeywords || []).length > 0) {
    outputFields.push({ label: '核心关键词', value: normalizeTagValues(values.coreKeywords, 8) });
  }

  if (readText(values.collaboratorSuggestions)) {
    outputFields.push({
      label: '合作建议',
      value: clipText(values.collaboratorSuggestions, 120),
      tone: 'multiline',
    });
  }

  if (outputFields.length > 0) {
    sections.push({ title: '写作输出', fields: outputFields });
  }

  return sections;
};

const buildOutlineMarkdown = (record: AiWriteRecordDetail): string => {
  const lines = [`# ${record.title}`, '', '## 写作提纲', ''];

  record.outline.forEach((section, index) => {
    lines.push(`### ${index + 1}. ${section.title}`);
    if (section.description?.trim()) {
      lines.push(section.description.trim());
    }
    if (section.minWords) {
      lines.push(`建议字数：${section.minWords} 字`);
    }
    lines.push('');
  });

  return lines.join('\n').trim();
};

const buildDraftMarkdown = (record: AiWriteRecordDetail): string => {
  if (readText(record.fullText)) {
    return readText(record.fullText);
  }

  const sections = record.sections.filter((section) => readText(section.content));
  if (sections.length === 0) {
    return '';
  }

  const lines = [`# ${record.title}`, ''];
  sections.forEach((section) => {
    lines.push(`## ${section.title}`);
    lines.push('');
    lines.push(readText(section.content));
    lines.push('');
  });

  return lines.join('\n').trim();
};

const stripMarkdownText = (value: string): string =>
  value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const buildExportFileName = (value?: string | null): string => {
  const sanitized = (value || 'stigpt-ai-write')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized || 'stigpt-ai-write';
};

const detailToFormValues = (record: AiWriteRecordDetail | null): WizardFormValues => {
  if (!record) {
    return defaultFormValues();
  }

  const context = (record.context || {}) as Record<string, unknown>;
  const tags = (key: string) => normalizeTagValues(context[key] as string[] | undefined);
  const text = (key: string) => (typeof context[key] === 'string' ? context[key] : '');

  return {
    fundingAgency: text('fundingAgency') || undefined,
    projectCategory: text('projectCategory') || undefined,
    journalTarget: text('journalTarget'),
    journalRequirements: text('journalRequirements'),
    researchField: text('researchField') || record.researchField || '',
    backgroundKeywords: tags('backgroundKeywords'),
    backgroundInnovation: tags('backgroundInnovation'),
    backgroundDescription: text('backgroundDescription'),
    methodKeywords: tags('methodKeywords'),
    methodInnovation: tags('methodInnovation'),
    methodDescription: text('methodDescription'),
    collaboratorSuggestions: text('collaboratorSuggestions'),
    title: text('title') || record.title,
    summary: text('summary'),
    coreKeywords: tags('coreKeywords').length > 0 ? tags('coreKeywords') : record.keywords,
    references: text('references'),
    kbId: text('kbId') || record.kbId || '',
  };
};

const seedToFormValues = (seed: PendingAiWriteSeed | null): WizardFormValues => {
  if (!seed) {
    return defaultFormValues();
  }

  return {
    ...defaultFormValues(),
    title: seed.draft.title || '',
    kbId: seed.draft.kbId || '',
    researchField: seed.draft.researchField || '',
    backgroundKeywords: seed.draft.backgroundKeywords || [],
    backgroundInnovation: seed.draft.backgroundInnovation || [],
    backgroundDescription: seed.draft.backgroundDescription || '',
    methodKeywords: seed.draft.methodKeywords || [],
    methodInnovation: seed.draft.methodInnovation || [],
    methodDescription: seed.draft.methodDescription || '',
    collaboratorSuggestions: seed.draft.collaboratorSuggestions || '',
    summary: seed.draft.summary || '',
    coreKeywords: seed.draft.coreKeywords || [],
    references: seed.draft.references || '',
  };
};

const AIWriteWizardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message } = App.useApp();
  const [form] = Form.useForm<WizardFormValues>();
  const liveValues = Form.useWatch([], form) as Partial<WizardFormValues> | undefined;

  const [record, setRecord] = useState<AiWriteRecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [polishLoading, setPolishLoading] = useState(false);
  const [fullDraftLoading, setFullDraftLoading] = useState(false);
  const [sectionLoadingMap, setSectionLoadingMap] = useState<Record<number, boolean>>({});
  const [currentStep, setCurrentStep] = useState<WizardStepKey>('basic');
  const [seedContext, setSeedContext] = useState<PendingAiWriteSeed | null>(null);

  const taskId = searchParams.get('taskId');
  const seedKey = searchParams.get('seedKey');
  const from = searchParams.get('from');
  const kind = resolveKind(location.pathname, searchParams);
  const steps = kind === 'paper' ? PAPER_STEPS : PROJECT_STEPS;
  const activeStep = steps.find((item) => item.key === currentStep) || steps[0];
  const stepIndex = steps.findIndex((item) => item.key === activeStep.key);
  const isOutlineStep = activeStep.key === 'outline';
  const sidebarTitle = kind === 'paper' ? '论文写作步骤' : '申请书起草步骤';
  const heroLabel = kind === 'paper' ? '论文' : '申请书';
  const previewValues = useMemo<WizardFormValues>(
    () => ({
      ...defaultFormValues(),
      ...detailToFormValues(record),
      ...(liveValues || {}),
    }),
    [liveValues, record],
  );
  const briefSections = useMemo(
    () => buildBriefSections(kind, previewValues),
    [kind, previewValues],
  );
  const referenceItems = useMemo(
    () => buildReferenceItems(previewValues.references),
    [previewValues.references],
  );
  const workingTitle = useMemo(
    () => readText(previewValues.title) || buildFallbackTitle(kind, previewValues),
    [kind, previewValues],
  );
  const outlineMarkdown = useMemo(
    () => (record ? buildOutlineMarkdown(record) : ''),
    [record],
  );
  const draftMarkdown = useMemo(
    () => (record ? buildDraftMarkdown(record) : ''),
    [record],
  );
  const draftPlainText = useMemo(
    () => stripMarkdownText(draftMarkdown),
    [draftMarkdown],
  );
  const suggestedSection =
    record && record.nextSectionIndex !== null ? record.outline[record.nextSectionIndex] : null;
  const executionFacts = useMemo(
    () => (record ? buildExecutionFacts(record) : []),
    [record],
  );
  const sourceReportPath = useMemo(() => {
    if (!record) {
      return null;
    }
    return buildSourceReportPath((record.context || {}) as Record<string, unknown>);
  }, [record]);

  useEffect(() => {
    let cancelled = false;

    const loadRecord = async () => {
      if (!taskId) {
        const seed = readPendingAiWriteSeed(seedKey);
        setSeedContext(seed);
        form.setFieldsValue(seedToFormValues(seed));
        setRecord(null);
        setCurrentStep('basic');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const detail = await aiWriteService.getRecord(taskId);
        if (cancelled) {
          return;
        }

        setRecord(detail);
        form.setFieldsValue(detailToFormValues(detail));
        setCurrentStep(detail.outlineCount > 0 || detail.hasFullText ? 'outline' : 'basic');
      } catch (error) {
        if (!cancelled) {
          message.error(getAiWriteErrorMessage(error, '加载写作详情失败。'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRecord();

    return () => {
      cancelled = true;
    };
  }, [form, message, seedKey, taskId]);

  useEffect(() => {
    if (!taskId || !record?.isActive || currentStep !== 'outline') {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void aiWriteService
        .getRecord(taskId)
        .then((detail) => {
          setRecord(detail);
          form.setFieldsValue(detailToFormValues(detail));
        })
        .catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [currentStep, form, record?.isActive, taskId]);

  const statusTag = useMemo(() => {
    if (!record) {
      return null;
    }

    return (
      <Tag color={record.statusColor} className="ai-write-wizard-top-tag">
        {record.statusLabel}
      </Tag>
    );
  }, [record]);

  const syncSearchParams = (nextTaskId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('taskId', nextTaskId);
    next.set('kind', kind);
    if (seedKey) {
      clearPendingAiWriteSeed(seedKey);
      next.delete('seedKey');
    }
    setSearchParams(next, { replace: true });
  };

  const refreshRecord = async (targetId = taskId) => {
    if (!targetId) {
      return null;
    }

    const detail = await aiWriteService.getRecord(targetId);
    setRecord(detail);
    form.setFieldsValue(detailToFormValues(detail));
    return detail;
  };

  const handleCopyContent = async (content: string, successMessage: string) => {
    if (!readText(content)) {
      message.warning('当前没有可复制的内容。');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      message.success(successMessage);
    } catch (error) {
      message.error(getAiWriteErrorMessage(error, '复制内容失败。'));
    }
  };

  const handleExportContent = (
    content: string,
    extension: 'md' | 'txt',
    successMessage: string,
  ) => {
    if (!readText(content)) {
      message.warning('当前没有可导出的内容。');
      return;
    }

    const fileName = `${buildExportFileName(record?.title)}.${extension}`;
    const blob = new Blob([content], {
      type:
        extension === 'txt'
          ? 'text/plain;charset=utf-8'
          : 'text/markdown;charset=utf-8',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    message.success(successMessage);
  };

  const buildRequestPayload = (values: WizardFormValues) => {
    const title = values.title?.trim() || buildFallbackTitle(kind, values);
    const researchField = values.researchField?.trim() || undefined;
    const backgroundKeywords = normalizeTagValues(values.backgroundKeywords, 5);
    const backgroundInnovation = normalizeTagValues(values.backgroundInnovation, 5);
    const methodKeywords = normalizeTagValues(values.methodKeywords, 5);
    const methodInnovation = normalizeTagValues(values.methodInnovation, 5);
    const coreKeywords = normalizeTagValues(values.coreKeywords, 8);
    const keywords = Array.from(
      new Set([...coreKeywords, ...backgroundKeywords, ...methodKeywords]),
    ).slice(0, 12);
    const kbId = values.kbId?.trim() || undefined;
    const bridgeContext = seedContext
      ? {
          bridgeSource: seedContext.source,
          bridgeSourceTitle: seedContext.sourceTitle,
          bridgeSourceRecordId: seedContext.sourceRecordId,
          bridgeReason: seedContext.reason,
        }
      : {};

    const context = compactContext({
      fundingAgency: values.fundingAgency,
      projectCategory: values.projectCategory,
      journalTarget: values.journalTarget,
      journalRequirements: values.journalRequirements,
      researchField,
      backgroundKeywords,
      backgroundInnovation,
      backgroundDescription: values.backgroundDescription,
      methodKeywords,
      methodInnovation,
      methodDescription: values.methodDescription,
      collaboratorSuggestions: values.collaboratorSuggestions,
      title,
      summary: values.summary,
      coreKeywords,
      references: values.references,
      kbId,
      ...bridgeContext,
    });

    return {
      title,
      researchField,
      keywords,
      kbId,
      context,
    };
  };

  const saveDraft = async (silent = false) => {
    const values = form.getFieldsValue(true) as WizardFormValues;
    const payload = buildRequestPayload(values);

    setSaving(true);
    try {
      const saved = taskId
        ? await aiWriteService.updateRecordProfile(taskId, payload)
        : await aiWriteService.createRecord({
            kind,
            ...payload,
          });

      setRecord(saved);
      form.setFieldsValue(detailToFormValues(saved));
      if (!taskId) {
        syncSearchParams(saved.id);
      }
      if (!silent) {
        message.success('写作资料已保存。');
      }
      return saved;
    } catch (error) {
      if (!silent) {
        message.error(getAiWriteErrorMessage(error, '保存写作资料失败。'));
      }
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateOutline = async () => {
    setOutlineLoading(true);
    try {
      const saved = await saveDraft(true);
      await aiWriteService.generateOutline(saved.id);
      const next = await refreshRecord(saved.id);
      if (next) {
        setCurrentStep('outline');
      }
      message.success(record?.hasOutline ? '提纲已重新生成。' : '提纲已生成。');
    } catch (error) {
      message.error(getAiWriteErrorMessage(error, '生成提纲失败。'));
    } finally {
      setOutlineLoading(false);
    }
  };

  const handleGenerateSection = async (sectionIndex: number) => {
    setSectionLoadingMap((current) => ({ ...current, [sectionIndex]: true }));
    try {
      const saved = await saveDraft(true);
      await aiWriteService.generateSection(saved.id, sectionIndex);
      await refreshRecord(saved.id);
      message.success(`第 ${sectionIndex + 1} 节已生成。`);
    } catch (error) {
      message.error(getAiWriteErrorMessage(error, '生成章节失败。'));
    } finally {
      setSectionLoadingMap((current) => ({
        ...current,
        [sectionIndex]: false,
      }));
    }
  };

  const handlePolish = async () => {
    setPolishLoading(true);
    try {
      const saved = await saveDraft(true);
      await aiWriteService.polishRecord(saved.id);
      await refreshRecord(saved.id);
      message.success('全文润色已完成。');
    } catch (error) {
      message.error(getAiWriteErrorMessage(error, '全文润色失败。'));
    } finally {
      setPolishLoading(false);
    }
  };

  const handleGenerateFullDraft = async () => {
    if (record?.isActive) {
      message.info('任务正在处理中，请等待当前任务结束后再继续。');
      return;
    }

    setFullDraftLoading(true);
    try {
      const saved = await saveDraft(true);
      let latest = (await refreshRecord(saved.id)) || saved;
      const maxSectionIterations = Math.max(latest.outlineCount || 0, 1) + 2;

      if (!latest.hasOutline) {
        await aiWriteService.generateOutline(saved.id);
        latest = (await refreshRecord(saved.id)) || latest;
        if (latest.isActive || latest.nextAction === 'wait') {
          message.info('提纲生成任务已提交，请稍后刷新后继续生成完整草稿。');
          return;
        }
      }

      let guard = 0;
      while (
        latest.nextAction === 'generate_next_section' &&
        latest.nextSectionIndex !== null &&
        guard < maxSectionIterations
      ) {
        await aiWriteService.generateSection(saved.id, latest.nextSectionIndex);
        latest = (await refreshRecord(saved.id)) || latest;
        guard += 1;
        if (latest.isActive || latest.nextAction === 'wait') {
          message.info('章节生成任务仍在处理中，请稍后刷新后继续。');
          return;
        }
      }

      if (
        latest.nextAction === 'generate_next_section' &&
        latest.nextSectionIndex !== null &&
        guard >= maxSectionIterations
      ) {
        message.warning('章节较多，本轮已批量推进到上限，请继续点击生成完整草稿完成后续章节。');
        return;
      }

      if (!latest.hasFullText || latest.nextAction === 'polish') {
        await aiWriteService.polishRecord(saved.id);
        latest = (await refreshRecord(saved.id)) || latest;
        if (latest.isActive || latest.nextAction === 'wait') {
          message.info('全文润色任务已提交，请稍后刷新查看结果。');
          return;
        }
      }

      if (!latest.hasFullText && !readText(latest.fullText)) {
        message.info('完整草稿生成任务已触发，但结果尚未就绪，请稍后刷新。');
        return;
      }

      message.success(
        latest.generationMode === 'fallback'
          ? '完整草稿已生成，但当前结果为降级草稿。'
          : latest.generationMode === 'mixed'
            ? '完整草稿已生成，部分步骤使用了混合生成。'
            : '完整草稿已生成。',
      );
    } catch (error) {
      message.error(getAiWriteErrorMessage(error, '生成完整草稿失败。'));
    } finally {
      setFullDraftLoading(false);
    }
  };

  const handleRecommendedAction = async () => {
    if (!record) {
      await saveDraft();
      return;
    }

    if (record.isActive) {
      message.info('任务正在处理中，请等待自动刷新或稍后手动刷新。');
      return;
    }

    if (record.nextAction === 'generate_next_section' && record.nextSectionIndex !== null) {
      await handleGenerateSection(record.nextSectionIndex);
      return;
    }

    if (record.nextAction === 'polish') {
      await handlePolish();
      return;
    }

    if (record.nextAction === 'view_result') {
      await handleCopyContent(
        draftMarkdown,
        record.hasFullText ? '全文结果已复制。' : '当前草稿已复制。',
      );
      return;
    }

    if (record.nextAction === 'generate_outline') {
      await handleGenerateOutline();
    }
  };

  const goBack = () => {
    if (from) {
      navigate(from);
      return;
    }

    navigate('/apps/stigpt/write');
  };

  const renderTagField = (
    name: keyof WizardFormValues,
    label: string,
    placeholder: string,
    limit = 5,
    extra?: string,
  ) => (
    <Form.Item
      label={label}
      name={name}
      extra={extra}
      rules={[
        {
          validator: (_, value: string[] | undefined) =>
            !value || value.length <= limit
              ? Promise.resolve()
              : Promise.reject(new Error(`最多填写 ${limit} 项。`)),
        },
      ]}
    >
      <Select
        mode="tags"
        tokenSeparators={[',', ';', '；']}
        placeholder={placeholder}
      />
    </Form.Item>
  );

  const renderFormStep = () => {
    switch (activeStep.key) {
      case 'basic':
        return (
          <>
            {kind === 'project' ? (
              <div className="ai-write-wizard-grid ai-write-wizard-grid-2">
                <Form.Item label="资助机构" name="fundingAgency">
                  <Select allowClear placeholder="请选择你的资助机构" options={PROJECT_FUNDING_OPTIONS} />
                </Form.Item>
                <Form.Item label="项目类型" name="projectCategory">
                  <Select allowClear placeholder="请选择你的项目类型" options={PROJECT_CATEGORY_OPTIONS} />
                </Form.Item>
              </div>
            ) : null}

            <Form.Item label="学科分类" name="researchField">
              <Input placeholder="如：人工智能、知识图谱、自然语言处理" />
            </Form.Item>

            {renderTagField(
              'backgroundKeywords',
              '问题/背景关键词',
              '输入后按回车，可连续添加多个关键词',
              5,
            )}
            {renderTagField(
              'backgroundInnovation',
              '问题创新',
              '输入后按回车，可连续添加多个创新点',
              5,
              '最多输入 5 个，使用分号或回车分割',
            )}

            <Form.Item label="问题/背景说明" name="backgroundDescription">
              <TextArea rows={5} maxLength={500} showCount placeholder="补充问题背景、研究现状和项目切入点" />
            </Form.Item>

            {renderTagField(
              'methodKeywords',
              '方法/理论关键词',
              '输入后按回车，可连续添加多个方法关键词',
              5,
            )}
            {renderTagField(
              'methodInnovation',
              '方法创新',
              '输入后按回车，可连续添加多个方法创新点',
              5,
              '最多输入 5 个，使用分号或回车分割',
            )}

            <Form.Item label="方法/理论说明" name="methodDescription">
              <TextArea rows={5} maxLength={500} showCount placeholder="补充方法路线、理论依据与预期实现方式" />
            </Form.Item>

            <Form.Item label="知识库编号" name="kbId" extra="可选。用于绑定知识库并注入上下文。">
              <Input placeholder="如：proposal-kb-001" />
            </Form.Item>
          </>
        );
      case 'journal':
        return (
          <>
            <Form.Item label="目标期刊" name="journalTarget">
              <Input placeholder="如：Nature Communications / 软件学报 / 计算机研究与发展" />
            </Form.Item>
            <Form.Item label="期刊要求" name="journalRequirements">
              <TextArea
                rows={6}
                maxLength={600}
                showCount
                placeholder="记录偏好的语言风格、篇幅要求、实验呈现重点或投稿规范"
              />
            </Form.Item>
          </>
        );
      case 'collaborators':
        return (
          <Form.Item
            label="推荐合作者"
            name="collaboratorSuggestions"
            extra="可填写希望推荐的作者方向、团队分工或潜在合作角色。"
          >
            <TextArea
              rows={8}
              maxLength={800}
              showCount
              placeholder="如：需要推荐擅长医学知识图谱与临床NLP的合作学者，偏方法论与数据治理方向"
            />
          </Form.Item>
        );
      case 'title':
        return (
          <Form.Item
            label={kind === 'paper' ? '论文标题' : '项目标题'}
            name="title"
            extra="留空时系统会自动生成一个工作标题，但建议你手动提供更稳定。"
          >
            <Input placeholder={kind === 'paper' ? '请输入论文标题' : '请输入项目标题'} maxLength={120} showCount />
          </Form.Item>
        );
      case 'summary':
        return (
          <Form.Item label={kind === 'paper' ? '论文摘要' : '项目摘要'} name="summary">
            <TextArea
              rows={8}
              maxLength={1200}
              showCount
              placeholder="先写出你最想表达的研究主线、方法亮点和预期结论"
            />
          </Form.Item>
        );
      case 'keywords':
        return renderTagField(
          'coreKeywords',
          '核心关键词',
          '输入后按回车，可连续添加多个关键词',
          8,
        );
      case 'references':
        return (
          <Form.Item label="参考文献" name="references">
            <TextArea
              rows={10}
              maxLength={2400}
              showCount
              placeholder="可粘贴参考文献、政策依据、前期工作或基线论文摘要"
            />
          </Form.Item>
        );
      default:
        return null;
    }
  };

  const renderOutlineStep = () => {
    if (!record) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="先保存一份写作资料，再生成提纲与章节。"
        >
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void saveDraft()}>
            保存草稿
          </Button>
        </Empty>
      );
    }

    return (
      <div className="ai-write-outline-shell">
        {record.errorMessage ? (
          <Alert type="error" showIcon message="最近一次任务执行失败" description={record.errorMessage} />
        ) : (
          <Alert
            type={record.isActive ? 'info' : 'success'}
            showIcon
            message={record.isActive ? '任务正在生成中' : `当前建议：${record.nextActionLabel}`}
            description={record.statusHint}
          />
        )}
        {record.executionMeta?.warnings?.length ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 12 }}
            message={`当前结果：${record.generationModeLabel}`}
            description={[
              ...record.executionMeta.warnings,
              `大模型状态：${record.executionMeta.llm.message}`,
              `知识库状态：${record.executionMeta.knowledge.message}`,
            ].join(' ')}
          />
        ) : null}

        <div className="ai-write-wizard-brief-grid">
          <Card variant="borderless" className="ai-write-wizard-brief-card">
            <div className="ai-write-wizard-brief-head">
              <div className="ai-write-wizard-brief-title">写作简报</div>
              <div className="ai-write-wizard-brief-subtitle">
                系统会优先依据这些结构化材料组织提纲、章节和最终润色稿。
              </div>
            </div>
            {briefSections.length > 0 ? (
              <div className="ai-write-wizard-brief-sections">
                {briefSections.map((section) => (
                  <div key={section.title} className="ai-write-wizard-brief-section">
                    <div className="ai-write-wizard-brief-section-title">{section.title}</div>
                    <div className="ai-write-wizard-brief-fields">
                      {section.fields.map((field) => (
                        <div key={`${section.title}-${field.label}`} className="ai-write-wizard-brief-field">
                          <div className="ai-write-wizard-brief-label">{field.label}</div>
                          {Array.isArray(field.value) ? (
                            <div className="ai-write-wizard-brief-tags">
                              {field.value.map((item) => (
                                <Tag key={`${field.label}-${item}`}>{item}</Tag>
                              ))}
                            </div>
                          ) : (
                            <div
                              className={`ai-write-wizard-brief-value ${
                                field.tone === 'multiline' ? 'is-multiline' : ''
                              }`}
                            >
                              {field.value}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ai-write-wizard-brief-empty">
                还没有整理出可供生成的材料，建议先回到上方步骤补充研究背景、方法与摘要。
              </div>
            )}
          </Card>

          <Card variant="borderless" className="ai-write-wizard-brief-card ai-write-wizard-action-card">
            <div className="ai-write-wizard-brief-head">
              <div className="ai-write-wizard-brief-title">任务推进</div>
              <div className="ai-write-wizard-brief-subtitle">
                按当前状态继续推进即可，不需要重新整理整份材料。
              </div>
            </div>

            <div className="ai-write-wizard-status-list">
              <div className="ai-write-wizard-status-item">
                <span className="ai-write-wizard-status-label">工作标题</span>
                <span className="ai-write-wizard-status-value">{workingTitle}</span>
              </div>
              <div className="ai-write-wizard-status-item">
                <span className="ai-write-wizard-status-label">当前动作</span>
                <span className="ai-write-wizard-status-value">{record.nextActionLabel}</span>
              </div>
              <div className="ai-write-wizard-status-item">
                <span className="ai-write-wizard-status-label">建议下一节</span>
                <span className="ai-write-wizard-status-value">
                  {suggestedSection
                    ? `第 ${record.nextSectionIndex! + 1} 节 · ${suggestedSection.title}`
                    : record.hasFullText
                      ? '全文已完成'
                      : '等待提纲生成'}
                </span>
              </div>
              <div className="ai-write-wizard-status-item">
                <span className="ai-write-wizard-status-label">最近保存</span>
                <span className="ai-write-wizard-status-value">{formatDateTime(record.updatedAt)}</span>
              </div>
              <div className="ai-write-wizard-status-item">
                <span className="ai-write-wizard-status-label">生成模式</span>
                <span className="ai-write-wizard-status-value">
                  {record.executionMeta ? record.generationModeLabel : '待生成'}
                </span>
              </div>
            </div>

            {referenceItems.length > 0 ? (
              <div className="ai-write-wizard-reference-box">
                <div className="ai-write-wizard-reference-title">参考依据</div>
                <div className="ai-write-wizard-reference-list">
                  {referenceItems.map((item, index) => (
                    <div key={`${item}-${index}`} className="ai-write-wizard-reference-item">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {executionFacts.length > 0 ? (
              <div className="ai-write-wizard-reference-box ai-write-wizard-evidence-box">
                <div className="ai-write-wizard-evidence-head">
                  <div className="ai-write-wizard-reference-title">生成依据与来源</div>
                  {sourceReportPath ? (
                    <Button
                      size="small"
                      icon={<LinkOutlined />}
                      onClick={() => navigate(sourceReportPath)}
                    >
                      回看来源报告
                    </Button>
                  ) : null}
                </div>
                <div className="ai-write-wizard-evidence-grid">
                  {executionFacts.map((fact) => (
                    <div key={fact.label} className="ai-write-wizard-evidence-item">
                      <div className="ai-write-wizard-evidence-label">{fact.label}</div>
                      <div className="ai-write-wizard-evidence-value">{fact.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="ai-write-wizard-action-buttons">
              <Button
                type="primary"
                icon={<SendOutlined />}
                disabled={record.isActive}
                onClick={() => void handleRecommendedAction()}
              >
                {record.nextAction === 'generate_next_section' && record.nextSectionIndex !== null
                  ? `继续写第 ${record.nextSectionIndex + 1} 节`
                  : record.nextAction === 'polish'
                    ? '生成全文润色稿'
                    : record.nextAction === 'view_result'
                      ? '复制当前结果'
                      : record.nextActionLabel}
              </Button>
              {outlineMarkdown ? (
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => void handleCopyContent(outlineMarkdown, '提纲已复制。')}
                >
                  复制提纲
                </Button>
              ) : null}
              {outlineMarkdown ? (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => handleExportContent(outlineMarkdown, 'md', '提纲 Markdown 已导出。')}
                >
                  导出提纲
                </Button>
              ) : null}
              <Button
                loading={fullDraftLoading}
                disabled={record.isActive}
                onClick={() => void handleGenerateFullDraft()}
              >
                一键生成完整初稿
              </Button>
            </div>
          </Card>
        </div>

        <div className="ai-write-wizard-metrics">
          <Card variant="borderless" className="ai-write-wizard-metric-card">
            <div className="ai-write-wizard-metric-value">{record.completionPercent}%</div>
            <div className="ai-write-wizard-metric-label">整体进度</div>
          </Card>
          <Card variant="borderless" className="ai-write-wizard-metric-card">
            <div className="ai-write-wizard-metric-value">{record.outlineCount}</div>
            <div className="ai-write-wizard-metric-label">提纲章节</div>
          </Card>
          <Card variant="borderless" className="ai-write-wizard-metric-card">
            <div className="ai-write-wizard-metric-value">{record.generatedSectionCount}</div>
            <div className="ai-write-wizard-metric-label">已生成章节</div>
          </Card>
          <Card variant="borderless" className="ai-write-wizard-metric-card">
            <div className="ai-write-wizard-metric-value">{record.wordCount}</div>
            <div className="ai-write-wizard-metric-label">当前字数</div>
          </Card>
        </div>

        {record.executionMeta?.history?.length ? (
          <Card variant="borderless" className="ai-write-outline-card">
            <div className="ai-write-wizard-brief-head">
              <div className="ai-write-wizard-brief-title">执行轨迹</div>
              <div className="ai-write-wizard-brief-subtitle">
                这里记录最近几次提纲、章节和润色生成的真实执行情况，便于判断当前结果是否可直接继续使用。
              </div>
            </div>
            <div className="ai-write-wizard-timeline">
              {record.executionMeta.history
                .slice()
                .reverse()
                .map((entry) => (
                  <div key={`${entry.stage}-${entry.at}`} className="ai-write-wizard-timeline-item">
                    <div className="ai-write-wizard-timeline-dot" />
                    <div className="ai-write-wizard-timeline-body">
                      <div className="ai-write-wizard-timeline-head">
                        <span className="ai-write-wizard-timeline-title">
                          {resolveExecutionStageLabel(entry.stage)}
                        </span>
                        <Tag
                          color={
                            entry.mode === 'fallback'
                              ? 'warning'
                              : entry.mode === 'mixed'
                                ? 'gold'
                                : 'success'
                          }
                        >
                          {entry.mode === 'fallback'
                            ? '降级草稿'
                            : entry.mode === 'mixed'
                              ? '混合生成'
                              : '真生成'}
                        </Tag>
                        <span className="ai-write-wizard-timeline-time">
                          {formatDateTime(entry.at)}
                        </span>
                      </div>
                      <div className="ai-write-wizard-timeline-meta">
                        <span>大模型：{resolveDependencyStateLabel(entry.llm.state)}</span>
                        <span>知识库：{resolveDependencyStateLabel(entry.knowledge.state)}</span>
                      </div>
                      {entry.warnings.length > 0 ? (
                        <div className="ai-write-wizard-timeline-warning">
                          {entry.warnings.join(' ')}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        ) : null}

        <div className="ai-write-outline-actions">
          {record.nextAction === 'generate_next_section' && record.nextSectionIndex !== null ? (
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={Boolean(sectionLoadingMap[record.nextSectionIndex])}
              onClick={() => void handleGenerateSection(record.nextSectionIndex!)}
            >
              继续写第 {record.nextSectionIndex + 1} 节
            </Button>
          ) : null}
          {record.nextAction === 'polish' ? (
            <Button
              type="primary"
              icon={<BgColorsOutlined />}
              loading={polishLoading}
              onClick={() => void handlePolish()}
            >
              生成全文润色稿
            </Button>
          ) : null}
          <Button
            icon={<UnorderedListOutlined />}
            loading={outlineLoading}
            onClick={() => void handleGenerateOutline()}
          >
            {record.hasOutline ? '重新生成提纲' : '生成提纲'}
          </Button>
          <Button
            icon={<BgColorsOutlined />}
            loading={polishLoading}
            disabled={!record.hasOutline}
            onClick={() => void handlePolish()}
          >
            {record.hasFullText ? '重新润色全文' : '全文润色'}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => void refreshRecord()}>
            刷新结果
          </Button>
          <Button loading={fullDraftLoading} disabled={record.isActive} onClick={() => void handleGenerateFullDraft()}>
            一键生成完整初稿
          </Button>
        </div>

        {record.outlineCount === 0 ? (
          <Card variant="borderless" className="ai-write-outline-card">
            <Empty
              image={<FileTextOutlined style={{ fontSize: 44, color: '#c6d3e1' }} />}
              description="当前还没有提纲。先点击上方按钮生成提纲。"
            />
          </Card>
        ) : (
          <Card variant="borderless" className="ai-write-outline-card">
            <div className="ai-write-outline-list">
              {record.outline.map((section, index) => {
                const sectionContent =
                  record.sections.find((item) => item.index === index) || null;

                return (
                  <div key={`${section.title}-${index}`} className="ai-write-outline-item">
                    <div className="ai-write-outline-head">
                      <div className="ai-write-outline-heading">
                        <span className="ai-write-outline-index">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <div className="ai-write-outline-title">{section.title}</div>
                          <div className="ai-write-outline-description">
                            {section.description || '当前没有章节描述。'}
                          </div>
                        </div>
                      </div>
                      <Space wrap>
                        {section.minWords ? <Tag>{section.minWords} 字</Tag> : null}
                        {record.nextSectionIndex === index && !sectionContent?.content ? (
                          <Tag color="blue">建议优先</Tag>
                        ) : null}
                        <Tag color={sectionContent?.content ? 'success' : 'default'}>
                          {sectionContent?.content ? '已生成' : '待生成'}
                        </Tag>
                        <Button
                          size="small"
                          type={sectionContent?.content ? 'default' : 'primary'}
                          loading={Boolean(sectionLoadingMap[index])}
                          onClick={() => void handleGenerateSection(index)}
                        >
                          {sectionContent?.content ? '重写本节' : '生成本节'}
                        </Button>
                      </Space>
                    </div>

                    {sectionContent?.content ? (
                      <div className="ai-write-markdown ai-write-section-markdown">
                        <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS}>
                          {sectionContent.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="ai-write-section-placeholder">当前章节尚未生成。</div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {draftMarkdown ? (
          <Card
            variant="borderless"
            className="ai-write-outline-card ai-write-fulltext-card"
            title={record.fullText ? '全文结果' : '阶段性合稿'}
            extra={
              <Space wrap>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() =>
                    void handleCopyContent(
                      draftMarkdown,
                      record.fullText ? '全文结果已复制。' : '阶段性合稿已复制。',
                    )
                  }
                >
                  复制
                </Button>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() =>
                    handleExportContent(
                      draftMarkdown,
                      'md',
                      record.fullText ? '全文 Markdown 已导出。' : '阶段性合稿 Markdown 已导出。',
                    )
                  }
                >
                  导出 Markdown
                </Button>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() =>
                    handleExportContent(
                      draftPlainText,
                      'txt',
                      record.fullText ? '全文 TXT 已导出。' : '阶段性合稿 TXT 已导出。',
                    )
                  }
                >
                  导出 TXT
                </Button>
                <Tag color={record.fullText ? 'success' : 'processing'}>
                  {record.fullText ? '已生成' : '可继续迭代'}
                </Tag>
              </Space>
            }
          >
            <div className="ai-write-markdown ai-write-fulltext-markdown">
              <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS}>{draftMarkdown}</ReactMarkdown>
            </div>
          </Card>
        ) : null}
      </div>
    );
  };

  const nextStep = steps[stepIndex + 1];
  const prevStep = steps[stepIndex - 1];

  return (
    <div className="ai-write-wizard-page">
      <header className="ai-write-wizard-topbar">
        <div className="ai-write-wizard-topbar-left">
          <Button icon={<ArrowLeftOutlined />} onClick={goBack}>
            返回
          </Button>
          <div>
            <div className="ai-write-wizard-top-title">
              AI 写作（{kind === 'paper' ? '期刊论文' : '项目申请'}）
            </div>
            <div className="ai-write-wizard-top-subtitle">
              {record?.title || (kind === 'paper' ? '期刊论文写作助理' : '项目申请写作助理')}
            </div>
          </div>
        </div>
        <div className="ai-write-wizard-topbar-right">
          {statusTag}
          <Button icon={<ReloadOutlined />} onClick={() => void refreshRecord()} disabled={!taskId}>
            刷新
          </Button>
          <Button icon={<SaveOutlined />} loading={saving} onClick={() => void saveDraft()}>
            保存草稿
          </Button>
        </div>
      </header>

      <div className="ai-write-wizard-shell">
        <aside className="ai-write-wizard-sidebar">
          <div className="ai-write-wizard-sidebar-card">
            <div className="ai-write-wizard-sidebar-title">{sidebarTitle}</div>
            <div className="ai-write-wizard-step-list">
              {steps.map((step, index) => {
                const active = step.key === activeStep.key;
                const done = index < stepIndex || (step.key === 'outline' && Boolean(record?.hasOutline));

                return (
                  <button
                    key={step.key}
                    type="button"
                    className={`ai-write-wizard-step ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
                    onClick={() => setCurrentStep(step.key)}
                  >
                    <span className="ai-write-wizard-step-index">{index + 1}</span>
                    <span className="ai-write-wizard-step-copy">{step.label}</span>
                  </button>
                );
              })}
            </div>

            {record ? (
              <div className="ai-write-wizard-sidebar-progress">
                <div className="ai-write-wizard-sidebar-progress-head">
                  <Text strong>写作进度</Text>
                  <Text type="secondary">{record.completionPercent}%</Text>
                </div>
                <Progress percent={record.completionPercent} showInfo={false} size="small" />
                <Text type="secondary">{record.nextActionHint}</Text>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="ai-write-wizard-main">
          <section className="ai-write-wizard-hero">
            <div className="ai-write-wizard-hero-eyebrow">{heroLabel}</div>
            <div>
              <Tag color="blue" className="ai-write-wizard-hero-tag">
                {kind === 'paper' ? '论文写作链路' : '项目申请链路'}
              </Tag>
              <Title level={2}>科研之友 AI 写作助理</Title>
              <Paragraph className="ai-write-wizard-hero-copy">
                你好，我是科研之友 AI 写作助理。我会根据你提供的结构化资料，帮助你从构思、提纲到正文逐步完成写作。
              </Paragraph>
            </div>
            <div className="ai-write-wizard-hero-stats">
              <div className="ai-write-wizard-hero-stat">
                <span className="ai-write-wizard-hero-stat-label">当前步骤</span>
                <span className="ai-write-wizard-hero-stat-value">{activeStep.label}</span>
              </div>
              <div className="ai-write-wizard-hero-stat">
                <span className="ai-write-wizard-hero-stat-label">任务状态</span>
                <span className="ai-write-wizard-hero-stat-value">
                  {record ? record.statusLabel : '未创建'}
                </span>
              </div>
            </div>
          </section>

          <Card variant="borderless" className="ai-write-wizard-card">
            {loading ? (
              <div className="ai-write-wizard-loading">
                <Spin />
              </div>
            ) : (
              <>
                <div className="ai-write-wizard-card-head">
                  <div>
                    <div className="ai-write-wizard-card-title">{activeStep.sectionTitle}</div>
                    <div className="ai-write-wizard-card-subtitle">{activeStep.description}</div>
                  </div>
                  {record ? (
                    <Space wrap size={[8, 8]}>
                      <Tag color={record.statusColor}>{record.statusLabel}</Tag>
                      <Tag color={record.hasOutline ? 'processing' : 'default'}>
                        {record.hasOutline ? '已生成提纲' : '待生成提纲'}
                      </Tag>
                    </Space>
                  ) : null}
                </div>

                {seedContext && !record ? (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 18 }}
                    message={`已接收来自 ${getAiWriteSeedSourceLabel(seedContext.source)} 的整改写作建议`}
                    description={
                      seedContext.reason ||
                      `${seedContext.sourceTitle || '上一条分析结果'} 已转成可继续编辑的写作草稿，你可以直接补充后生成提纲。`
                    }
                  />
                ) : null}

                {isOutlineStep ? (
                  renderOutlineStep()
                ) : (
                  <Form form={form} layout="vertical" className="ai-write-wizard-form">
                    {renderFormStep()}

                    <div className="ai-write-wizard-brief-grid">
                      <Card variant="borderless" className="ai-write-wizard-brief-card">
                        <div className="ai-write-wizard-brief-head">
                          <div className="ai-write-wizard-brief-title">生成前预览</div>
                          <div className="ai-write-wizard-brief-subtitle">
                            这里展示当前表单里已经整理出的写作材料，保存后会进入提纲与正文链路。
                          </div>
                        </div>
                        {briefSections.length > 0 ? (
                          <div className="ai-write-wizard-brief-sections">
                            {briefSections.map((section) => (
                              <div key={section.title} className="ai-write-wizard-brief-section">
                                <div className="ai-write-wizard-brief-section-title">{section.title}</div>
                                <div className="ai-write-wizard-brief-fields">
                                  {section.fields.map((field) => (
                                    <div
                                      key={`${section.title}-${field.label}`}
                                      className="ai-write-wizard-brief-field"
                                    >
                                      <div className="ai-write-wizard-brief-label">{field.label}</div>
                                      {Array.isArray(field.value) ? (
                                        <div className="ai-write-wizard-brief-tags">
                                          {field.value.map((item) => (
                                            <Tag key={`${field.label}-${item}`}>{item}</Tag>
                                          ))}
                                        </div>
                                      ) : (
                                        <div
                                          className={`ai-write-wizard-brief-value ${
                                            field.tone === 'multiline' ? 'is-multiline' : ''
                                          }`}
                                        >
                                          {field.value}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="ai-write-wizard-brief-empty">
                            当前表单还没有足够的材料。至少补充学科、问题背景、方法关键词和摘要，生成效果会更稳定。
                          </div>
                        )}
                      </Card>

                      <Card variant="borderless" className="ai-write-wizard-brief-card ai-write-wizard-action-card">
                        <div className="ai-write-wizard-brief-head">
                          <div className="ai-write-wizard-brief-title">生成前核对</div>
                          <div className="ai-write-wizard-brief-subtitle">
                            系统会先保存当前资料，再进入提纲生成与章节扩写阶段。
                          </div>
                        </div>

                        <div className="ai-write-wizard-status-list">
                          <div className="ai-write-wizard-status-item">
                            <span className="ai-write-wizard-status-label">工作标题</span>
                            <span className="ai-write-wizard-status-value">{workingTitle}</span>
                          </div>
                          <div className="ai-write-wizard-status-item">
                            <span className="ai-write-wizard-status-label">当前步骤</span>
                            <span className="ai-write-wizard-status-value">{activeStep.label}</span>
                          </div>
                          <div className="ai-write-wizard-status-item">
                            <span className="ai-write-wizard-status-label">核心关键词</span>
                            <span className="ai-write-wizard-status-value">
                              {(previewValues.coreKeywords || []).length > 0
                                ? `${previewValues.coreKeywords?.length || 0} 个`
                                : '建议补充'}
                            </span>
                          </div>
                          <div className="ai-write-wizard-status-item">
                            <span className="ai-write-wizard-status-label">参考依据</span>
                            <span className="ai-write-wizard-status-value">
                              {referenceItems.length > 0 ? `已录入 ${referenceItems.length} 条` : '尚未录入'}
                            </span>
                          </div>
                        </div>

                        {referenceItems.length > 0 ? (
                          <div className="ai-write-wizard-reference-box">
                            <div className="ai-write-wizard-reference-title">已录入参考依据</div>
                            <div className="ai-write-wizard-reference-list">
                              {referenceItems.map((item, index) => (
                                <div key={`${item}-${index}`} className="ai-write-wizard-reference-item">
                                  {item}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </Card>
                    </div>

                    <div className="ai-write-wizard-form-actions">
                      <Space wrap>
                        {prevStep ? (
                          <Button onClick={() => setCurrentStep(prevStep.key)}>上一步</Button>
                        ) : null}
                        {nextStep && nextStep.key !== 'outline' ? (
                          <Button onClick={() => setCurrentStep(nextStep.key)}>下一步</Button>
                        ) : null}
                        {nextStep?.key === 'outline' ? (
                          <Button
                            icon={<CopyOutlined />}
                            onClick={() => {
                              setCurrentStep('outline');
                              void saveDraft(true);
                            }}
                          >
                            保存并查看提纲区
                          </Button>
                        ) : null}
                      </Space>

                      <Space wrap>
                        <Button icon={<SaveOutlined />} loading={saving} onClick={() => void saveDraft()}>
                          保存草稿
                        </Button>
                        {activeStep.key === 'basic' ? (
                          <Button
                            type="primary"
                            icon={<SendOutlined />}
                            loading={outlineLoading}
                            onClick={() => void handleGenerateOutline()}
                          >
                            开始写作
                          </Button>
                        ) : null}
                      </Space>
                    </div>
                  </Form>
                )}
              </>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
};

export default AIWriteWizardPage;
