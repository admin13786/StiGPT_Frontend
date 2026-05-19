import type { StigptRouteModeKey } from '../types/stigpt';

export interface StigptRouteSurface {
  routeKey: string;
  canonicalPath: string;
  legacyPath: string;
  title: string;
  description: string;
  assistantName: string;
  welcomeMessage: string;
  inputPlaceholder: string;
  defaultRouteMode: StigptRouteModeKey;
  lockedRouteMode?: StigptRouteModeKey;
}

export const STIGPT_ROUTE_SURFACES: StigptRouteSurface[] = [
  {
    routeKey: 'webIdx',
    canonicalPath: '/apps/stigpt/webIdx',
    legacyPath: '/stigpt/webIdx',
    title: '科研之友 AI 问答',
    description:
      '统一的科研智能问答入口，面向基金政策、项目申报、论文阅读和知识库检索。',
    assistantName: '科研之友 AI',
    welcomeMessage:
      '你好，我是科研之友 AI。你可以围绕基金政策、项目论证、论文阅读、知识库资料和科研协作流程向我提问。',
    inputPlaceholder:
      '请输入你想了解的政策、项目方案、论文解读或知识库问题，例如：青年基金申请书最容易被评审质疑的点有哪些？',
    defaultRouteMode: 'policy',
  },
  {
    routeKey: 'answer/policy',
    canonicalPath: '/apps/stigpt/answer/policy',
    legacyPath: '/stigpt/answer/policy',
    title: '政策问答',
    description: '聚焦基金政策、申报规则、资格边界、时间节点和官方口径。',
    assistantName: '政策问答助手',
    welcomeMessage:
      '当前模式聚焦政策规则、资格限制、指南口径与官方时间安排，回答会优先按事实、条款和可执行清单组织。',
    inputPlaceholder:
      '例如：面上项目对申请人职称和在研项目数量有什么限制？',
    defaultRouteMode: 'policy',
    lockedRouteMode: 'policy',
  },
  {
    routeKey: 'answer/project',
    canonicalPath: '/apps/stigpt/answer/project',
    legacyPath: '/stigpt/answer/project',
    title: '项目辅导',
    description: '聚焦选题凝练、创新点表达、技术路线设计和评审风险梳理。',
    assistantName: '项目辅导助手',
    welcomeMessage:
      '当前模式适合做项目论证、创新表达、路线重构和评审风险分析，回答会更偏评审视角。',
    inputPlaceholder:
      '例如：我的申请书创新点偏弱，应该怎样重构研究目标和技术路线？',
    defaultRouteMode: 'project',
    lockedRouteMode: 'project',
  },
  {
    routeKey: 'aiRead',
    canonicalPath: '/apps/stigpt/aiRead',
    legacyPath: '/stigpt/aiRead',
    title: 'AI 阅读',
    description: '聚焦论文与文档阅读，提炼问题、方法、证据、局限和可复用启发。',
    assistantName: 'AI 阅读助手',
    welcomeMessage:
      '当前模式适合论文精读、方法对比、证据提取与阅读笔记沉淀，回答会优先保持可追溯性。',
    inputPlaceholder:
      '例如：请按研究问题、方法、实验、局限四个维度解读这篇论文。',
    defaultRouteMode: 'aiRead',
    lockedRouteMode: 'aiRead',
  },
];

export const DEFAULT_STIGPT_ROUTE_SURFACE = STIGPT_ROUTE_SURFACES[0];

export const getStigptRouteSurfaceByRouteKey = (routeKey?: string) =>
  STIGPT_ROUTE_SURFACES.find((surface) => surface.routeKey === routeKey) ||
  DEFAULT_STIGPT_ROUTE_SURFACE;

export const getStigptRouteSurfaceByPath = (pathname: string) =>
  STIGPT_ROUTE_SURFACES.find((surface) => {
    const candidates = [surface.canonicalPath, surface.legacyPath];
    return candidates.some(
      (candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`),
    );
  }) || DEFAULT_STIGPT_ROUTE_SURFACE;
