import { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  Select,
  Tag,
  Modal,
  Form,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { User } from '../../../types';
import { useMessage } from '../../../hooks/useMessage';
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
} from '../../../services/user.service';
import './index.css';

const { Option } = Select;
const { Text } = Typography;

interface UserFilters {
  search: string;
  role: '' | 'ADMIN' | 'AGENT';
}

const UsersPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    role: '',
  });
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const message = useMessage();

  const loadUsers = async (page = pagination.page, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const response = await getUsers({
        page,
        pageSize,
        role: filters.role || undefined,
        search: filters.search || undefined,
      });
      setUsers(response.items);
      setPagination({
        page: response.page,
        pageSize: response.pageSize,
        total: response.total,
      });
    } catch (error) {
      console.error('加载用户列表失败:', error);
      message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadUsers(1, pagination.pageSize);
  }, [filters.role]);

  const handleSearch = () => {
    loadUsers(1, pagination.pageSize);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ role: 'AGENT' });
    setUserModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      role: user.role,
      realName: user.realName,
      email: user.email,
      phone: user.phone,
    });
    setUserModalOpen(true);
  };

  const handleUserSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        username: values.username,
        role: values.role,
        realName: values.realName,
        email: values.email,
        phone: values.phone,
        password: values.password || undefined,
      };

      if (editingUser) {
        await updateUser(editingUser.id, payload);
        message.success('用户信息已更新');
      } else {
        await createUser(payload);
        message.success('用户创建成功');
      }

      setUserModalOpen(false);
      form.resetFields();
      loadUsers();
    } catch (error) {
      console.error('保存用户失败:', error);
    }
  };

  const handleDelete = async (user: User) => {
    Modal.confirm({
      title: `确认删除 ${user.username} 吗？`,
      content: '删除后将无法恢复，请谨慎操作。',
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteUser(user.id);
          message.success('删除成功');
          loadUsers();
        } catch (error) {
          console.error('删除用户失败:', error);
          message.error('删除失败');
        }
      },
    });
  };

  const openPasswordModal = (user: User) => {
    setTargetUser(user);
    passwordForm.resetFields();
    setPasswordModalOpen(true);
  };

  const handlePasswordSubmit = async () => {
    try {
      const values = await passwordForm.validateFields();
      await updateUser(targetUser!.id, { password: values.password });
      message.success('密码已重置');
      setPasswordModalOpen(false);
    } catch (error) {
      console.error('重置密码失败:', error);
    }
  };

  const columns: ColumnsType<User> = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          {record.realName && <Text type="secondary">{record.realName}</Text>}
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: User['role']) => (
        <Tag color={role === 'ADMIN' ? 'blue' : 'cyan'}>
          {role === 'ADMIN' ? '管理员' : '客服'}
        </Tag>
      ),
    },
    {
      title: '联系方式',
      key: 'contact',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {record.email && <Text>{record.email}</Text>}
          {record.phone && <Text>{record.phone}</Text>}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isOnline',
      key: 'isOnline',
      render: (isOnline: boolean) => (
        <Tag color={isOnline ? 'green' : 'default'}>
          {isOnline ? '在线' : '离线'}
        </Tag>
      ),
    },
    {
      title: '最近登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      render: (value: string | undefined) =>
        value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            type="link"
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Button
            icon={<KeyOutlined />}
            type="link"
            onClick={() => openPasswordModal(record)}
          >
            重置密码
          </Button>
          <Button
            icon={<DeleteOutlined />}
            type="link"
            danger
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="users-page">
      <Card
        title="用户管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => loadUsers()}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新建用户
            </Button>
          </Space>
        }
      >
        <div className="users-filters">
          <Input
            placeholder="搜索用户名/姓名/邮箱"
            allowClear
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            onPressEnter={handleSearch}
            style={{ width: 260 }}
          />
          <Select
            placeholder="角色"
            allowClear
            value={filters.role || undefined}
            onChange={(value) => setFilters((prev) => ({ ...prev, role: value || '' }))}
            style={{ width: 160 }}
          >
            <Option value="ADMIN">管理员</Option>
            <Option value="AGENT">客服</Option>
          </Select>
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
        </div>

        <Table<User>
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            onChange: (page, pageSize) => loadUsers(page, pageSize),
          }}
        />
      </Card>

      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={userModalOpen}
        onCancel={() => setUserModalOpen(false)}
        okText="保存"
        onOk={handleUserSubmit}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
            ]}
          >
            <Input placeholder="请输入用户名" disabled={!!editingUser} />
          </Form.Item>

          <Form.Item
            name="password"
            label={editingUser ? '新密码（可选）' : '密码'}
            rules={
              editingUser
                ? [{ min: 6, message: '密码至少6个字符' }]
                : [
                    { required: true, message: '请输入密码' },
                    { min: 6, message: '密码至少6个字符' },
                  ]
            }
          >
            <Input.Password placeholder={editingUser ? '不修改请留空' : '请输入密码'} />
          </Form.Item>

          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Option value="ADMIN">管理员</Option>
              <Option value="AGENT">客服</Option>
            </Select>
          </Form.Item>

          <Form.Item name="realName" label="姓名">
            <Input placeholder="请输入真实姓名" />
          </Form.Item>

          <Form.Item name="email" label="邮箱">
            <Input placeholder="name@example.com" />
          </Form.Item>

          <Form.Item name="phone" label="手机号">
            <Input placeholder="请输入手机号" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={targetUser ? `重置 ${targetUser.username} 的密码` : '重置密码'}
        open={passwordModalOpen}
        onCancel={() => setPasswordModalOpen(false)}
        okText="确认"
        onOk={handlePasswordSubmit}
        destroyOnHidden
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6个字符' },
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersPage;
