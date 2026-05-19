/**
 * 联系人页面 - 左侧导航 + 右侧列表
 */
import { useState } from 'react';
import { Input, Empty, Button } from 'antd';
import {
  TeamOutlined,
  UserAddOutlined,
  BulbOutlined,
  InboxOutlined,
  SearchOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import '../AIWrite/index.css';
import './index.css';

type ContactNav = 'all' | 'recommend' | 'requests' | 'add';

const ContactsPage = () => {
  const [activeNav, setActiveNav] = useState<ContactNav>('all');
  const [searchText, setSearchText] = useState('');

  const navItems = [
    { key: 'all' as ContactNav, label: '全部联系人', icon: <TeamOutlined /> },
    { key: 'recommend' as ContactNav, label: '联系人推荐', icon: <BulbOutlined /> },
    { key: 'requests' as ContactNav, label: '联系人请求', icon: <InboxOutlined /> },
    { key: 'add' as ContactNav, label: '新增联系人', icon: <UserAddOutlined /> },
  ];

  return (
    <div className="ai-page-layout">
      <div className="ai-page-sidebar">
        <div className="ai-sidebar-nav">
          {navItems.map((item) => (
            <div
              key={item.key}
              className={`ai-sidebar-nav-item ${activeNav === item.key ? 'ai-sidebar-nav-item-active' : ''}`}
              onClick={() => setActiveNav(item.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {item.icon}
              {item.label}
            </div>
          ))}
        </div>
      </div>

      <div className="ai-page-content">
        <div className="ai-content-header">
          <h2 className="ai-content-title">
            {navItems.find((n) => n.key === activeNav)?.label}
          </h2>
          <div className="ai-content-toolbar">
            <Input
              placeholder="输入联系人姓名"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="ai-search-input"
              allowClear
            />
          </div>
        </div>

        <div className="contacts-empty">
          <Empty
            image={<TeamOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
            description="暂无联系人，开始添加你的学术联系人吧"
          >
            <Button type="primary" icon={<PlusOutlined />}>
              添加联系人
            </Button>
          </Empty>
        </div>
      </div>
    </div>
  );
};

export default ContactsPage;
