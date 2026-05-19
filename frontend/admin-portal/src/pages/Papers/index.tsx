import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Tag, Input, Select, Upload, Modal,
  message, Popconfirm, Typography, Row, Col, Statistic, Descriptions, Tooltip,
} from 'antd';
import {
  UploadOutlined, SearchOutlined, ReloadOutlined, DeleteOutlined,
  EyeOutlined, FileTextOutlined, CloudUploadOutlined, TagOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { paperService, type Paper, type DisciplineStat } from '../../services/paper.service';

const { Paragraph, Text } = Typography;
const { Dragger } = Upload;

const DISCIPLINES = [
  '计算机科学', '人工智能', '自然语言处理', '计算机视觉', '数据挖掘',
  '医学', '物理学', '数学', '材料科学', '生物学', '化学',
  '经济学', '管理学', '教育学', '法学', '其他',
];

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待处理' },
  processing: { color: 'processing', text: '处理中' },
  ready: { color: 'success', text: '已就绪' },
  failed: { color: 'error', text: '失败' },
};

const PapersPage: React.FC = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [discipline, setDiscipline] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [stats, setStats] = useState<DisciplineStat[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [uploadDiscipline, setUploadDiscipline] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await paperService.list({ discipline, status: statusFilter, keyword, page, pageSize });
      setPapers(result.items);
      setTotal(result.total);
    } catch (e: any) {
      message.error('加载论文列表失败');
    } finally {
      setLoading(false);
    }
  }, [discipline, statusFilter, keyword, page, pageSize]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await paperService.getDisciplineStats();
      setStats(data);
    } catch {}
  }, []);

  useEffect(() => { fetchPapers(); }, [fetchPapers]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await paperService.upload(file, uploadDiscipline);
      message.success('论文上传成功，正在后台处理');
      setUploadModalOpen(false);
      setUploadDiscipline(undefined);
      fetchPapers();
      fetchStats();
    } catch (e: any) {
      message.error('上传失败: ' + (e.message || '未知错误'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await paperService.delete(id);
      message.success('已删除');
      fetchPapers();
      fetchStats();
    } catch {
      message.error('删除失败');
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      await paperService.reprocess(id);
      message.success('已开始重新处理');
      fetchPapers();
    } catch {
      message.error('重新处理失败');
    }
  };

  const showDetail = async (id: string) => {
    try {
      const paper = await paperService.getById(id);
      setSelectedPaper(paper);
      setDetailModalOpen(true);
    } catch {
      message.error('获取详情失败');
    }
  };

  const columns: ColumnsType<Paper> = [
    {
      title: '论文标题', dataIndex: 'title', key: 'title', ellipsis: true, width: 300,
      render: (text, record) => (
        <a onClick={() => showDetail(record.id)}>
          <FileTextOutlined style={{ marginRight: 6 }} />{text}
        </a>
      ),
    },
    {
      title: '学科', dataIndex: 'discipline', key: 'discipline', width: 120,
      render: (v) => v ? <Tag color="blue">{v}</Tag> : <Tag>未分类</Tag>,
    },
    {
      title: '年份', dataIndex: 'year', key: 'year', width: 80,
    },
    {
      title: '作者', key: 'authors', width: 200, ellipsis: true,
      render: (_, record) => record.authors?.map(a => a.author.name).join(', ') || '-',
    },
    {
      title: '关键词', dataIndex: 'keywords', key: 'keywords', width: 200, ellipsis: true,
      render: (keywords: string[]) => keywords?.slice(0, 3).map(k => <Tag key={k} style={{ marginBottom: 2 }}>{k}</Tag>) || '-',
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status: string) => {
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '上传时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', key: 'action', width: 180, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情"><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record.id)} /></Tooltip>
          {record.status === 'failed' && (
            <Tooltip title="重新处理"><Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleReprocess(record.id)} /></Tooltip>
          )}
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const totalPapers = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div style={{ padding: 0 }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small"><Statistic title="论文总数" value={totalPapers} prefix={<FileTextOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="学科分类" value={stats.length} prefix={<TagOutlined />} /></Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="学科分布" styles={{ body: { padding: '8px 16px' } }}>
            <Space wrap size={[4, 4]}>
              {stats.slice(0, 8).map(s => (
                <Tag
                  key={s.discipline}
                  color={discipline === s.discipline ? 'blue' : undefined}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setDiscipline(discipline === s.discipline ? undefined : s.discipline)}
                >
                  {s.discipline} ({s.count})
                </Tag>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 工具栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索论文标题/摘要"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onPressEnter={() => { setPage(1); fetchPapers(); }}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="学科分类"
            value={discipline}
            onChange={v => { setDiscipline(v); setPage(1); }}
            allowClear
            style={{ width: 150 }}
            options={DISCIPLINES.map(d => ({ label: d, value: d }))}
          />
          <Select
            placeholder="状态"
            value={statusFilter}
            onChange={v => { setStatusFilter(v); setPage(1); }}
            allowClear
            style={{ width: 120 }}
            options={[
              { label: '待处理', value: 'pending' },
              { label: '处理中', value: 'processing' },
              { label: '已就绪', value: 'ready' },
              { label: '失败', value: 'failed' },
            ]}
          />
          <Button icon={<SearchOutlined />} onClick={() => { setPage(1); fetchPapers(); }}>搜索</Button>
          <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => setUploadModalOpen(true)}>
            上传论文
          </Button>
        </Space>
      </Card>

      {/* 论文列表 */}
      <Card size="small">
        <Table
          columns={columns}
          dataSource={papers}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t) => `共 ${t} 篇论文`,
            onChange: (p) => setPage(p),
          }}
        />
      </Card>

      {/* 上传弹窗 */}
      <Modal
        title="上传论文 PDF"
        open={uploadModalOpen}
        onCancel={() => { setUploadModalOpen(false); setUploadDiscipline(undefined); }}
        footer={null}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>学科分类（可选，AI 也会自动识别）：</Text>
          <Select
            placeholder="选择学科分类"
            value={uploadDiscipline}
            onChange={setUploadDiscipline}
            allowClear
            style={{ width: '100%', marginTop: 8 }}
            options={DISCIPLINES.map(d => ({ label: d, value: d }))}
          />
        </div>
        <Dragger
          accept=".pdf"
          multiple={false}
          showUploadList={false}
          customRequest={({ file }) => handleUpload(file as File)}
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon"><UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} /></p>
          <p className="ant-upload-text">{uploading ? '上传中...' : '点击或拖拽 PDF 文件到此处'}</p>
          <p className="ant-upload-hint">支持单个 PDF 文件，最大 50MB。上传后自动解析元数据、向量化、构建知识图谱。</p>
        </Dragger>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="论文详情"
        open={detailModalOpen}
        onCancel={() => { setDetailModalOpen(false); setSelectedPaper(null); }}
        footer={null}
        width={700}
      >
        {selectedPaper && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="标题" span={2}>{selectedPaper.title}</Descriptions.Item>
            <Descriptions.Item label="学科">{selectedPaper.discipline || '未分类'}</Descriptions.Item>
            <Descriptions.Item label="子领域">{selectedPaper.subField || '-'}</Descriptions.Item>
            <Descriptions.Item label="年份">{selectedPaper.year || '-'}</Descriptions.Item>
            <Descriptions.Item label="期刊/会议">{selectedPaper.venue || '-'}</Descriptions.Item>
            <Descriptions.Item label="语言">{selectedPaper.language === 'zh' ? '中文' : selectedPaper.language === 'en' ? '英文' : '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusMap[selectedPaper.status]?.color}>{statusMap[selectedPaper.status]?.text}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="作者" span={2}>
              {selectedPaper.authors?.map(a => `${a.author.name}${a.author.affiliation ? ` (${a.author.affiliation})` : ''}`).join('; ') || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="关键词" span={2}>
              {selectedPaper.keywords?.map(k => <Tag key={k}>{k}</Tag>) || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="摘要" span={2}>
              <Paragraph ellipsis={{ rows: 6, expandable: true }}>{selectedPaper.abstract || '无摘要'}</Paragraph>
            </Descriptions.Item>
            {selectedPaper.errorMessage && (
              <Descriptions.Item label="错误信息" span={2}>
                <Text type="danger">{selectedPaper.errorMessage}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default PapersPage;