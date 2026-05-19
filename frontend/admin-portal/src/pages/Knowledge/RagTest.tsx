import React, { useState, useEffect } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Select,
  Slider,
  Divider,
  Spin,
  Empty,
  Tag,
  Collapse,
  Typography,
  message,
} from 'antd';
import {
  SendOutlined,
  ArrowLeftOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import ragService from '../../services/rag.service';
import type { RagQueryResponse, Citation } from '../../services/rag.service';
import knowledgeService from '../../services/knowledge.service';
import { CitationCard } from '../../components/Citation';
import './RagTest.css';

const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;
const { Text, Paragraph } = Typography;

const RagTestPage: React.FC = () => {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [kbName, setKbName] = useState('');
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [temperature, setTemperature] = useState(0.7);
  const [response, setResponse] = useState<RagQueryResponse | null>(null);
  const [queryHistory, setQueryHistory] = useState<Array<{
    query: string;
    response: RagQueryResponse;
    timestamp: Date;
  }>>([]);

  useEffect(() => {
    if (kbId) {
      fetchKnowledgeBase();
    }
  }, [kbId]);

  const fetchKnowledgeBase = async () => {
    try {
      const kb = await knowledgeService.getById(kbId!);
      setKbName(kb.name);
    } catch (error) {
      message.error('获取知识库信息失败');
    }
  };

  const handleQuery = async () => {
    if (!query.trim()) {
      message.warning('请输入问题');
      return;
    }

    setLoading(true);
    try {
      const result = await ragService.query({
        query: query.trim(),
        kbId: kbId!,
        topK,
        temperature,
      });

      setResponse(result);
      setQueryHistory([
        {
          query: query.trim(),
          response: result,
          timestamp: new Date(),
        },
        ...queryHistory.slice(0, 9), // 保留最近10条
      ]);
    } catch (error) {
      message.error('查询失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleQuery();
    }
  };

  const renderCitation = (citation: Citation, index: number) => {
    return (
      <CitationCard
        key={citation.chunkId}
        citation={citation}
        index={index}
        onViewDocument={(docId) => {
          message.info(`文档ID: ${docId}`);
          // 可以跳转到文档详情页
        }}
      />
    );
  };

  return (
    <div className="rag-test-page">
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(`/knowledge/${kbId}/documents`)}
            />
            <span>{kbName} - RAG 测试</span>
          </Space>
        }
      >
        <div className="rag-test-container">
          {/* 左侧：查询区域 */}
          <div className="query-section">
            <Card title="查询设置" size="small">
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div>
                  <Text strong>问题</Text>
                  <TextArea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="输入你的问题... (Ctrl+Enter 发送)"
                    rows={4}
                    style={{ marginTop: 8 }}
                  />
                </div>

                <div>
                  <Text strong>检索数量 (Top K): {topK}</Text>
                  <Slider
                    min={1}
                    max={20}
                    value={topK}
                    onChange={setTopK}
                    marks={{ 1: '1', 5: '5', 10: '10', 20: '20' }}
                    style={{ marginTop: 8 }}
                  />
                </div>

                <div>
                  <Text strong>温度 (Temperature): {temperature}</Text>
                  <Slider
                    min={0}
                    max={1}
                    step={0.1}
                    value={temperature}
                    onChange={setTemperature}
                    marks={{ 0: '0', 0.5: '0.5', 1: '1' }}
                    style={{ marginTop: 8 }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    温度越高，回答越有创造性；温度越低，回答越确定
                  </Text>
                </div>

                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleQuery}
                  loading={loading}
                  block
                  size="large"
                >
                  查询
                </Button>
              </Space>
            </Card>

            {/* 查询历史 */}
            {queryHistory.length > 0 && (
              <Card title="查询历史" size="small" style={{ marginTop: 16 }}>
                <Collapse accordion>
                  {queryHistory.map((item, index) => (
                    <Panel
                      header={
                        <Space>
                          <ClockCircleOutlined />
                          <Text ellipsis style={{ maxWidth: 200 }}>
                            {item.query}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {item.timestamp.toLocaleTimeString('zh-CN')}
                          </Text>
                        </Space>
                      }
                      key={index}
                    >
                      <div
                        onClick={() => {
                          setQuery(item.query);
                          setResponse(item.response);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <Text type="secondary">点击恢复此查询</Text>
                      </div>
                    </Panel>
                  ))}
                </Collapse>
              </Card>
            )}
          </div>

          {/* 右侧：结果区域 */}
          <div className="result-section">
            {loading ? (
              <Card>
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: 16 }}>
                    <Text type="secondary">正在查询中...</Text>
                  </div>
                </div>
              </Card>
            ) : response ? (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                {/* 答案 */}
                <Card
                  title={
                    <Space>
                      <ThunderboltOutlined />
                      <span>AI 回答</span>
                    </Space>
                  }
                >
                  <Paragraph style={{ fontSize: 16, lineHeight: 1.8 }}>
                    {response.answer}
                  </Paragraph>

                  <Divider />

                  <Space split={<Divider type="vertical" />}>
                    <Text type="secondary">
                      检索到 {response.retrievedCount} 个相关块
                    </Text>
                    <Text type="secondary">
                      使用 {response.citations.length} 个引用
                    </Text>
                    <Text type="secondary">
                      Token: {response.tokenUsage.total}
                    </Text>
                    <Text type="secondary">
                      耗时: {response.processingTime}ms
                    </Text>
                  </Space>
                </Card>

                {/* 引用 */}
                {response.citations.length > 0 && (
                  <Card
                    title={
                      <Space>
                        <FileTextOutlined />
                        <span>引用来源 ({response.citations.length})</span>
                      </Space>
                    }
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      {response.citations.map((citation, index) =>
                        renderCitation(citation, index),
                      )}
                    </Space>
                  </Card>
                )}
              </Space>
            ) : (
              <Card>
                <Empty
                  description="输入问题并点击查询按钮开始测试"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </Card>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default RagTestPage;
