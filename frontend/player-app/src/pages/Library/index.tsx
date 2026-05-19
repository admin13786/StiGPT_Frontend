/**
 * 文献库页面 - 收藏的学术文献
 */
import { useState } from 'react';
import { Input, Table, Empty, Button, Select } from 'antd';
import { SearchOutlined, StarOutlined, FilterOutlined } from '@ant-design/icons';
import '../AIWrite/index.css';

const LibraryPage = () => {
  const [searchText, setSearchText] = useState('');

  const columns = [
    { title: '文献名称', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '作者', dataIndex: 'authors', key: 'authors', width: 200, ellipsis: true },
    { title: '发表年份', dataIndex: 'year', key: 'year', width: 100 },
    { title: '收藏时间', dataIndex: 'collectedAt', key: 'collectedAt', width: 160 },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: () => <a style={{ color: '#ff4d4f' }}>取消收藏</a>,
    },
  ];

  return (
    <div className="ai-page-layout">
      <div className="ai-page-sidebar">
        <div className="ai-sidebar-nav">
          <div className="ai-sidebar-nav-item ai-sidebar-nav-item-active" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StarOutlined />
            我的收藏
          </div>
        </div>
      </div>

      <div className="ai-page-content">
        <div className="ai-content-header">
          <h2 className="ai-content-title">文献库</h2>
          <p style={{ color: '#8c8c8c', fontSize: 13, margin: '0 0 16px' }}>管理你收藏的学术内容</p>
          <div className="ai-content-toolbar">
            <Input
              placeholder="搜索文献名称"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="ai-search-input"
              allowClear
            />
            <Select defaultValue="year" style={{ width: 120 }} options={[
              { value: 'year', label: '发表年份' },
              { value: 'collected', label: '收藏时间' },
              { value: 'title', label: '名称排序' },
            ]} />
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={[]}
          locale={{
            emptyText: (
              <Empty
                image={<StarOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
                description="暂无文献内容，开始收藏你感兴趣的文献资源吧"
              />
            ),
          }}
          pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true }}
        />
      </div>
    </div>
  );
};

export default LibraryPage;
