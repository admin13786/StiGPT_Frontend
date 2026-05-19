import { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Switch,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Typography,
  Tag,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { IssueType } from '../../../types';
import { useMessage } from '../../../hooks/useMessage';
import {
  getAllIssueTypes,
  createIssueType,
  updateIssueType,
  deleteIssueType,
} from '../../../services/issueType.service';
import './index.css';

const { TextArea } = Input;
const { Text } = Typography;

interface IssueTypeFormValues {
  name: string;
  description?: string;
  priorityWeight: number;
  enabled: boolean;
  sortOrder: number;
  icon?: string;
  requireDirectTransfer?: boolean;
}

const UrgencyRulesPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIssueType, setEditingIssueType] = useState<IssueType | null>(null);
  const [form] = Form.useForm<IssueTypeFormValues>();
  const message = useMessage();

  const loadIssueTypes = async () => {
    setLoading(true);
    try {
      const data = await getAllIssueTypes();
      const issueTypesList = Array.isArray(data) ? data : [];
      // 按优先级权重降序排序（权重高的在前）
      issueTypesList.sort((a, b) => b.priorityWeight - a.priorityWeight);
      setIssueTypes(issueTypesList);
    } catch (error) {
      console.error('加载问题类型失败:', error);
      message.error('加载问题类型失败');
      setIssueTypes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssueTypes();
  }, []);

  const openCreateModal = () => {
    setEditingIssueType(null);
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      priorityWeight: 50,
      sortOrder: 0,
      requireDirectTransfer: false,
    });
    setModalOpen(true);
  };

  const openEditModal = (issueType: IssueType) => {
    setEditingIssueType(issueType);
    form.setFieldsValue({
      name: issueType.name,
      description: issueType.description,
      priorityWeight: issueType.priorityWeight,
      enabled: issueType.enabled,
      sortOrder: issueType.sortOrder,
      icon: issueType.icon,
      requireDirectTransfer: issueType.requireDirectTransfer || false,
    });
    setModalOpen(true);
  };

  const handleDelete = async (issueType: IssueType) => {
    try {
      await deleteIssueType(issueType.id);
      message.success('问题类型已删除');
      loadIssueTypes();
    } catch (error) {
      console.error('删除问题类型失败:', error);
      message.error('删除问题类型失败');
    }
  };

  const handleToggle = async (issueType: IssueType, checked: boolean) => {
    try {
      await updateIssueType(issueType.id, { enabled: checked });
      message.success(checked ? '问题类型已启用' : '问题类型已停用');
      loadIssueTypes();
    } catch (error) {
      console.error('更新问题类型状态失败:', error);
      message.error('更新问题类型状态失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingIssueType) {
        await updateIssueType(editingIssueType.id, values);
        message.success('问题类型更新成功');
      } else {
        await createIssueType(values);
        message.success('问题类型创建成功');
      }

      setModalOpen(false);
      loadIssueTypes();
    } catch (error) {
      console.error('保存问题类型失败:', error);
      message.error('保存问题类型失败');
    }
  };

  const getPriorityTag = (weight: number) => {
    if (weight >= 90) return <Tag color="red">紧急</Tag>;
    if (weight >= 75) return <Tag color="orange">高</Tag>;
    if (weight >= 60) return <Tag color="blue">中</Tag>;
    return <Tag color="default">低</Tag>;
  };

  const columns: ColumnsType<IssueType> = [
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 80,
      render: (icon: string) => <span style={{ fontSize: 20 }}>{icon || '📌'}</span>,
    },
    {
      title: '问题类型名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '优先级权重',
      dataIndex: 'priorityWeight',
      key: 'priorityWeight',
      width: 150,
      sorter: (a, b) => b.priorityWeight - a.priorityWeight, // 降序：权重高的在前
      defaultSortOrder: 'descend',
      render: (weight: number) => (
        <Space>
          <Text strong>{weight}</Text>
          {getPriorityTag(weight)}
        </Space>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (value, record) => (
        <Switch checked={value} onChange={(checked) => handleToggle(record, checked)} />
      ),
    },
    {
      title: '直接转人工',
      dataIndex: 'requireDirectTransfer',
      key: 'requireDirectTransfer',
      width: 120,
      render: (value) => (
        value ? <Tag color="orange">是</Tag> : <Tag color="default">否</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此问题类型吗？"
            description="删除后，已使用此类型的工单不会受影响，但新工单将无法选择此类型。"
            onConfirm={() => handleDelete(record)}
            okText="删除"
            okType="danger"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="urgency-rules-page">
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              问题类型优先级管理
            </Typography.Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              管理问题类型及其优先级权重。玩家提交工单时会根据选择的问题类型自动计算优先级。
            </Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadIssueTypes}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新建问题类型
            </Button>
          </Space>
        </div>

        <div style={{ marginBottom: 16, padding: 12, background: '#f0f2f5', borderRadius: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            💡 <strong>优先级说明</strong>：权重范围 1-100，数值越大优先级越高。工单优先级计算公式：
            基础分数 = 最高权重 + (其他权重之和 × 0.3)
          </Text>
        </div>

        <Table
          columns={columns}
          dataSource={issueTypes}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个问题类型`,
          }}
        />
      </Card>

      <Modal
        title={editingIssueType ? '编辑问题类型' : '新建问题类型'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="问题类型名称"
            rules={[{ required: true, message: '请输入问题类型名称' }]}
          >
            <Input placeholder="例如：充值未到账、账号被盗" />
          </Form.Item>

          <Form.Item name="description" label="问题描述">
            <TextArea
              placeholder="可选，帮助玩家理解此问题类型"
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="icon"
            label="图标"
            tooltip="可选，支持 emoji 或 Unicode 字符"
          >
            <Input placeholder="例如：💰、🔒、🚫" maxLength={2} />
          </Form.Item>

          <Form.Item
            name="priorityWeight"
            label="优先级权重"
            tooltip="范围：1-100，数值越大优先级越高。建议：紧急问题 90-100，高优先级 75-89，中优先级 60-74，低优先级 1-59"
            rules={[
              { required: true, message: '请输入优先级权重' },
              { type: 'number', min: 1, max: 100, message: '权重范围：1-100' },
            ]}
          >
            <InputNumber
              min={1}
              max={100}
              placeholder="1-100"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="sortOrder"
            label="显示排序"
            tooltip="数值越小越靠前显示，用于控制玩家端的问题类型显示顺序"
            rules={[
              { required: true, message: '请输入显示排序' },
              { type: 'number', min: 0, message: '排序值不能小于 0' },
            ]}
          >
            <InputNumber
              min={0}
              placeholder="0"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item
            label="直接转接人工客服"
            name="requireDirectTransfer"
            valuePropName="checked"
            tooltip="开启后，玩家选择此问题类型时将跳过问题描述表单和AI客服，直接进入人工客服排队"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UrgencyRulesPage;
