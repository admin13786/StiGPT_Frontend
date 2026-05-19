import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import {
  BarChartOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import knowledgeService from '../../services/knowledge.service';
import type {
  CreateKnowledgeBaseDto,
  KnowledgeBase,
} from '../../services/knowledge.service';
import { useMessage } from '../../hooks/useMessage';
import './index.css';

const { TextArea } = Input;

const aclOptions = [
  { value: 'public', label: '公开 - 所有人可访问' },
  { value: 'internal', label: '内部 - 登录用户可访问' },
  { value: 'department', label: '部门 - 指定部门可访问' },
  { value: 'private', label: '私有 - 仅创建者可访问' },
];

const aclTagMap: Record<string, { color: string; label: string }> = {
  public: { color: 'green', label: '公开' },
  internal: { color: 'blue', label: '内部' },
  department: { color: 'orange', label: '部门' },
  private: { color: 'red', label: '私有' },
};

const KnowledgePage: React.FC = () => {
  const navigate = useNavigate();
  const message = useMessage();
  const [loading, setLoading] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingKb, setEditingKb] = useState<KnowledgeBase | null>(null);
  const [form] = Form.useForm();

  const fetchKnowledgeBases = async () => {
    setLoading(true);
    try {
      const response = await knowledgeService.getList({
        page,
        limit: pageSize,
        search: searchText || undefined,
      });
      setKnowledgeBases(response.items || []);
      setTotal(response.total || 0);
    } catch (error) {
      message.error('获取知识库列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeBases();
  }, [page, pageSize, searchText]);

  const handleCreate = () => {
    setEditingKb(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record: KnowledgeBase) => {
    setEditingKb(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      aclScope: record.aclScope,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await knowledgeService.delete(id);
      message.success('删除成功');
      fetchKnowledgeBases();
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const data: CreateKnowledgeBaseDto = {
        name: values.name,
        description: values.description,
        aclScope: values.aclScope,
      };

      if (editingKb) {
        await knowledgeService.update(editingKb.id, data);
        message.success('更新成功');
      } else {
        await knowledgeService.create(data);
        message.success('创建成功');
      }

      setIsModalVisible(false);
      fetchKnowledgeBases();
    } catch (error) {
      message.error(editingKb ? '更新失败' : '创建失败');
      console.error(error);
    }
  };

  const handleSearch = () => {
    setPage(1);
    setSearchText(searchInput.trim());
  };

  const renderAclTag = (scope: string) => {
    const tag = aclTagMap[scope] || { color: 'default', label: scope };
    return <Tag color={tag.color}>{tag.label}</Tag>;
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (value?: string) => value || '暂无描述',
    },
    {
      title: '权限范围',
      dataIndex: 'aclScope',
      key: 'aclScope',
      width: 110,
      render: renderAclTag,
    },
    {
      title: '文档数',
      dataIndex: 'documentCount',
      key: 'documentCount',
      width: 100,
      render: (count: number) => (
        <span>
          <FileTextOutlined /> {count || 0}
        </span>
      ),
    },
    {
      title: '文本块数',
      dataIndex: 'chunkCount',
      key: 'chunkCount',
      width: 110,
      render: (count: number) => count || 0,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_: unknown, record: KnowledgeBase) => (
        <Space size="small">
          <Tooltip title="查看文档">
            <Button
              type="link"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => navigate(`/knowledge/${record.id}/documents`)}
            >
              文档
            </Button>
          </Tooltip>
          <Tooltip title="RAG 测试">
            <Button
              type="link"
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => navigate(`/knowledge/${record.id}/rag-test`)}
            >
              测试
            </Button>
          </Tooltip>
          <Tooltip title="查看统计">
            <Button
              type="link"
              size="small"
              icon={<BarChartOutlined />}
              onClick={() => navigate(`/knowledge/${record.id}/stats`)}
            >
              统计
            </Button>
          </Tooltip>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个知识库吗？"
            description="删除后无法恢复，关联文档也会被删除。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="knowledge-page">
      <Card
        title="知识库管理"
        extra={
          <Space>
            <Space.Compact>
              <Input
                placeholder="搜索知识库"
                allowClear
                value={searchInput}
                style={{ width: 250 }}
                onChange={(event) => setSearchInput(event.target.value)}
                onPressEnter={handleSearch}
              />
              <Button type="primary" onClick={handleSearch}>
                搜索
              </Button>
            </Space.Compact>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              创建知识库
            </Button>
          </Space>
        }
      >
        <Table
          loading={loading}
          columns={columns}
          dataSource={knowledgeBases}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (value) => `共 ${value} 条`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
          }}
        />
      </Card>

      <Modal
        title={editingKb ? '编辑知识库' : '创建知识库'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical" initialValues={{ aclScope: 'public' }}>
          <Form.Item
            name="name"
            label="知识库名称"
            rules={[{ required: true, message: '请输入知识库名称' }]}
          >
            <Input placeholder="例如：城大论文知识库" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={4} placeholder="简要描述这个知识库的用途和内容" />
          </Form.Item>

          <Form.Item
            name="aclScope"
            label="权限范围"
            rules={[{ required: true, message: '请选择权限范围' }]}
          >
            <Select options={aclOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default KnowledgePage;
