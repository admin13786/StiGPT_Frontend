import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Badge, Dropdown, Input } from 'antd';
import type { MenuProps } from 'antd';
import {
  ApartmentOutlined,
  AuditOutlined,
  BellOutlined,
  BookOutlined,
  FileSearchOutlined,
  FolderOutlined,
  HomeOutlined,
  MailOutlined,
  MenuOutlined,
  MoreOutlined,
  ReadOutlined,
  RobotOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import './MainLayout.css';

type NavItem = {
  key: string;
  label: string;
  icon: ReactNode;
  matchPaths: string[];
  exact?: boolean;
  description?: string;
};

const primaryNavItems: NavItem[] = [
  {
    key: '/apps',
    label: '首页',
    icon: <HomeOutlined />,
    matchPaths: ['/', '/apps'],
    exact: true,
  },
  {
    key: '/apps/personal',
    label: '我的',
    icon: <UserOutlined />,
    matchPaths: ['/profile', '/apps/personal'],
  },
  {
    key: '/apps/contact',
    label: '联系人',
    icon: <MailOutlined />,
    matchPaths: ['/contacts', '/apps/contact'],
  },
  {
    key: '/apps/groups',
    label: '项目组',
    icon: <TeamOutlined />,
    matchPaths: ['/groups', '/apps/groups'],
  },
  {
    key: '/apps/ai-hub',
    label: 'AI 工作台',
    icon: <RobotOutlined />,
    matchPaths: ['/apps/ai-hub', '/apps/stigpt', '/stigpt'],
  },
];

const moreNavItems: NavItem[] = [
  {
    key: '/apps/stigpt/write',
    label: 'AI 写作',
    icon: <BookOutlined />,
    matchPaths: ['/apps/stigpt/write', '/ai/write'],
    description: '生成提纲、章节、全文草稿和项目申请材料。',
  },
  {
    key: '/apps/stigpt/check',
    label: 'AI 检查',
    icon: <FileSearchOutlined />,
    matchPaths: ['/apps/stigpt/check', '/ai/check'],
    description: '检查相似风险、结构完整性、逻辑衔接与提交前问题。',
  },
  {
    key: '/apps/stigpt/review',
    label: 'AI 评审',
    icon: <AuditOutlined />,
    matchPaths: ['/apps/stigpt/review', '/ai/review'],
    description: '模拟专家评审，输出评分、风险点和修改建议。',
  },
  {
    key: '/apps/stigpt/answer/policy',
    label: '政策问答',
    icon: <ReadOutlined />,
    matchPaths: ['/apps/stigpt/answer/policy'],
    description: '围绕基金政策、申报资格、时间节点和条款口径进行解读。',
  },
  {
    key: '/apps/stigpt/aiRead',
    label: 'AI 阅读',
    icon: <FolderOutlined />,
    matchPaths: ['/apps/stigpt/aiRead'],
    description: '按问题、方法、证据与局限拆解论文和文档。',
  },
  {
    key: '/apps/stigpt/graph',
    label: '学术图谱',
    icon: <ApartmentOutlined />,
    matchPaths: ['/apps/stigpt/graph'],
    description: '查看论文、作者、机构和主题之间的关系网络。',
  },
  {
    key: '/apps/collect',
    label: '论文与文献',
    icon: <FolderOutlined />,
    matchPaths: ['/library', '/apps/collect'],
    description: '管理收藏文献、写作资料和常用阅读清单。',
  },
];

const footerColumns = [
  {
    title: '产品服务',
    links: ['科研之友 Apps', '科研工具箱', '学术图谱', '基金项目服务'],
  },
  {
    title: '帮助支持',
    links: ['帮助中心', '常见问题', '隐私政策', '服务条款'],
  },
  {
    title: '关于我们',
    links: ['平台介绍', '机构合作', '开放平台', '联系我们'],
  },
  {
    title: '联系方式',
    links: ['产品反馈', '使用指南', '更新日志'],
  },
];

const footerBottomLinks = ['科研成果', '科研人员', '科研机构', '科研动态', '基金信息', '学术服务'];

const matchesPath = (pathname: string, item: NavItem) =>
  item.matchPaths.some((path) => {
    if (item.exact) {
      return pathname === path;
    }

    return pathname === path || pathname.startsWith(`${path}/`);
  });

const renderDropdownLabel = (item: NavItem) => (
  <div className="nav-dropdown-item">
    <span className="nav-dropdown-title">{item.label}</span>
    {item.description ? <span className="nav-dropdown-desc">{item.description}</span> : null}
  </div>
);

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const showFooter = !location.pathname.startsWith('/apps');

  const displayName = getDisplayName(user?.realName, user?.username);
  const initials = useMemo(() => displayName.slice(0, 2).toUpperCase(), [displayName]);

  const primaryActive = primaryNavItems.find((item) => matchesPath(location.pathname, item))?.key;
  const moreActive = moreNavItems.some((item) => matchesPath(location.pathname, item));

  const moreMenu: MenuProps = {
    items: moreNavItems.map((item) => ({
      key: item.key,
      icon: item.icon,
      label: renderDropdownLabel(item),
    })),
    onClick: ({ key }) => navigate(key),
  };

  const profileMenu: MenuProps = {
    items: [
      {
        key: 'profile',
        label: '个人中心',
        icon: <UserOutlined />,
      },
      {
        key: 'logout',
        label: '退出登录',
        danger: true,
      },
    ],
    onClick: ({ key }) => {
      if (key === 'profile') {
        navigate('/apps/personal');
      }

      if (key === 'logout') {
        logout();
        navigate('/login');
      }
    },
  };

  return (
    <div className="main-layout">
      <header className="top-navbar scholar-top-navbar">
        <div className="navbar-inner scholar-navbar-inner">
          <div className="navbar-brand" onClick={() => navigate('/apps')}>
            <span className="brand-mark" aria-hidden="true">
              <span className="brand-mark-dot" />
            </span>
            <span className="brand-copy">
              <span className="brand-text">科研之友</span>
              <span className="brand-subtext">Apps</span>
            </span>
          </div>

          <div className="navbar-search">
            <Input
              placeholder="搜索论文、学者、机构、项目组"
              prefix={<SearchOutlined className="navbar-search-icon" />}
              suffix={<span className="navbar-search-hotkey">回车搜索</span>}
              onPressEnter={() => navigate('/apps/stigpt/graph')}
            />
          </div>

          <nav className="navbar-nav scholar-navbar-nav">
            {primaryNavItems.map((item) => {
              const active = primaryActive === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`scholar-nav-item ${active ? 'scholar-nav-item-active' : ''}`}
                  onClick={() => navigate(item.key)}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}

            <Dropdown menu={moreMenu} placement="bottomLeft" trigger={['click']}>
              <button
                type="button"
                className={`scholar-nav-item ${moreActive ? 'scholar-nav-item-active-soft' : ''}`}
              >
                <span>更多</span>
                <MoreOutlined className="scholar-nav-more-icon" />
              </button>
            </Dropdown>
          </nav>

          <div className="navbar-right scholar-navbar-right">
            <Badge count={0} size="small">
              <button type="button" className="navbar-action-btn" onClick={() => navigate('/apps/contact')}>
                <MailOutlined />
              </button>
            </Badge>

            <button type="button" className="navbar-action-btn" onClick={() => navigate('/apps/collect')}>
              <BellOutlined />
            </button>

            <Dropdown menu={profileMenu} placement="bottomRight" trigger={['click']}>
              <button type="button" className="navbar-profile-btn">
                <Avatar className="navbar-avatar scholar-avatar">{initials}</Avatar>
              </button>
            </Dropdown>

            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <MenuOutlined />
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-menu-header">导航</div>

            <div className="mobile-menu-section-title">主要功能</div>
            {primaryNavItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`mobile-menu-item ${matchesPath(location.pathname, item) ? 'mobile-menu-item-active' : ''}`}
                onClick={() => {
                  navigate(item.key);
                  setMobileMenuOpen(false);
                }}
              >
                {item.icon}
                <span className="mobile-menu-item-copy">
                  <span className="mobile-menu-item-title">{item.label}</span>
                </span>
              </button>
            ))}

            <div className="mobile-menu-divider" />

            <div className="mobile-menu-section-title">更多工具</div>
            {moreNavItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`mobile-menu-item ${matchesPath(location.pathname, item) ? 'mobile-menu-item-active' : ''}`}
                onClick={() => {
                  navigate(item.key);
                  setMobileMenuOpen(false);
                }}
              >
                {item.icon}
                <span className="mobile-menu-item-copy">
                  <span className="mobile-menu-item-title">{item.label}</span>
                  {item.description ? <span className="mobile-menu-item-desc">{item.description}</span> : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <main className="main-content scholar-main-content">
        <Outlet />
      </main>

      {showFooter ? (
        <footer className="scholar-footer">
          <div className="scholar-footer-inner">
            <div className="scholar-footer-columns">
              {footerColumns.map((column) => (
                <div key={column.title} className="scholar-footer-column">
                  <div className="scholar-footer-title">{column.title}</div>
                  <div className="scholar-footer-links">
                    {column.links.map((link) => (
                      <span key={link} className="scholar-footer-link">
                        {link}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="scholar-footer-bottom">
              <div className="scholar-footer-bottom-links">
                {footerBottomLinks.map((link) => (
                  <span key={link}>{link}</span>
                ))}
              </div>
              <div className="scholar-footer-bottom-copy">
                © 2026 科研之友 Apps. 智能科研工作台。
              </div>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
};

export default MainLayout;

function getDisplayName(realName?: string, username?: string) {
  const primary = realName?.trim();
  if (primary && !/^\?+$/.test(primary)) {
    return primary;
  }

  const fallback = username?.trim();
  if (fallback && !/^\?+$/.test(fallback)) {
    return fallback;
  }

  return '科研';
}
