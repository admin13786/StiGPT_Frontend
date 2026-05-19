import { useEffect, useState } from 'react';
import {
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
} from 'antd';
import { HeartFilled, HeartOutlined } from '@ant-design/icons';
import { quickReplyService } from '../../services/quickReply.service';
import { useMessage } from '../../hooks/useMessage';
import './index.css';

interface QuickReplyDrawerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (content: string) => void;
}

interface Reply {
  id: string;
  content: string;
  category: {
    id: string;
    name: string;
  };
  usageCount: number;
  favoriteCount: number;
  isFavorited: boolean;
  isGlobal: boolean;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  _count?: {
    replies: number;
  };
}

export default function QuickReplyDrawer({
  open,
  onClose,
  onSelect,
}: QuickReplyDrawerProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'usage'>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const message = useMessage();

  useEffect(() => {
    if (open) {
      loadCategories();
      return;
    }

    setReplies([]);
    setSearchKeyword('');
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setReplies([]);
    if (selectedCategoryId || activeTab === 'favorites' || activeTab === 'usage') {
      loadReplies();
    } else if (categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [open, selectedCategoryId, activeTab, categories.length]);

  const loadCategories = async () => {
    try {
      const data = await quickReplyService.getCategories();
      setCategories(data);
      if (data.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(data[0].id);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      message.error('加载分类失败');
    }
  };

  const loadReplies = async () => {
    setLoading(true);
    try {
      let data: Reply[] = [];

      if (activeTab === 'favorites') {
        const result = await quickReplyService.getUserFavorites(1, 100);
        data = result.data || [];
      } else {
        const result = await quickReplyService.getReplies({
          categoryId: selectedCategoryId || undefined,
          sortBy: activeTab === 'usage' ? 'usageCount' : 'favoriteCount',
          isActive: true,
          pageSize: 100,
        });
        data = result.data || [];
      }

      const deduped = Array.from(
        new Map(data.map((reply) => [reply.id, reply])).values(),
      )
        .filter((reply) => reply.isActive === true)
        .filter((reply) =>
          searchKeyword.trim()
            ? reply.content.toLowerCase().includes(searchKeyword.toLowerCase())
            : true,
        )
        .sort((a, b) => b.usageCount - a.usageCount);

      setReplies(deduped);
    } catch (error) {
      console.error('加载快捷回复失败:', error);
      message.error('加载快捷回复失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (reply: Reply) => {
    if (!reply.isActive) {
      message.warning('该快捷回复已禁用，无法使用');
      return;
    }

    try {
      await quickReplyService.incrementUsage(reply.id);
      onSelect(reply.content);
      message.success('已插入回复');
    } catch {
      message.error('操作失败');
    }
  };

  const handleToggleFavorite = async (replyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await quickReplyService.toggleFavorite(replyId);
      setReplies((prev) =>
        prev.map((reply) =>
          reply.id === replyId
            ? {
                ...reply,
                isFavorited: !reply.isFavorited,
                favoriteCount: reply.isFavorited
                  ? reply.favoriteCount - 1
                  : reply.favoriteCount + 1,
              }
            : reply,
        ),
      );
    } catch {
      message.error('收藏失败');
    }
  };

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
  };

  return (
    <Drawer
      title="快捷回复"
      placement="right"
      width={500}
      open={open}
      onClose={onClose}
      className="quick-reply-drawer"
    >
      <div className="quick-reply-drawer-content">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'all' | 'favorites' | 'usage')}
          items={[
            { key: 'all', label: '全部' },
            { key: 'favorites', label: '收藏' },
            { key: 'usage', label: '使用频率' },
          ]}
        />

        <div style={{ padding: '0 16px', marginBottom: 16 }}>
          <Form.Item label="分类" style={{ marginBottom: 12 }}>
            <Select
              placeholder="选择分类"
              value={selectedCategoryId || undefined}
              onChange={setSelectedCategoryId}
              style={{ width: '100%' }}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={categories.map((cat) => ({
                label: cat.name,
                value: cat.id,
              }))}
              notFoundContent={categories.length === 0 ? '暂无分类' : undefined}
            />
          </Form.Item>

          <Space.Compact style={{ width: '100%' }} size="large">
            <Input
              placeholder="搜索快捷回复..."
              allowClear
              value={searchKeyword}
              onChange={(e) => handleSearch(e.target.value)}
              onPressEnter={(e) => handleSearch((e.target as HTMLInputElement).value)}
            />
            <Button type="primary" onClick={() => handleSearch(searchKeyword)}>
              搜索
            </Button>
          </Space.Compact>
        </div>

        <div className="reply-list">
          <Spin spinning={loading}>
            {replies.length === 0 ? (
              <Empty description="暂无快捷回复" />
            ) : (
              <List
                dataSource={replies}
                renderItem={(reply) => (
                  <List.Item
                    className="reply-item"
                    onClick={() => handleSelect(reply)}
                    actions={[
                      <Button
                        key="favorite"
                        type="text"
                        size="small"
                        icon={
                          reply.isFavorited ? (
                            <HeartFilled style={{ color: '#ff4d4f' }} />
                          ) : (
                            <HeartOutlined />
                          )
                        }
                        onClick={(e) => handleToggleFavorite(reply.id, e)}
                      />,
                    ]}
                  >
                    <List.Item.Meta
                      title={<span>{reply.category.name}</span>}
                      description={<div className="reply-content">{reply.content}</div>}
                    />
                    <div className="reply-stats">
                      <Tag>使用 {reply.usageCount}</Tag>
                      <Tag>收藏 {reply.favoriteCount}</Tag>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Spin>
        </div>
      </div>
    </Drawer>
  );
}
