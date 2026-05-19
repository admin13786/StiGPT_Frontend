/**
 * 项目组页面 - 左侧筛选 + 右侧列表
 */
import { useState } from 'react';
import { Input, Empty, Button, Select } from 'antd';
import {
  FolderOutlined,
  SearchOutlined,
  PlusOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import '../AIWrite/index.css';
import './index.css';

type RoleFilter = 'all' | 'owner' | 'member';

const GroupsPage = () => {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [searchText, setSearchText] = useState('');

  const roleItems = [
    { key: 'all' as RoleFilter, label: '全部' },
    { key: 'owner' as RoleFilter, label: '我负责的' },
    { key: 'member' as RoleFilter, label: '我参与的' },
  ];

  return (
    <div className="ai-page-layout">
      <div className="ai-page-sidebar">
        <div className="ai-sidebar-nav">
          <div className="ai-sidebar-filter-title" style={{ padding: '8px 14px' }}>角色筛选</div>
          {roleItems.map((item) => (
            <div
              key={item.key}
              className={`ai-sidebar-nav-item ${roleFilter === item.key ? 'ai-sidebar-nav-item-active' : ''}`}
              onClick={() => setRoleFilter(item.key)}
            >
              {item.label}
            </div>
          ))}
        </div>
        <div className="ai-sidebar-filter">
          <div className="ai-sidebar-filter-title">研究领域</div>
          <div className="ai-sidebar-filter-item">计算机科学</div>
          <div className="ai-sidebar-filter-item">人工智能</div>
          <div className="ai-sidebar-filter-item">生物医学</div>
          <div className="ai-sidebar-filter-item">材料科学</div>
        </div>
      </div>

      <div className="ai-page-content">
        <div className="ai-content-header">
          <h2 className="ai-content-title">我的项目组</h2>
          <div className="ai-content-toolbar">
            <Input
              placeholder="项目组名称"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="ai-search-input"
              allowClear
            />
            <Select defaultValue="recent" style={{ width: 120 }} options={[
              { value: 'recent', label: '最近访问' },
              { value: 'name', label: '名称排序' },
              { value: 'created', label: '创建时间' },
            ]} />
            <Button type="primary" icon={<PlusOutlined />}>
              创建项目组
            </Button>
          </div>
        </div>

        <div className="groups-empty">
          <Empty
            image={<FolderOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
            description="暂无项目组，创建一个开始协作吧"
          >
            <Button type="primary" icon={<PlusOutlined />}>
              创建项目组
            </Button>
          </Empty>
        </div>
      </div>
    </div>
  );
};

export default GroupsPage;
