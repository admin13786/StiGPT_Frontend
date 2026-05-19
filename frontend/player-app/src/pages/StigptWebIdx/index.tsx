import { useEffect, useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Drawer,
  Empty,
  Input,
  Radio,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  ApartmentOutlined,
  BookOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  MessageOutlined,
  PlusOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  getStigptRouteSurfaceByPath,
} from '../../constants/stigptRoutes';
import { stigptService } from '../../services/stigpt.service';
import type {
  StigptChatModel,
  StigptCitation,
  StigptConversationDetail,
  StigptConversationListItem,
  StigptExample,
  StigptKnowledgeBaseOption,
  StigptPageConfig,
  StigptRouteModeDefinition,
  StigptRouteModeKey,
  StigptMessage,
} from '../../types/stigpt';
import './index.css';

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

const MARKDOWN_PLUGINS = [remarkGfm];

const ROUTE_MODES: StigptRouteModeDefinition[] = [
  {
    key: 'policy',
    label: '政策问答',
    description: '围绕基金政策、申报资格、限项规则、时间节点和官方指南给出可追溯答复。',
  },
  {
    key: 'project',
    label: '项目辅导',
    description: '从评审视角检查选题价值、创新点、技术路线、里程碑和风险表述。',
  },
  {
    key: 'aiRead',
    label: 'AI 阅读',
    description: '拆解论文和文档，提取问题、方法、证据、局限、启发和可复用笔记。',
  },
];

const ROUTE_MODE_COLORS: Record<StigptRouteModeKey, string> = {
  policy: 'processing',
  project: 'gold',
  aiRead: 'purple',
};

const ROUTE_MODE_ICONS: Record<StigptRouteModeKey, JSX.Element> = {
  policy: <SafetyCertificateOutlined />,
  project: <ApartmentOutlined />,
  aiRead: <BookOutlined />,
};

const FALLBACK_EXAMPLES: Record<StigptRouteModeKey, StigptExample[]> = {
  policy: [
    {
      id: 'policy-1',
      routeKey: 'webIdx',
      title: '地区科学基金项目',
      prompt: '哪些人员不得作为地区科学基金项目的申请人？请按资格限制和注意事项整理。',
      sortOrder: 1,
      isActive: true,
      metadata: { routeMode: 'policy' },
    },
    {
      id: 'policy-2',
      routeKey: 'webIdx',
      title: '面上项目资格',
      prompt: '申请面上项目对申请人的职称、学位和承担项目数量有什么基本要求？',
      sortOrder: 2,
      isActive: true,
      metadata: { routeMode: 'policy' },
    },
    {
      id: 'policy-3',
      routeKey: 'webIdx',
      title: '青年基金年龄',
      prompt: '青年科学基金项目对申请人年龄和科研经历有哪些限制？请列成核对清单。',
      sortOrder: 3,
      isActive: true,
      metadata: { routeMode: 'policy' },
    },
    {
      id: 'policy-4',
      routeKey: 'webIdx',
      title: '申报节奏规划',
      prompt: '请按月份梳理一次国家自然科学基金申报前需要完成的关键准备工作。',
      sortOrder: 4,
      isActive: true,
      metadata: { routeMode: 'policy' },
    },
    {
      id: 'policy-5',
      routeKey: 'webIdx',
      title: '政策口径核验',
      prompt: '如果政策条款和单位通知存在表述差异，我应该如何核验并降低申报风险？',
      sortOrder: 5,
      isActive: true,
      metadata: { routeMode: 'policy' },
    },
    {
      id: 'policy-6',
      routeKey: 'webIdx',
      title: '限项规则说明',
      prompt: '请解释基金项目常见限项规则，并说明哪些情况需要先向科研管理部门确认。',
      sortOrder: 6,
      isActive: true,
      metadata: { routeMode: 'policy' },
    },
  ],
  project: [
    {
      id: 'project-1',
      routeKey: 'webIdx',
      title: '申请书风险诊断',
      prompt: '青年基金申请书最容易被初筛或评审质疑的几个问题是什么？如何提前规避？',
      sortOrder: 1,
      isActive: true,
      metadata: { routeMode: 'project' },
    },
    {
      id: 'project-2',
      routeKey: 'webIdx',
      title: '创新点重构',
      prompt: '我的项目创新点比较散，请帮我按科学问题、关键假设和验证路径重新组织。',
      sortOrder: 2,
      isActive: true,
      metadata: { routeMode: 'project' },
    },
    {
      id: 'project-3',
      routeKey: 'webIdx',
      title: '技术路线梳理',
      prompt: '请帮我把一份科研项目的研究目标、研究内容、技术路线和预期成果串成闭环。',
      sortOrder: 3,
      isActive: true,
      metadata: { routeMode: 'project' },
    },
    {
      id: 'project-4',
      routeKey: 'webIdx',
      title: '评审意见预判',
      prompt: '站在基金评审专家角度，请预判这类选题可能被质疑的地方，并给出修改策略。',
      sortOrder: 4,
      isActive: true,
      metadata: { routeMode: 'project' },
    },
  ],
  aiRead: [
    {
      id: 'read-1',
      routeKey: 'webIdx',
      title: '论文精读',
      prompt: '请从研究问题、方法、实验、证据和局限五个方面帮我精读一篇论文。',
      sortOrder: 1,
      isActive: true,
      metadata: { routeMode: 'aiRead' },
    },
    {
      id: 'read-2',
      routeKey: 'webIdx',
      title: '方法对比',
      prompt: '请对比这篇论文与主流 baseline 的方法差异、优势、缺点和适用边界。',
      sortOrder: 2,
      isActive: true,
      metadata: { routeMode: 'aiRead' },
    },
    {
      id: 'read-3',
      routeKey: 'webIdx',
      title: '阅读笔记',
      prompt: '请把这篇论文整理成可复用阅读笔记，包含核心结论、证据链和可迁移启发。',
      sortOrder: 3,
      isActive: true,
      metadata: { routeMode: 'aiRead' },
    },
    {
      id: 'read-4',
      routeKey: 'webIdx',
      title: '文献综述线索',
      prompt: '请根据这几篇论文，帮我梳理一个相关工作段落的逻辑顺序和差异化线索。',
      sortOrder: 4,
      isActive: true,
      metadata: { routeMode: 'aiRead' },
    },
  ],
};

