import { useState, useEffect } from 'react';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Button,
} from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  BookOutlined,
  MessageOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
  ApiOutlined,
  ExperimentOutlined,
  DatabaseOutlined,
  EditOutlined,
  FileSearchOutlined,
  AuditOutlined,
  RobotOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useSessionStore } from '../../stores/sessionStore';
import { resolveAvatarUrl } from '../../utils/avatar';
import { Badge } from 'antd';
import './MainLayout.css';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { getTotalUnread } = useSessionStore();
  const isAdmin = user?.role === 'ADMIN';
  const totalUnread = getTotalUnread();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 菜单项 — 按功能分组
  const menuItems = [
    // ── 概览 ──
    {
      type: 'group' as const,
      label: collapsed ? '' : '概览',
      children: [
        isAdmin && {
          key: '/dashboard',
          icon: <DashboardOutlined />,
          label: '仪表盘',
        },
        {
          key: '/workbench/active',
          icon: <DesktopOutlined />,
          label: (
            <span>
              工作台
              {totalUnread > 0 && (
                <Badge count={totalUnread} size="small" style={{ marginLeft: 10 }} overflowCount={99} />
              )}
            </span>
          ),
        },
      ].filter(Boolean),
    },
    // ── 科研管理 ──
    {
      type: 'group' as const,
      label: collapsed ? '' : '科研管理',
      children: [
        {
          key: '/knowledge',
          icon: <DatabaseOutlined />,
          label: '知识库',
        },
        isAdmin && {
          key: '/papers',
          icon: <BookOutlined />,
          label: '论文库',
        },
      ].filter(Boolean),
    },
    // ── AI 功能 ──
    {
      type: 'group' as const,
      label: collapsed ? '' : 'AI 功能',
      children: [
        {
          key: '/ai-features',
          icon: <RobotOutlined />,
          label: 'AI 功能概览',
          children: [
            { key: '/ai-features/write', icon: <EditOutlined />, label: 'AI 写作' },
            { key: '/ai-features/check', icon: <FileSearchOutlined />, label: 'AI 检查' },
            { key: '/ai-features/review', icon: <AuditOutlined />, label: 'AI 评审' },
          ],
        },
      ],
    },
    // ── 业务管理 ──
    {
      type: 'group' as const,
      label: collapsed ? '' : '业务管理',
      children: [
        {
          key: '/tickets',
          icon: <FileTextOutlined />,
          label: '工单管理',
        },
        {
          key: '/sessions',
          icon: <MessageOutlined />,
          label: '会话管理',
        },
      ],
    },
    // ── 系统管理 ──
    isAdmin && {
      type: 'group' as const,
      label: collapsed ? '' : '系统管理',
      children: [
        {
          key: '/users',
          icon: <TeamOutlined />,
          label: '用户管理',
        },
        {
          key: '/model-config',
          icon: <ApiOutlined />,
          label: 'API 管理',
        },
        {
          key: '/settings',
          icon: <SettingOutlined />,
          label: '系统设置',
          children: [
            { key: '/settings/urgency-rules', label: '问题类型规则' },
            { key: '/settings/quick-replies', label: '快捷回复管理' },
          ],
        },
      ],
    },
  ].filter(Boolean) as any[];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    if (isMobile) setMobileMenuOpen(false);
  };

  const handleToggleMenu = () => {
    if (isMobile) setMobileMenuOpen(!mobileMenuOpen);
    else setCollapsed(!collapsed);
  };

  const handleOverlayClick = () => {
    if (isMobile) setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    const { websocketService } = await import('../../services/websocket.service');
    websocketService.disconnect();
    logout();
    navigate('/login');
  };

  const getSelectedKeys = () => {
    const path = location.pathname;
    // 精确匹配子路由
    const allKeys = [
      '/dashboard', '/workbench/active', '/knowledge', '/papers',
      '/ai-features/write', '/ai-features/check', '/ai-features/review',
      '/tickets', '/sessions', '/users', '/model-config',
      '/settings/urgency-rules', '/settings/quick-replies',
      '/profile',
    ];
    for (const key of allKeys) {
      if (path.startsWith(key)) return [key];
    }
    return ['/dashboard'];
  };

  const getOpenKeys = () => {
    const path = location.pathname;
    const keys: string[] = [];
    if (path.startsWith('/ai-features')) keys.push('/ai-features');
    if (path.startsWith('/settings')) keys.push('/settings');
    return keys;
  };

  return (
    <Layout className="main-layout" style={{ minHeight: '100vh' }}>
      {isMobile && mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={handleOverlayClick}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }}
        />
      )}

      <Sider trigger={null} collapsible collapsed={collapsed} width={220}
        className={`layout-sider ${isMobile && mobileMenuOpen ? 'mobile-open' : ''}`}
        style={{
          position: 'fixed', left: isMobile ? (mobileMenuOpen ? 0 : -220) : 0,
          top: 0, height: '100vh', overflow: 'auto', transition: 'left 0.3s ease', zIndex: 1000,
        }}
      >
        <div className="sider-logo" onClick={() => navigate('/')}>
          <div className="sider-logo-icon">
            <ExperimentOutlined />
          </div>
          {!collapsed && <span className="sider-logo-text">科研之友AI</span>}
        </div>

        <Menu theme="dark" mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>

      <Layout className="site-layout"
        style={{ marginLeft: isMobile ? 0 : (collapsed ? 80 : 220), transition: 'margin-left 0.2s' }}
      >
        <Header className="layout-header">
          <div className="header-left">
            <Button className="trigger" type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={handleToggleMenu}
            />
          </div>
          <div className="header-right">
            <Dropdown
              menu={{
                items: [
                  { key: 'profile', icon: <UserOutlined />, label: '个人资料', onClick: () => navigate('/profile') },
                  { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
                ],
              }}
              placement="bottomRight" arrow
            >
              <div className="header-user-info">
                <Avatar size={32} icon={<UserOutlined />} src={resolveAvatarUrl(user?.avatar)} />
                <div className="header-user-details">
                  <span className="header-username">{user?.username}</span>
                  <span className="header-user-role">{user?.role === 'ADMIN' ? '管理员' : '成员'}</span>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content className="layout-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
