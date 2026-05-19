/**
 * 个人主页 - 用户信息 + Tab导航
 */
import { useState } from 'react';
import { Avatar, Card, Tabs, Tag, Empty, Button } from 'antd';
import {
  UserOutlined,
  EditOutlined,
  ProjectOutlined,
  FileTextOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import './index.css';

const ProfilePage = () => {
  const [activeTab, setActiveTab] = useState('profile');

  const stats = [
    { label: '项目', value: 0 },
    { label: '论文', value: 0 },
    { label: '引用', value: 0 },
    { label: 'H 指数', value: 0 },
  ];

  const tabItems = [
    {
      key: 'profile',
      label: '个人主页',
      icon: <UserOutlined />,
      children: (
        <div className="profile-section">
          <div className="profile-field">
            <div className="profile-field-label">研究方向</div>
            <div className="profile-field-value empty">未填写</div>
          </div>
          <div className="profile-field">
            <div className="profile-field-label">学科领域</div>
            <div className="profile-field-value empty">未填写</div>
          </div>
          <div className="profile-field">
            <div className="profile-field-label">关键词</div>
            <div className="profile-field-value empty">未填写</div>
          </div>
          <div className="profile-field">
            <div className="profile-field-label">个人简介</div>
            <div className="profile-field-value empty">未填写</div>
          </div>
          <div className="profile-field">
            <div className="profile-field-label">教育经历</div>
            <div className="profile-field-value empty">未添加</div>
          </div>
        </div>
      ),
    },
    {
      key: 'projects',
      label: '科研项目',
      icon: <ProjectOutlined />,
      children: <Empty description="暂无科研项目" />,
    },
    {
      key: 'results',
      label: '科研成果',
      icon: <FileTextOutlined />,
      children: <Empty description="暂无科研成果" />,
    },
    {
      key: 'impact',
      label: '影响力',
      icon: <RiseOutlined />,
      children: <Empty description="暂无影响力数据" />,
    },
  ];

  return (
    <div className="profile-page">
      {/* 个人信息卡片 */}
      <Card className="profile-header-card">
        <div className="profile-header">
          <Avatar size={80} icon={<UserOutlined />} className="profile-avatar" />
          <div className="profile-header-info">
            <div className="profile-header-name">
              科研用户
              <Button type="text" icon={<EditOutlined />} size="small" />
            </div>
            <div className="profile-header-meta">科研之友工作台用户</div>
          </div>
          <div className="profile-stats">
            {stats.map((s) => (
              <div key={s.label} className="profile-stat-item">
                <div className="profile-stat-value">{s.value}</div>
                <div className="profile-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Tab内容 */}
      <Card className="profile-content-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>
    </div>
  );
};

export default ProfilePage;