const ROUTE_MODE_PLAYBOOKS: Record<StigptRouteModeKey, string[]> = {
  policy: [
    '先确认政策来源、适用范围、年度版本和关键时间节点。',
    '把官方事实、模型推断和操作建议分开呈现。',
    '输出最后沉淀成资格核对、材料清单和风险提醒。',
  ],
  project: [
    '先判断科学问题是否聚焦，创新点是否能被一句话说清。',
    '检查目标、内容、方法、里程碑和证据链是否闭环。',
    '把高风险表达改成评审更容易接受的可验证表述。',
  ],
  aiRead: [
    '先拆出问题、方法、证据、结论和局限，再判断贡献。',
    '标记哪些结论由原文直接支持，哪些属于延伸推断。',
    '把阅读结果沉淀成笔记、对比表或可复用综述素材。',
  ],
};

const ACL_SCOPE_LABELS: Record<string, string> = {
  public: '公开',
  internal: '内部',
  department: '部门',
  private: '私有',
};

const looksGarbled = (value?: string | null) => {
  if (!value) {
    return false;
  }
  return /�|\?{3,}|銆|€|绉戠爺|涔嬪弸|闂|鐨|鍩|椤|璇|妫|鐢|浠|涓|鍙/.test(value);
};

const getConversationTitle = (item: Pick<StigptConversationListItem, 'title'>) =>
  looksGarbled(item.title) ? '科研之友 AI 对话' : item.title;

const buildFallbackPageConfig = (
  surface: ReturnType<typeof getStigptRouteSurfaceByPath>,
): StigptPageConfig => ({
  id: `fallback-${surface.routeKey.replace(/[^\w-]+/g, '-')}`,
  routeKey: surface.routeKey,
  pageTitle: surface.title,
  assistantName: surface.assistantName,
  welcomeMessage: surface.welcomeMessage,
  inputPlaceholder: surface.inputPlaceholder,
  isActive: true,
  config: {
    layout: 'scholarmate-webidx',
    defaultRouteMode: surface.lockedRouteMode || surface.defaultRouteMode,
    routeModes: surface.lockedRouteMode
      ? ROUTE_MODES.filter((item) => item.key === surface.lockedRouteMode)
      : ROUTE_MODES,
    features: {
      streaming: true,
      citations: true,
      routeModes: !surface.lockedRouteMode,
    },
  },
});

const getModeDefinition = (mode: StigptRouteModeKey) =>
  ROUTE_MODES.find((item) => item.key === mode) || ROUTE_MODES[0];

const getConversationRouteMode = (
  conversation: StigptConversationDetail | null,
  fallbackMode: StigptRouteModeKey,
  lockedRouteMode?: StigptRouteModeKey,
) => {
  if (lockedRouteMode) {
    return lockedRouteMode;
  }

  const routeMode = conversation?.metadata?.routeMode;
  if (routeMode === 'policy' || routeMode === 'project' || routeMode === 'aiRead') {
    return routeMode;
  }
  return fallbackMode;
};

