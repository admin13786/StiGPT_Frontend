import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, Card, Input, Tag } from 'antd';
import {
  ApartmentOutlined,
  AuditOutlined,
  BookOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  EditOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  MessageOutlined,
  ReadOutlined,
  RightOutlined,
  RobotOutlined,
  SearchOutlined,
  StarOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';
import './index.css';

const { TextArea } = Input;

type CategoryKey = 'all' | 'personal' | 'research' | 'ai' | 'collaboration';

type Category = {
  key: CategoryKey;
  label: string;
  count: number;
  icon: ReactNode;
};

type AppEntry = {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  path: string;
  category: CategoryKey;
  icon: ReactNode;
  tone: string;
  badge?: string;
};

type FeedItem = {
  key: string;
  source: string;
  title: string;
  content: string;
  time: string;
  path: string;
  tags: string[];
};

const categories: Category[] = [
  { key: 'all', label: '全部应用', count: 12, icon: <StarOutlined /> },
  { key: 'personal', label: '个人服务', count: 2, icon: <UserOutlined /> },
  { key: 'research', label: '科研管理', count: 3, icon: <BookOutlined /> },
  { key: 'ai', label: 'AI 科研助手', count: 5, icon: <RobotOutlined /> },
  { key: 'collaboration', label: '学术交流', count: 2, icon: <TeamOutlined /> },
];

const appEntries: AppEntry[] = [
  {
    key: 'profile',
    title: '个人主页',
    subtitle: 'Profile',
    description: '维护个人信息、研究方向、成果展示和科研身份名片。',
    path: '/apps/personal',
    category: 'personal',
    icon: <UserOutlined />,
    tone: 'tone-sky',
  },
  {
    key: 'library',
    title: '论文与文献',
    subtitle: 'Library',
    description: '集中管理收藏文献、阅读清单、写作来源和待引用资料。',
    path: '/apps/collect',
    category: 'research',
    icon: <FolderOpenOutlined />,
    tone: 'tone-green',
  },
  {
    key: 'graph',
    title: '学术图谱',
    subtitle: 'Scholar Graph',
    description: '查看论文、作者、机构、主题之间的知识关系网络。',
    path: '/apps/stigpt/graph',
    category: 'research',
    icon: <ApartmentOutlined />,
    tone: 'tone-indigo',
    badge: '图谱',
  },
  {
    key: 'ai-read',
    title: 'AI 阅读',
    subtitle: 'AI Read',
    description: '按问题、方法、证据和局限拆解论文与项目材料。',
    path: '/apps/stigpt/aiRead',
    category: 'ai',
    icon: <ReadOutlined />,
    tone: 'tone-teal',
  },
  {
    key: 'qa',
    title: 'AI 问答',
    subtitle: 'AI Q&A',
    description: '围绕政策、项目、论文和科研流程进行追问式对话。',
    path: '/apps/stigpt/webIdx',
    category: 'ai',
    icon: <MessageOutlined />,
    tone: 'tone-blue',
    badge: '常用',
  },
  {
    key: 'write',
    title: 'AI 写作',
    subtitle: 'AI Write',
    description: '生成提纲、章节、摘要、项目申请书和全文润色稿。',
    path: '/apps/stigpt/write',
    category: 'ai',
    icon: <EditOutlined />,
    tone: 'tone-orange',
    badge: '主流程',
  },
  {
    key: 'check',
    title: 'AI 检查',
    subtitle: 'AI Check',
    description: '检查相似风险、结构完整性、逻辑衔接和提交前问题。',
    path: '/apps/stigpt/check',
    category: 'ai',
    icon: <FileSearchOutlined />,
    tone: 'tone-red',
  },
  {
    key: 'review',
    title: 'AI 评审',
    subtitle: 'AI Review',
    description: '模拟专家评审，输出评分、拒稿风险和修改优先级。',
    path: '/apps/stigpt/review',
    category: 'ai',
    icon: <AuditOutlined />,
    tone: 'tone-gold',
  },
  {
    key: 'project',
    title: '项目与基金',
    subtitle: 'Projects',
    description: '管理项目申请、基金材料、评审意见和阶段性任务。',
    path: '/apps/stigpt/write/detail',
    category: 'research',
    icon: <FileTextOutlined />,
    tone: 'tone-emerald',
  },
  {
    key: 'contacts',
    title: '联系人',
    subtitle: 'Contacts',
    description: '沉淀合作学者、机构联系人和潜在合作关系。',
    path: '/apps/contact',
    category: 'collaboration',
    icon: <UserAddOutlined />,
    tone: 'tone-violet',
  },
  {
    key: 'groups',
    title: '项目组',
    subtitle: 'Groups',
    description: '组织课题组、项目协作空间和共享科研动态。',
    path: '/apps/groups',
    category: 'collaboration',
    icon: <TeamOutlined />,
    tone: 'tone-cyan',
  },
  {
    key: 'insight',
    title: '科研灵感',
    subtitle: 'Insight',
    description: '从文献、图谱和评审反馈中整理下一步研究问题。',
    path: '/apps/ai-hub',
    category: 'personal',
    icon: <BulbOutlined />,
    tone: 'tone-lime',
  },
];

const feedItems: FeedItem[] = [
  {
    key: 'feed-1',
    source: 'AI 检查',
    title: '论文初稿检查已完成',
    content:
      '《多模态知识图谱辅助科研写作》初稿发现 3 处待复核段落，建议先处理低置信命中后再进入投稿流程。',
    time: '10 分钟前',
    path: '/apps/stigpt/check',
    tags: ['检查报告', '提交前风险'],
  },
  {
    key: 'feed-2',
    source: 'AI 写作',
    title: '青年基金申请书已推进到第二章',
    content:
      '系统已根据研究目标与技术路线生成章节草稿，可继续补充创新点和预期成果。',
    time: '38 分钟前',
    path: '/apps/stigpt/write',
    tags: ['项目申请', '章节草稿'],
  },
  {
    key: 'feed-3',
    source: 'AI 评审',
    title: '项目评审建议：修改后通过',
    content:
      '最低分维度集中在创新表达与证据完整性，建议先生成整改提纲，再回流到写作页面修订。',
    time: '1 小时前',
    path: '/apps/stigpt/review',
    tags: ['评审意见', '整改建议'],
  },
];

const scholars = [
  {
    name: '韩书安',
    field: '医学知识图谱',
    reason: '与你最近的论文主题高度相关',
    initials: '韩书',
  },
  {
    name: '刘文伟',
    field: '教育数据分析',
    reason: '近期发布了相近方向的新成果',
    initials: '刘文',
  },
  {
    name: '钱天一',
    field: '科研写作方法',
    reason: '适合加入写作与评审讨论',
    initials: '钱天',
  },
];

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');
  const [keyword, setKeyword] = useState('');
  const [composer, setComposer] = useState('');
  const [localFeedItems, setLocalFeedItems] = useState(feedItems);

  const profileName = getDisplayName(user?.realName, user?.username);
  const initials = useMemo(() => profileName.slice(0, 2).toUpperCase(), [profileName]);

  const filteredApps = appEntries.filter((item) => {
    const categoryMatched = activeCategory === 'all' || item.category === activeCategory;
    const normalizedKeyword = keyword.trim().toLowerCase();
    const keywordMatched =
      !normalizedKeyword ||
      `${item.title} ${item.subtitle} ${item.description}`.toLowerCase().includes(normalizedKeyword);
    return categoryMatched && keywordMatched;
  });

  const handlePublish = () => {
    const nextContent = composer.trim();
    if (!nextContent) return;

    setLocalFeedItems((current) => [
      {
        key: `feed-local-${Date.now()}`,
        source: profileName,
        title: '发布了一条新的科研动态',
        content: nextContent,
        time: '刚刚',
        path: '/apps/ai-hub',
        tags: ['我的记录'],
      },
      ...current,
    ]);
    setComposer('');
  };

  return (
    <div className="home-page-scholar">
      <aside className="home-sidebar">
        <Card className="sm-card profile-card" variant="borderless">
          <div className="profile-header">
            <Avatar size={58} className="profile-avatar">
              {initials}
            </Avatar>
            <div>
              <div className="profile-name">{profileName}</div>
              <div className="profile-subtitle">科研之友应用中心</div>
            </div>
          </div>
          <div className="profile-stats">
            <div><strong>12</strong><span>收藏文献</span></div>
            <div><strong>5</strong><span>项目组</span></div>
            <div><strong>3</strong><span>待办</span></div>
          </div>
        </Card>

        <Card className="sm-card category-card" variant="borderless">
          <div className="panel-title">应用分类</div>
          <div className="category-list">
            {categories.map((category) => (
              <button
                key={category.key}
                type="button"
                className={`category-item ${activeCategory === category.key ? 'category-item-active' : ''}`}
                onClick={() => setActiveCategory(category.key)}
              >
                <span className="category-icon">{category.icon}</span>
                <span className="category-label">{category.label}</span>
                <span className="category-count">{category.count}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="sm-card ai-entry-card" variant="borderless" onClick={() => navigate('/apps/ai-hub')}>
          <RobotOutlined className="ai-entry-icon" />
          <div>
            <div className="ai-entry-title">科研之友 AI</div>
            <div className="ai-entry-desc">问答、写作、检查、评审一站式入口</div>
          </div>
          <RightOutlined />
        </Card>
      </aside>

      <main className="home-main">
        <section className="apps-hero">
          <div className="apps-hero-copy">
            <span className="apps-hero-kicker">ScholarMate Apps</span>
            <h1>科研之友应用中心</h1>
            <p>
              把个人主页、文献管理、项目协作、学术图谱和 AI 科研助手集中到一个工作台，
              让写作、检查、评审和知识组织形成连续链路。
            </p>
            <div className="apps-hero-tags">
              <Tag bordered={false}>应用卡片</Tag>
              <Tag bordered={false}>科研流程</Tag>
              <Tag bordered={false}>AI 增强</Tag>
            </div>
          </div>
          <div className="apps-hero-actions">
            <Button type="primary" size="large" onClick={() => navigate('/apps/stigpt/webIdx')}>
              进入 AI 问答
            </Button>
            <Button size="large" onClick={() => navigate('/apps/stigpt/write')}>
              继续 AI 写作
            </Button>
          </div>
        </section>

        <Card className="sm-card apps-catalog-card" variant="borderless">
          <div className="apps-catalog-head">
            <div>
              <div className="panel-title">全部应用</div>
              <div className="panel-subtitle">
                按科研之友常见工作流组织：个人服务、科研管理、AI 助手、学术交流。
              </div>
            </div>
            <Input
              className="apps-search"
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索应用、论文、项目或 AI 工具"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>

          <div className="app-grid">
            {filteredApps.map((app) => (
              <button key={app.key} type="button" className="app-card" onClick={() => navigate(app.path)}>
                <span className={`app-icon ${app.tone}`}>{app.icon}</span>
                <span className="app-card-copy">
                  <span className="app-card-title-row">
                    <span className="app-card-title">{app.title}</span>
                    {app.badge ? <span className="app-badge">{app.badge}</span> : null}
                  </span>
                  <span className="app-card-subtitle">{app.subtitle}</span>
                  <span className="app-card-desc">{app.description}</span>
                </span>
                <RightOutlined className="app-card-arrow" />
              </button>
            ))}
          </div>
        </Card>

        <Card className="sm-card feed-card" variant="borderless">
          <div className="panel-title">科研动态</div>
          <div className="composer-box">
            <Avatar className="composer-avatar">{initials}</Avatar>
            <div className="composer-editor">
              <TextArea
                value={composer}
                onChange={(event) => setComposer(event.target.value.slice(0, 300))}
                autoSize={{ minRows: 3, maxRows: 5 }}
                placeholder="记录研究进展、协作提醒，或把新的写作任务加入动态流..."
              />
              <div className="composer-footer">
                <span>{composer.length} / 300</span>
                <Button type="primary" disabled={!composer.trim()} onClick={handlePublish}>
                  发布
                </Button>
              </div>
            </div>
          </div>

          <div className="feed-list">
            {localFeedItems.map((item) => (
              <article key={item.key} className="feed-item">
                <div className="feed-item-head">
                  <span className="feed-source">{item.source}</span>
                  <span className="feed-time">
                    <ClockCircleOutlined /> {item.time}
                  </span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.content}</p>
                <div className="feed-tags">
                  {item.tags.map((tag) => (
                    <Tag key={tag} bordered={false}>{tag}</Tag>
                  ))}
                </div>
                <Button size="small" onClick={() => navigate(item.path)}>
                  查看详情
                </Button>
              </article>
            ))}
          </div>
        </Card>
      </main>

      <aside className="home-aside">
        <Card className="sm-card todo-card" variant="borderless">
          <div className="panel-title">待办提醒</div>
          <button type="button" className="todo-item" onClick={() => navigate('/apps/stigpt/write')}>
            <strong>完善青年基金申请书</strong>
            <span>今天 18:00 前补齐研究目标与创新点。</span>
          </button>
          <button type="button" className="todo-item" onClick={() => navigate('/apps/stigpt/review')}>
            <strong>处理论文评审结论</strong>
            <span>根据 AI 评审生成整改提纲。</span>
          </button>
          <button type="button" className="todo-item" onClick={() => navigate('/apps/stigpt/graph')}>
            <strong>补充引用关系核验</strong>
            <span>提交前确认核心文献和作者机构关系。</span>
          </button>
        </Card>

        <Card className="sm-card scholars-card" variant="borderless">
          <div className="panel-title">相关学者</div>
          <div className="scholar-list">
            {scholars.map((scholar) => (
              <div key={scholar.name} className="scholar-item">
                <Avatar className="scholar-avatar">{scholar.initials}</Avatar>
                <div className="scholar-copy">
                  <strong>{scholar.name}</strong>
                  <span>{scholar.field}</span>
                  <p>{scholar.reason}</p>
                </div>
                <Button size="small" onClick={() => navigate('/apps/contact')}>关注</Button>
              </div>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
};

export default HomePage;

function getDisplayName(realName?: string, username?: string) {
  const primary = realName?.trim();
  if (primary && !/^\?+$/.test(primary)) {
    return primary;
  }

  const fallback = username?.trim();
  if (fallback && !/^\?+$/.test(fallback)) {
    return fallback;
  }

  return '科研用户';
}
