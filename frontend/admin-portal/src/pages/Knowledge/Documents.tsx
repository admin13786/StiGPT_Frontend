import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Upload,
  message,
  Tag,
  Popconfirm,
  Progress,
  Tooltip,
  Modal,
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  FileTextOutlined,
  ArrowLeftOutlined,
  EyeOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import type { UploadProps } from 'antd';
import documentService from '../../services/document.service';
import type { Document } from '../../services/document.service';
import knowledgeService from '../../services/knowledge.service';
import './Documents.css';

const DocumentsPage: React.FC = () => {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [kbName, setKbName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  useEffect(() => {
    if (kbId) {
      fetchKnowledgeBase();
      fetchDocuments();
    }
  }, [kbId, page, pageSize]);

  const fetchKnowledgeBase = async () => {
    try {
      const kb = await knowledgeService.getById(kbId!);
      setKbName(kb.name);
    } catch (error) {
      message.error('获取知识库信息失败');
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await documentService.getList(kbId!, {
        page,
        limit: pageSize,
      });
      setDocuments(response.items);
      setTotal(response.total);
    } catch (error) {
      message.error('获取文档列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    setUploading(true);

    try {
      await documentService.upload(kbId!, file as File);
      message.success('文档上传成功，正在处理中...');
      onSuccess?.('ok');
      fetchDocuments();
    } catch (error) {
      message.error('文档上传失败');
      onError?.(error as Error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await documentService.delete(kbId!, id);
      message.success('删除成功');
      fetchDocuments();
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      await documentService.reprocess(kbId!, id);
      message.success('已加入重新处理队列');
      fetchDocuments();
    } catch (error) {
      message.error('重新处理失败');
      console.error(error);
    }
  };

  const showDetail = (doc: Document) => {
    setSelectedDoc(doc);
    setDetailModalVisible(true);
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: '等待处理' },
      processing: { color: 'processing', text: '处理中' },
      completed: { color: 'success', text: '已完成' },
      failed: { color: 'error', text: '失败' },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const columns = [
    {
      title: '文档名称',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      ellipsis: true,
      render: (title: string, record: Document) => (
        <Space>
          <FileTextOutlined />
          <a onClick={() => showDetail(record)}>{title}</a>
        </Space>
      ),
    },
    {
      title: '文件类型',
      dataIndex: 'fileType',
      key: 'fileType',
      width: 100,
      render: (type: string) => type.toUpperCase(),
    },
    {
      title: '文件大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 120,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '处理进度',
      key: 'progress',
      width: 150,
      render: (_: any, record: Document) => {
        if (record.status === 'completed') {
          return (
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>文本块: {record.chunkCount}</div>
              <div>Token: {record.tokenCount}</div>
            </Space>
          );
        } else if (record.status === 'processing') {
          return <Progress percent={50} status="active" size="small" />;
        } else if (record.status === 'failed') {
          return <Tag color="error">处理失败</Tag>;
        }
        return <Tag>等待处理</Tag>;
      },
    },
    {
      title: '上传时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: Document) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => showDetail(record)}
            />
          </Tooltip>
          {record.status === 'failed' && (
            <Tooltip title="重新处理">
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => handleReprocess(record.id)}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="确定要删除这个文档吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="documents-page">
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/knowledge')}
            />
            <span>{kbName} - 文档管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => navigate(`/knowledge/${kbId}/rag-test`)}
            >
              RAG 测试
            </Button>
            <Upload
              accept=".pdf,.md,.markdown"
              showUploadList={false}
              customRequest={handleUpload}
              disabled={uploading}
            >
              <Button type="primary" icon={<UploadOutlined />} loading={uploading}>
                上传文档
              </Button>
            </Upload>
          </Space>
        }
      >
        <Table
          loading={loading}
          columns={columns}
          dataSource={documents}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个文档`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Card>

      <Modal
        title="文档详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {selectedDoc && (
          <div className="document-detail">
            <div className="detail-row">
              <span className="label">文档名称：</span>
              <span>{selectedDoc.title}</span>
            </div>
            <div className="detail-row">
              <span className="label">文件类型：</span>
              <span>{selectedDoc.fileType.toUpperCase()}</span>
            </div>
            <div className="detail-row">
              <span className="label">文件大小：</span>
              <span>{formatFileSize(selectedDoc.fileSize)}</span>
            </div>
            <div className="detail-row">
              <span className="label">处理状态：</span>
              {getStatusTag(selectedDoc.status)}
            </div>
            {selectedDoc.status === 'completed' && (
              <>
                <div className="detail-row">
                  <span className="label">文本块数：</span>
                  <span>{selectedDoc.chunkCount}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Token 数：</span>
                  <span>{selectedDoc.tokenCount}</span>
                </div>
                <div className="detail-row">
                  <span className="label">处理完成时间：</span>
                  <span>{selectedDoc.processedAt ? new Date(selectedDoc.processedAt).toLocaleString('zh-CN') : '-'}</span>
                </div>
              </>
            )}
            {selectedDoc.status === 'failed' && selectedDoc.errorMessage && (
              <div className="detail-row">
                <span className="label">错误信息：</span>
                <span className="error-message">{selectedDoc.errorMessage}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="label">上传时间：</span>
              <span>{new Date(selectedDoc.uploadTime).toLocaleString('zh-CN')}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DocumentsPage;