const StigptWebIdxPage = () => {
  const { message } = App.useApp();
  const location = useLocation();
  const activeSurface = useMemo(
    () => getStigptRouteSurfaceByPath(location.pathname),
    [location.pathname],
  );
  const fallbackPageConfig = useMemo(
    () => buildFallbackPageConfig(activeSurface),
    [activeSurface],
  );

  const routeKey = activeSurface.routeKey;
  const lockedRouteMode = activeSurface.lockedRouteMode;

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pageConfig, setPageConfig] = useState<StigptPageConfig>(fallbackPageConfig);
  const [models, setModels] = useState<StigptChatModel[]>([]);
  const [examples, setExamples] = useState<StigptExample[]>([]);
  const [conversations, setConversations] = useState<StigptConversationListItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<StigptConversationDetail | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string>();
  const [selectedRouteMode, setSelectedRouteMode] = useState<StigptRouteModeKey>(
    lockedRouteMode || activeSurface.defaultRouteMode,
  );
  const [knowledgeBases, setKnowledgeBases] = useState<StigptKnowledgeBaseOption[]>([]);
  const [loadingKnowledgeBases, setLoadingKnowledgeBases] = useState(false);
  const [selectedKbId, setSelectedKbId] = useState<string>();
  const [inspectedCitation, setInspectedCitation] = useState<StigptCitation | null>(null);
  const [draft, setDraft] = useState('');
  const [exampleBatch, setExampleBatch] = useState(0);

  const streamAbortRef = useRef<AbortController | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const displayConfig = useMemo(
    () => ({
      ...pageConfig,
      pageTitle: activeSurface.title,
      assistantName: activeSurface.assistantName,
      welcomeMessage: activeSurface.welcomeMessage,
      inputPlaceholder: activeSurface.inputPlaceholder,
    }),
    [activeSurface, pageConfig],
  );

  const routeModes = useMemo(() => {
    if (!lockedRouteMode) {
      return ROUTE_MODES;
    }
    return ROUTE_MODES.filter((item) => item.key === lockedRouteMode);
  }, [lockedRouteMode]);

  const selectedRouteModeDefinition = useMemo(
    () => getModeDefinition(selectedRouteMode),
    [selectedRouteMode],
  );

  const activeModel = useMemo(
    () =>
      models.find((model) => model.id === selectedModelId) ||
      models.find((model) => model.id === activeConversation?.modelId) ||
      models.find((model) => model.isDefault) ||
      models[0],
    [activeConversation?.modelId, models, selectedModelId],
  );

  const knowledgeBaseMap = useMemo(
    () => new Map(knowledgeBases.map((item) => [item.id, item])),
    [knowledgeBases],
  );

  const recommendedKnowledgeBase = useMemo(
    () => knowledgeBases.find((item) => item.recommended),
    [knowledgeBases],
  );

  const selectedKnowledgeBase = selectedKbId
    ? knowledgeBaseMap.get(selectedKbId)
    : undefined;

  const conversationKnowledgeBase = activeConversation?.kbId
    ? knowledgeBaseMap.get(activeConversation.kbId)
    : undefined;

  const effectiveKnowledgeBase = selectedKnowledgeBase || conversationKnowledgeBase;

  const visibleConversationItems = useMemo(
    () => conversations.filter((item) => !looksGarbled(item.title)).slice(0, 200),
    [conversations],
  );

  const visibleExamples = useMemo(() => {
    const seenPrompts = new Set<string>();
    const backendExamples = examples.filter((item) => {
      const routeMode = item.metadata?.routeMode;
      const routeMatches = routeMode ? routeMode === selectedRouteMode : routeKey !== 'webIdx';
      const promptKey = item.prompt.trim();
      const usable =
        routeMatches &&
        promptKey &&
        !seenPrompts.has(promptKey) &&
        !looksGarbled(`${item.title}${item.prompt}`);
      if (usable) {
        seenPrompts.add(promptKey);
      }
      return usable;
    });

    return backendExamples.length >= 3
      ? backendExamples
      : FALLBACK_EXAMPLES[selectedRouteMode];
  }, [examples, routeKey, selectedRouteMode]);

  const displayedExamples = useMemo(() => {
    if (visibleExamples.length <= 6) {
      return visibleExamples;
    }

    const startIndex = (exampleBatch * 6) % visibleExamples.length;
    return Array.from({ length: 6 }, (_, offset) => {
      const index = (startIndex + offset) % visibleExamples.length;
      return visibleExamples[index];
    });
  }, [exampleBatch, visibleExamples]);

  const latestAssistantMessage = useMemo(
    () =>
      activeConversation?.messages
        ?.slice()
        .reverse()
        .find((item) => item.role === 'assistant') || null,
    [activeConversation?.messages],
  );

  const hasMessages = Boolean(activeConversation?.messages?.length);

  useEffect(() => {
    streamAbortRef.current?.abort();
    setPageConfig(fallbackPageConfig);
    setModels([]);
    setExamples([]);
    setConversations([]);
    setActiveConversation(null);
    setSelectedModelId(undefined);
    setSelectedRouteMode(lockedRouteMode || activeSurface.defaultRouteMode);
    setKnowledgeBases([]);
    setSelectedKbId(undefined);
    setInspectedCitation(null);
    setDraft('');
    void bootstrap();
  }, [activeSurface.defaultRouteMode, fallbackPageConfig, lockedRouteMode, routeKey]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [activeConversation?.messages]);

  useEffect(() => {
    void loadKnowledgeBases(selectedRouteMode);
  }, [routeKey, selectedRouteMode]);

  useEffect(() => {
    setExampleBatch(0);
  }, [routeKey, selectedRouteMode, examples]);

  const bootstrap = async () => {
    setLoading(true);
    try {
      const [pageConfigData, modelsData, examplesData, conversationsData] =
        await Promise.all([
          stigptService.getPageConfig(routeKey),
          stigptService.getModels(routeKey),
          stigptService.getExamples(routeKey),
          stigptService.getConversations(routeKey),
        ]);

      const nextModels = modelsData || [];
      const nextConversations = conversationsData || [];
      const defaultRouteMode = lockedRouteMode || activeSurface.defaultRouteMode;

      setPageConfig(pageConfigData || fallbackPageConfig);
      setModels(nextModels);
      setExamples(examplesData || []);
      setConversations(nextConversations);
      setSelectedRouteMode(defaultRouteMode);

      const defaultModel = nextModels.find((item) => item.isDefault) || nextModels[0];
      setSelectedModelId(defaultModel?.id);

      const firstReadableConversation = nextConversations.find(
        (item) => !looksGarbled(item.title),
      );

      if (firstReadableConversation) {
        const detail = await stigptService.getConversation(firstReadableConversation.id);
        setActiveConversation(detail);
        setSelectedKbId(detail.kbId || undefined);
        setSelectedRouteMode(
          getConversationRouteMode(detail, defaultRouteMode, lockedRouteMode),
        );
      }
    } catch (error) {
      console.error(error);
      setPageConfig(fallbackPageConfig);
      message.error('加载科研之友 AI 数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadKnowledgeBases = async (routeMode: StigptRouteModeKey) => {
    setLoadingKnowledgeBases(true);
    try {
      const items = await stigptService.getKnowledgeBases(routeKey, routeMode);
      setKnowledgeBases(items || []);
    } catch (error) {
      console.error(error);
      setKnowledgeBases([]);
    } finally {
      setLoadingKnowledgeBases(false);
    }
  };

  const refreshConversationList = async (focusId?: string) => {
    const items = await stigptService.getConversations(routeKey);
    setConversations(items || []);

    if (focusId) {
      const detail = await stigptService.getConversation(focusId);
      setActiveConversation(detail);
      setSelectedKbId(detail.kbId || undefined);
      setSelectedRouteMode(
        getConversationRouteMode(
          detail,
          lockedRouteMode || activeSurface.defaultRouteMode,
          lockedRouteMode,
        ),
      );
    }
  };

  const handleCreateConversation = async () => {
    try {
      streamAbortRef.current?.abort();
      const conversation = await stigptService.createConversation({
        routeKey,
        routeMode: selectedRouteMode,
        modelId: selectedModelId || activeModel?.id,
        kbId: selectedKbId,
      });
      setActiveConversation(conversation);
      setSelectedKbId(conversation.kbId || selectedKbId);
      setSelectedRouteMode(
        getConversationRouteMode(conversation, selectedRouteMode, lockedRouteMode),
      );
      await refreshConversationList(conversation.id);
    } catch (error) {
      console.error(error);
      message.error('新建会话失败');
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    try {
      streamAbortRef.current?.abort();
      const detail = await stigptService.getConversation(conversationId);
      setActiveConversation(detail);
      setSelectedKbId(detail.kbId || undefined);
      setSelectedRouteMode(
        getConversationRouteMode(
          detail,
          lockedRouteMode || activeSurface.defaultRouteMode,
          lockedRouteMode,
        ),
      );
    } catch (error) {
      console.error(error);
      message.error('加载会话失败');
    }
  };

  const handleStopStreaming = () => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setSending(false);
  };

  const handleSendMessage = async (prefilled?: string) => {
    const content = (prefilled ?? draft).trim();
    if (!content || sending) {
      return;
    }

    streamAbortRef.current?.abort();
    const streamController = new AbortController();
    streamAbortRef.current = streamController;

    setSending(true);
    setDraft('');

    let conversationId = activeConversation?.id;
    let tempAssistantId = `assistant-temp-${Date.now()}`;
    const tempUserId = `user-temp-${Date.now()}`;
    const routeMode = selectedRouteMode;
    const routeLabel = selectedRouteModeDefinition.label;

    try {
      let conversation = activeConversation;

      if (!conversationId) {
        const createdConversation = await stigptService.createConversation({
          routeKey,
          routeMode,
          modelId: selectedModelId || activeModel?.id,
          kbId: selectedKbId,
        });
        conversationId = createdConversation.id;
        conversation = createdConversation;
      }

      if (!conversationId) {
        throw new Error('当前会话不可用');
      }

      const optimisticMessages: StigptMessage[] = [
        ...(conversation?.messages || []),
        {
          id: tempUserId,
          conversationId,
          role: 'user',
          content,
          status: 'completed',
          createdAt: new Date().toISOString(),
          metadata: {
            routeMode,
            routeLabel,
            modelId: selectedModelId || activeModel?.id || null,
            kbId: selectedKbId || conversation?.kbId || null,
          },
        },
        {
          id: tempAssistantId,
          conversationId,
          role: 'assistant',
          content: '',
          status: 'streaming',
          citations: [],
          createdAt: new Date().toISOString(),
          metadata: {
            routeMode,
            routeLabel,
            modelId: selectedModelId || activeModel?.id || null,
            kbId: selectedKbId || conversation?.kbId || null,
          },
        },
      ];

      setActiveConversation({
        ...(conversation as StigptConversationDetail),
        id: conversationId,
        routeKey,
        title: looksGarbled(conversation?.title) ? content.slice(0, 24) : conversation?.title || content.slice(0, 24),
        messages: optimisticMessages,
        metadata: {
          ...(conversation?.metadata || {}),
          routeMode,
          routeLabel,
        },
      });

      await stigptService.streamMessage(
        conversationId,
        {
          content,
          routeMode,
          modelId: selectedModelId || activeModel?.id,
          kbId: selectedKbId,
          metadata: { routeKey },
        },
        {
          onMeta: async (event) => {
            tempAssistantId = event.assistantMessageId;
            setSelectedKbId(event.kbId || undefined);
            setActiveConversation((current) => {
              if (!current || current.id !== conversationId) {
                return current;
              }

              return {
                ...current,
                title: event.conversationTitle || current.title,
                modelId: event.modelId ?? current.modelId,
                kbId: event.kbId ?? current.kbId,
                metadata: {
                  ...(current.metadata || {}),
                  routeMode: event.routeMode,
                  routeLabel: getModeDefinition(event.routeMode).label,
                  modelId: event.modelId ?? null,
                  kbId: event.kbId ?? null,
                },
                messages: current.messages.map((item) => {
                  if (item.id === tempUserId) {
                    return { ...item, id: event.userMessageId };
                  }

                  if (item.id === tempAssistantId || item.id.startsWith('assistant-temp-')) {
                    return {
                      ...item,
                      id: event.assistantMessageId,
                      metadata: {
                        ...(item.metadata || {}),
                        routeMode: event.routeMode,
                        routeLabel: getModeDefinition(event.routeMode).label,
                        modelId: event.modelId ?? null,
                        kbId: event.kbId ?? null,
                      },
                    };
                  }

                  return item;
                }),
              };
            });
          },
          onCitations: async (event) => {
            setActiveConversation((current) => {
              if (!current || current.id !== conversationId) {
                return current;
              }

              return {
                ...current,
                messages: current.messages.map((item) =>
                  item.id === event.assistantMessageId
                    ? { ...item, citations: event.citations }
                    : item,
                ),
              };
            });
          },
          onDelta: async (event) => {
            setActiveConversation((current) => {
              if (!current || current.id !== conversationId) {
                return current;
              }

              return {
                ...current,
                messages: current.messages.map((item) =>
                  item.id === event.assistantMessageId
                    ? {
                        ...item,
                        status: 'streaming',
                        content: `${item.content || ''}${event.delta}`,
                      }
                    : item,
                ),
              };
            });
          },
          onDone: async (event) => {
            setActiveConversation((current) => {
              if (!current || current.id !== conversationId) {
                return current;
              }

              return {
                ...current,
                messages: current.messages.map((item) =>
                  item.id === event.assistantMessageId
                    ? {
                        ...item,
                        status: 'completed',
                        tokenUsage: event.tokenUsage,
                        metadata: {
                          ...(item.metadata || {}),
                          degraded: event.degraded,
                        },
                      }
                    : item,
                ),
              };
            });
          },
          onError: async (event) => {
            setActiveConversation((current) => {
              if (!current || current.id !== conversationId) {
                return current;
              }

              return {
                ...current,
                messages: current.messages.map((item) =>
                  item.id === tempAssistantId
                    ? {
                        ...item,
                        status: 'failed',
                        content: item.content || event.message,
                      }
                    : item,
                ),
              };
            });
            message.error(event.message);
          },
        },
        streamController.signal,
      );

      await refreshConversationList(conversationId);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      console.error(error);
      message.error('发送消息失败');
      setActiveConversation((current) => {
        if (!current || !conversationId || current.id !== conversationId) {
          return current;
        }

        return {
          ...current,
          messages: current.messages.map((item) =>
            item.id === tempAssistantId
              ? {
                  ...item,
                  status: 'failed',
                  content: item.content || '发送失败，请稍后重试。',
                }
              : item,
          ),
        };
      });

      if (conversationId) {
        await refreshConversationList(conversationId);
      }
    } finally {
      setSending(false);
      if (streamAbortRef.current === streamController) {
        streamAbortRef.current = null;
      }
    }
  };

  const renderCitations = (citations?: StigptCitation[]) => {
    if (!citations || citations.length === 0) {
      return null;
    }

    return (
      <div className="stigpt-citation-list">
        <Text strong>引用资料</Text>
        <div className="stigpt-citation-grid">
          {citations.map((citation, index) => (
            <button
              key={`${citation.chunkId}-${index}`}
              type="button"
              className="stigpt-citation-item"
              onClick={() => setInspectedCitation(citation)}
            >
              <div className="stigpt-citation-title">
                <span className="stigpt-citation-index">[{index + 1}]</span>
                <span>{citation.documentTitle}</span>
              </div>
              <Text type="secondary" className="stigpt-citation-snippet">
                {citation.content.replace(/\s+/g, ' ').slice(0, 160)}
              </Text>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderKnowledgeBaseSelector = () => {
    if (loadingKnowledgeBases) {
      return (
        <div className="stigpt-kb-loading">
          <Spin size="small" />
        </div>
      );
    }

    if (knowledgeBases.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="当前没有可用知识库"
        />
      );
    }

    return (
      <div className="stigpt-kb-list">
        <button
          type="button"
          className={`stigpt-kb-item ${selectedKbId ? '' : 'active'}`}
          onClick={() => setSelectedKbId(undefined)}
        >
          <div className="stigpt-kb-title-row">
            <Text strong>自动匹配知识库</Text>
            {recommendedKnowledgeBase ? <Tag color="processing">推荐</Tag> : null}
          </div>
          <Text type="secondary">
            {recommendedKnowledgeBase
              ? `系统将优先匹配：${recommendedKnowledgeBase.name}`
              : '由系统按问题语义选择最合适的知识空间'}
          </Text>
        </button>

        {knowledgeBases.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`stigpt-kb-item ${selectedKbId === item.id ? 'active' : ''}`}
            onClick={() => setSelectedKbId(item.id)}
          >
            <div className="stigpt-kb-title-row">
              <Text strong>{item.name}</Text>
              <Space size={[6, 6]} wrap>
                {item.recommended ? <Tag color="processing">推荐</Tag> : null}
                <Tag>{ACL_SCOPE_LABELS[item.aclScope] || item.aclScope}</Tag>
              </Space>
            </div>
            <Text type="secondary">{item.description || item.recommendationReason}</Text>
            <Space size={[6, 6]} wrap>
              <Tag>{item.documentCount} 篇文档</Tag>
              <Tag>{item.chunkCount} 个片段</Tag>
              <Tag>{new Date(item.updatedAt).toLocaleDateString()}</Tag>
            </Space>
          </button>
        ))}
      </div>
    );
  };

  const renderMessages = () => {
    if (!activeConversation?.messages?.length) {
      return null;
    }

    return (
      <div className="stigpt-message-list">
        {activeConversation.messages.map((item) => {
          const itemRouteMode = item.metadata?.routeMode || selectedRouteMode;
          const modeDefinition = getModeDefinition(itemRouteMode);
          return (
            <div
              key={item.id}
              className={`stigpt-message-item ${
                item.role === 'assistant' ? 'assistant' : 'user'
              }`}
            >
              <div className="stigpt-message-bubble">
                <div className="stigpt-message-meta">
                  <Tag color={item.role === 'assistant' ? 'blue' : 'gold'}>
                    {item.role === 'assistant' ? displayConfig.assistantName : '你'}
                  </Tag>
                  {item.role === 'assistant' ? (
                    <Tag color={ROUTE_MODE_COLORS[itemRouteMode] || 'default'}>
                      {modeDefinition.label}
                    </Tag>
                  ) : null}
                  <Text type="secondary">
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </div>

                {item.role === 'assistant' ? (
                  <div className="stigpt-markdown">
                    <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS}>
                      {item.content || (item.status === 'streaming' ? '正在生成...' : '')}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <Paragraph className="stigpt-message-content">{item.content}</Paragraph>
                )}

                {item.role === 'assistant' ? renderCitations(item.citations) : null}
              </div>
            </div>
          );
        })}
        <div ref={messageEndRef} />
      </div>
    );
  };

  const renderWelcomePanel = () => (
    <div className="stigpt-welcome-panel">
      <div className="stigpt-welcome-card primary">
        <div className="stigpt-welcome-icon">
          <RobotOutlined />
        </div>
        <div>
          <Text className="stigpt-welcome-kicker">科研之友智能助理</Text>
          <Title level={2}>把政策、文献和项目流程接到一次对话里</Title>
          <Paragraph>
            支持政策问答、项目辅导、AI 阅读和知识库引用。回答会尽量保留引用来源，
            方便后续写作、检查和评审环节继续复用。
          </Paragraph>
        </div>
      </div>
      <div className="stigpt-welcome-card">
        <DatabaseOutlined />
        <Text strong>知识库增强</Text>
        <span>按问题语义自动匹配政策、论文、项目材料和机构知识库。</span>
      </div>
      <div className="stigpt-welcome-card">
        <FileSearchOutlined />
        <Text strong>可追溯引用</Text>
        <span>命中的资料片段会附在答案下方，点击即可查看引用详情。</span>
      </div>
    </div>
  );

  return (
    <div className="stigpt-webidx-page">
      {loading ? (
        <div className="stigpt-loading">
          <Spin size="large" />
        </div>
      ) : (
        <div className="stigpt-webidx-layout">
          <aside className="stigpt-sidebar-shell">
            <button
              type="button"
              className="stigpt-new-conversation"
              onClick={() => void handleCreateConversation()}
            >
              <PlusOutlined />
              <span>新建对话</span>
            </button>
            <div className="stigpt-sidebar-section-title">最近会话</div>
            <div className="stigpt-sidebar-caption">仅展示当前入口最近 200 条对话</div>
            <div className="stigpt-conversation-list">
              {visibleConversationItems.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="当前入口还没有历史会话"
                />
              ) : (
                visibleConversationItems.map((item) => {
                  const mode = getModeDefinition(
                    item.metadata?.routeMode || selectedRouteMode,
                  );
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`stigpt-conversation-card ${
                        activeConversation?.id === item.id ? 'active' : ''
                      }`}
                      onClick={() => void handleSelectConversation(item.id)}
                    >
                      <div className="stigpt-conversation-avatar">
                        <RobotOutlined />
                      </div>
                      <div className="stigpt-conversation-copy">
                        <div className="stigpt-conversation-head">
                          <span className="stigpt-conversation-title">{getConversationTitle(item)}</span>
                          <span className="stigpt-conversation-date">
                            {new Date(item.updatedAt || item.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="stigpt-conversation-preview">
                          {mode.label}
                          {' · '}
                          {item._count?.messages || 0} 条消息
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="stigpt-main-shell">
            <div className="stigpt-hero-panel">
              <div className="stigpt-brand-lockup">
                <div className="stigpt-brand-icon">
                  <RobotOutlined />
                </div>
                <div>
                  <Text className="stigpt-brand-eyebrow">ScholarMate Style AI Workspace</Text>
                  <Title level={1} className="stigpt-brand-title">
                    {displayConfig.pageTitle}
                  </Title>
                  <Paragraph className="stigpt-brand-subtitle">
                    {displayConfig.welcomeMessage}
                  </Paragraph>
                </div>
              </div>
              <div className="stigpt-hero-tags">
                {routeModes.map((item) => (
                  <Tag
                    key={item.key}
                    color={item.key === selectedRouteMode ? ROUTE_MODE_COLORS[item.key] : 'default'}
                  >
                    {item.label}
                  </Tag>
                ))}
                <Tag color="cyan">SSE 流式回复</Tag>
                <Tag color="green">引用可追溯</Tag>
              </div>
            </div>

            {hasMessages ? (
              <div className="stigpt-thread-panel">{renderMessages()}</div>
            ) : (
              renderWelcomePanel()
            )}

            <div className="stigpt-composer-panel">
              <TextArea
                rows={hasMessages ? 5 : 4}
                value={draft}
                placeholder={displayConfig.inputPlaceholder}
                onChange={(event) => setDraft(event.target.value)}
                onPressEnter={(event) => {
                  if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    void handleSendMessage();
                  }
                }}
              />
              <div className="stigpt-composer-actions">
                <Text type="secondary">Ctrl / Cmd + Enter 发送</Text>
                {sending ? (
                  <Button icon={<StopOutlined />} onClick={handleStopStreaming}>
                    停止生成
                  </Button>
                ) : null}
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={sending}
                  onClick={() => void handleSendMessage()}
                >
                  发送
                </Button>
              </div>
            </div>

            <div className="stigpt-example-section">
              <div className="stigpt-example-head">
                <Text strong>你可以试着问我：</Text>
                <button
                  type="button"
                  className="stigpt-example-refresh"
                  onClick={() => setExampleBatch((current) => current + 1)}
                >
                  换一批
                </button>
              </div>
              <div className="stigpt-example-grid">
                {displayedExamples.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="stigpt-example-card"
                    onClick={() => setDraft(item.prompt)}
                  >
                    <div className="stigpt-example-card-title">
                      <MessageOutlined />
                      <span>{item.title}</span>
                    </div>
                    <div className="stigpt-example-card-body">{item.prompt}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="stigpt-disclaimer">
              AI 生成内容仅供参考，请结合原始文献、政策条款和人工判断使用。
            </div>
          </section>

          <aside className="stigpt-context-shell">
            <div className="stigpt-context-card mode">
              <div className="stigpt-context-card-head">
                <span>{ROUTE_MODE_ICONS[selectedRouteMode]}</span>
                <Text strong>当前工作模式</Text>
              </div>
              {!lockedRouteMode && routeModes.length > 1 ? (
                <Radio.Group
                  className="stigpt-mode-group"
                  value={selectedRouteMode}
                  onChange={(event) => setSelectedRouteMode(event.target.value)}
                >
                  <Space direction="vertical" className="stigpt-mode-stack">
                    {routeModes.map((item) => (
                      <Radio key={item.key} value={item.key}>
                        <Space direction="vertical" size={0}>
                          <Text strong>{item.label}</Text>
                          <Text type="secondary">{item.description}</Text>
                        </Space>
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              ) : (
                <Paragraph className="stigpt-context-description">
                  {selectedRouteModeDefinition.description}
                </Paragraph>
              )}
            </div>

            <div className="stigpt-context-card">
              <div className="stigpt-context-card-head">
                <DatabaseOutlined />
                <Text strong>知识库范围</Text>
              </div>
              {effectiveKnowledgeBase ? (
                <div className="stigpt-kb-summary">
                  <Text strong>{effectiveKnowledgeBase.name}</Text>
                  <Text type="secondary">
                    {effectiveKnowledgeBase.documentCount} 篇文档，
                    {effectiveKnowledgeBase.chunkCount} 个片段
                  </Text>
                </div>
              ) : (
                <Text type="secondary">默认按问题自动选择知识库</Text>
              )}
              {renderKnowledgeBaseSelector()}
            </div>

            <div className="stigpt-context-card">
              <div className="stigpt-context-card-head">
                <RobotOutlined />
                <Text strong>模型</Text>
              </div>
              <Radio.Group
                className="stigpt-model-group"
                value={selectedModelId || activeModel?.id}
                onChange={(event) => setSelectedModelId(event.target.value)}
              >
                <Space direction="vertical" className="stigpt-mode-stack">
                  {models.map((item) => (
                    <Radio key={item.id} value={item.id}>
                      <Space direction="vertical" size={0}>
                        <Text strong>{item.name}</Text>
                        <Text type="secondary">{item.description || item.code}</Text>
                      </Space>
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
              {models.length === 0 ? (
                <Text type="secondary">后端未返回可选模型，将使用默认服务配置。</Text>
              ) : null}
            </div>

            <div className="stigpt-context-card">
              <div className="stigpt-context-card-head">
                <FileSearchOutlined />
                <Text strong>回答策略</Text>
              </div>
              <ol className="stigpt-playbook-list">
                {ROUTE_MODE_PLAYBOOKS[selectedRouteMode].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>

            <div className="stigpt-context-card graph">
              <div className="stigpt-context-card-head">
                <ApartmentOutlined />
                <Text strong>知识图谱关联</Text>
              </div>
              <Paragraph>
                当前问答会把政策条款、项目主题、论文片段和引用文档视作可关联节点，
                为后续“学者-成果-项目-机构”图谱检索预留链路。
              </Paragraph>
              <Space size={[6, 6]} wrap>
                <Tag>政策节点</Tag>
                <Tag>文献节点</Tag>
                <Tag>项目节点</Tag>
                <Tag>引用边</Tag>
              </Space>
            </div>

            {latestAssistantMessage?.citations?.length ? (
              <div className="stigpt-context-card">
                <div className="stigpt-context-card-head">
                  <BookOutlined />
                  <Text strong>最近引用</Text>
                </div>
                <Space direction="vertical" size={8}>
                  {latestAssistantMessage.citations.slice(0, 3).map((item, index) => (
                    <button
                      key={`${item.chunkId}-${index}`}
                      type="button"
                      className="stigpt-mini-citation"
                      onClick={() => setInspectedCitation(item)}
                    >
                      <span>[{index + 1}]</span>
                      <Text>{item.documentTitle}</Text>
                    </button>
                  ))}
                </Space>
              </div>
            ) : null}
          </aside>
        </div>
      )}

      <Drawer
        width={480}
        title={inspectedCitation?.documentTitle || '引用详情'}
        open={Boolean(inspectedCitation)}
        onClose={() => setInspectedCitation(null)}
      >
        {inspectedCitation ? (
          <div className="stigpt-citation-drawer">
            <Space size={[8, 8]} wrap>
              <Tag color="processing">{`相关度 ${inspectedCitation.score.toFixed(3)}`}</Tag>
              <Tag>{`片段 ${inspectedCitation.chunkIndex}`}</Tag>
              <Tag>{inspectedCitation.documentId}</Tag>
            </Space>
            <Paragraph>{inspectedCitation.content}</Paragraph>
            <Text type="secondary">{inspectedCitation.chunkId}</Text>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};

export default StigptWebIdxPage;
