import { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, Popconfirm,
  message, Card, Avatar, Tooltip, Typography,
} from 'antd';
import {
  UserOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, ReloadOutlined, CrownOutlined, TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import apiClient from '../../services/api';

const { Title } = Typography;

interface UserRecord {
  id: string;
  username: string;
  realName?: string;
  email?: string;
  role: 'ADMIN' | 'AGENT' | 'USER';
  isOnline: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

const roleMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ADMIN: { label: '管理员', color: 'red', icon: <CrownOutlined /> },
  AGENT: { label: '专员', color: 'blue', icon: <TeamOutlined /> },
  USER: { label: '普通用户', color: 'green', icon: <UserOutlined /> },
};

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [form] = Form.useForm();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/users', { params: { page: 1, pageSize: 200 } });
      setUsers(res?.items || res || []);
    } catch {
      // 如果没有 /users 接口，用 /settings/users 接口
      try {
        const res: any = await apiClient.get('/settings/users');
        setUsers(res?.items || res || []);
      } catch {
        message.error('获取用户列表失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ role: 'USER' });
    setModalOpen(true);
  };

  const handleEdit = (record: UserRecord) => {
    setEditingUser(record);
    form.setFieldsValue({
      username: record.username,
      realName: record.realName,
      email: record.email,
      role: record.role,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/users/${id}`);
      message.success('删除成功');
      fetchUsers();
    } catch {
      try {
        await apiClient.delete(`/settings/users/${id}`);
        message.success('删除成功');
        fetchUsers();
      } catch {
        message.error('删除失败');
      }
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingUser) {
        // 编辑
        const updateData: any = { realName: values.realName, email: values.email, role: values.role };
        if (values.password) updateData.password = values.password;
        try {
          await apiClient.patch(`/users/${editingUser.id}`, updateData);
        } catch {
          await apiClient.patch(`/settings/users/${editingUser.id}`, updateData);
        }
        message.success('更新成功');
      } else {
        // 新建
        try {
          await apiClient.post('/auth/register', values);
        } catch {
          await apiClient.post('/users', values);
        }
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchUsers();
    } catch {
      // form validation error
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch = !searchText ||
      u.username.toLowerCase().includes(searchText.toLowerCase()) ||
      u.realName?.toLowerCase().includes(searchText.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchText.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const columns = [
    {
      title: '用户',
      key: 'user',
      width: 240,
      render: (_: any, record: UserRecord) => (
        <Space>
          <Avatar style={{ background: record.isOnline ? '#52c41a' : '#d9d9d9' }} icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 500 }}>{record.realName || record.username}</div>
            <div style={{ fontSize: 12, color: '#999' }}>@{record.username}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => {
        const r = roleMap[role] || { label: role, color: 'default', icon: null };
        return <Tag icon={r.icon} color={r.color}>{r.label}</Tag>;
      },
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: any, record: UserRecord) => (
        <Tag color={record.isOnline ? 'success' : 'default'}>
          {record.isOnline ? '在线' : '离线'}
        </Tag>
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 180,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: any, record: UserRecord) => (
        <Space>
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm title="确定删除该用户？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Tooltip title="删除">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const stats = {
    total: users.length,
    admin: users.filter(u => u.role === 'ADMIN').length,
    agent: users.filter(u => u.role === 'AGENT').length,
    user: users.filter(u => u.role === 'USER').length,
    online: users.filter(u => u.isOnline).length,
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>用户管理</Title>
        <p style={{ color: '#666', margin: '4px 0 0' }}>管理系统中的所有用户账号和权限</p>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: '总用户', value: stats.total, color: '#1677ff' },
          { label: '管理员', value: stats.admin, color: '#f5222d' },
          { label: '专员', value: stats.agent, color: '#1890ff' },
          { label: '普通用户', value: stats.user, color: '#52c41a' },
          { label: '当前在线', value: stats.online, color: '#faad14' },
        ].map((s) => (
          <Card key={s.label} size="small" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* 工具栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Input placeholder="搜索用户名/姓名/邮箱" prefix={<SearchOutlined />}
            value={searchText} onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 240 }} allowClear
          />
          <Select placeholder="角色筛选" value={roleFilter || undefined} onChange={(v) => setRoleFilter(v || '')}
            allowClear style={{ width: 140 }}
          >
            <Select.Option value="ADMIN">管理员</Select.Option>
            <Select.Option value="AGENT">专员</Select.Option>
            <Select.Option value="USER">普通用户</Select.Option>
          </Select>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchUsers}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建用户</Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={filteredUsers} rowKey="id" loading={loading}
        pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 条` }}
        scroll={{ x: 1000 }}
      />

      {/* 新建/编辑弹窗 */}
      <Modal title={editingUser ? '编辑用户' : '新建用户'} open={modalOpen}
        onOk={handleSubmit} onCancel={() => setModalOpen(false)} okText="确定" cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="username" label="用户名"
            rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '至少3个字符' }]}
          >
            <Input disabled={!!editingUser} placeholder="用户名" />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="密码"
              rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '至少6个字符' }]}
            >
              <Input.Password placeholder="密码" />
            </Form.Item>
          )}
          {editingUser && (
            <Form.Item name="password" label="新密码（留空不修改）">
              <Input.Password placeholder="留空则不修改密码" />
            </Form.Item>
          )}
          <Form.Item name="realName" label="真实姓名">
            <Input placeholder="真实姓名（选填）" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '邮箱格式不正确' }]}>
            <Input placeholder="邮箱（选填）" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="ADMIN">管理员</Select.Option>
              <Select.Option value="AGENT">专员</Select.Option>
              <Select.Option value="USER">普通用户</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersPage;
