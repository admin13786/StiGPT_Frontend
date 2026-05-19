import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Button,
  Space,
  Tag,
  message,
} from 'antd';
import {
  FileTextOutlined,
  ArrowLeftOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import knowledgeService from '../../services/knowledge.service';
import type { KnowledgeBaseStats } from '../../services/knowledge.service';
import ragService from '../../services/rag.service';
import type { PopularCitation, CitationStats } from '../../services/rag.service';
import './Stats.css';

const StatsPage: React.FC = () => {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [kbName, setKbName] = useState('');
  const [stats, setStats] = useState<KnowledgeBaseStats | null>(null);
  const [popularCitations, setPopularCitations] = useState<PopularCitation[]>([]);
  const [citationStats, setCitationStats] = useState<CitationStats | null>(null);

  useEffect(() => {
    if (kbId) {
      fetchData();
    }
  }, [kbId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [kb, kbStats, popular, citations] = await Promise.all([
        knowledgeService.getById(kbId!),
        knowledgeService.getStats(kbId!),
        ragService.getPopularCitations(kbId!, 10),
        ragService.getCitationStats(kbId!),
      ]);

      setKbName(kb.name);
      setStats(kbStats);
      setPopularCitations(popular);
      setCitationStats(citations);
    } catch (error) {
      message.error('获取统计信息失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const popularColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 80,
      render: (_: any, __: any, index: number) => (
        <Tag color={index < 3 ? 'gold' : 'default'}>#{index + 1}</Tag>
      ),
    },
    {
      title: '文档名称',
      dataIndex: 'documentTitle',
      key: 'documentTitle',
      ellipsis: true,
    },
    {
      title: '引用次数',
      dataIndex: 'citationCount',
      key: 'citationCount',
      width: 120,
      render: (count: number) => (
        <Space>
          <FireOutlined style={{ color: '#ff4d4f' }} />
          <span>{count}</span>
        </Space>
      ),
    },
  ];

  const recentColumns = [
    {
      title: '文档名称',
      dataIndex: 'documentTitle',
      key: 'documentTitle',
      ellipsis: true,
    },
    {
      title: '相似度',
      dataIndex: 'score',
      key: 'score',
      width: 120,
      render: (score: number) => (
        <Tag color="green">{(score * 100).toFixed(1)}%</Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div className="stats-page">
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/knowledge')}
            />
            <span>{kbName} - 统计分析</span>
          </Space>
        }
        extra={
          <Button onClick={fetchData} loading={loading}>
            刷新
          </Button>
        }
      >
        {/* 统计卡片 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="文档总数"
                value={stats?.documentCount || 0}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="文本块总数"
                value={stats?.chunkCount || 0}
                prefix={<DatabaseOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="总引用次数"
                value={citationStats?.totalCitations || 0}
                prefix={<FireOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="被引用文档数"
                value={citationStats?.uniqueDocuments || 0}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 热门引用 */}
        <Card
          title={
            <Space>
              <FireOutlined />
              <span>热门引用 Top 10</span>
            </Space>
          }
          style={{ marginTop: 24 }}
        >
          <Table
            loading={loading}
            columns={popularColumns}
            dataSource={popularCitations}
            rowKey="chunkId"
            pagination={false}
            size="small"
          />
        </Card>

        {/* 最近引用 */}
        <Card
          title={
            <Space>
              <ClockCircleOutlined />
              <span>最近引用</span>
            </Space>
          }
          style={{ marginTop: 24 }}
        >
          <Table
            loading={loading}
            columns={recentColumns}
            dataSource={citationStats?.recentCitations || []}
            rowKey={(record, index) => `${record.chunkId}-${index}`}
            pagination={false}
            size="small"
          />
        </Card>

        {/* 其他统计信息 */}
        {stats && (
          <Card title="其他信息" style={{ marginTop: 24 }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <div className="info-item">
                  <span className="label">总存储大小：</span>
                  <span className="value">{formatFileSize(stats.totalSize)}</span>
                </div>
              </Col>
              <Col span={12}>
                <div className="info-item">
                  <span className="label">最后更新：</span>
                  <span className="value">
                    {new Date(stats.lastUpdated).toLocaleString('zh-CN')}
                  </span>
                </div>
              </Col>
            </Row>
          </Card>
        )}
      </Card>
    </div>
  );
};

export default StatsPage;
