import { useEffect, useState } from 'react';
import { Form, Input, Button, Card, Typography } from 'antd';
import { UserOutlined, LockOutlined, ExperimentOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login, saveUserInfo } from '../../services/auth.service';
import { useAuthStore } from '../../stores/authStore';
import type { LoginRequest } from '../../types';
import { useMessage } from '../../hooks/useMessage';
import './index.css';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuthStore();
  const message = useMessage();

  useEffect(() => {
    const token = searchParams.get('token');
    const userStr = searchParams.get('user');
    if (!token || !userStr) return;

    try {
      const user = JSON.parse(userStr);
      saveUserInfo(token, user);
      setUser(user);
      import('../../services/websocket.service').then(({ websocketService }) => {
        websocketService.connect(token);
      });
      message.success('登录成功，欢迎使用科研之友 AI 管理后台');
      navigate(user.role === 'ADMIN' ? '/dashboard' : '/workbench/active', {
        replace: true,
      });
    } catch {
      // Ignore malformed handoff parameters and keep the normal login page.
    }
  }, [searchParams, setUser, navigate, message]);

  const handleLogin = async (values: LoginRequest) => {
    setLoading(true);
    try {
      const response = await login(values);

      if (response.user.role !== 'ADMIN' && response.user.role !== 'AGENT') {
        message.success('登录成功，正在跳转用户端');
        const playerUrl = import.meta.env.VITE_PLAYER_URL || getPlayerUrl();
        const params = new URLSearchParams({
          token: response.accessToken,
          user: JSON.stringify(response.user),
        });
        window.setTimeout(() => {
          window.location.href = `${playerUrl}/login?${params.toString()}`;
        }, 500);
        return;
      }

      saveUserInfo(response.accessToken, response.user);
      setUser(response.user);

      const { websocketService } = await import('../../services/websocket.service');
      websocketService.connect(response.accessToken);

      message.success('登录成功，欢迎使用科研之友 AI 管理后台');
      navigate(response.user.role === 'ADMIN' ? '/dashboard' : '/workbench/active');
    } catch (error: any) {
      if (error?.response?.status === 401) {
        message.error(error.response?.data?.message || '用户名或密码错误');
      } else if (error?.response) {
        message.error(error.response.data?.message || '登录失败，请重试');
      } else if (error?.message) {
        message.error(error.message);
      } else {
        message.error('网络连接失败，请检查网络后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-content-wrapper">
        <div className="login-content">
          <Card className="login-card">
            <div className="login-header">
              <div className="brand-section">
                <ExperimentOutlined className="brand-icon" />
                <Title level={1} className="brand-title">
                  科研之友 AI 管理后台
                </Title>
                <Text className="brand-subtitle">科研智能工作台 · 管理后台</Text>
              </div>

              <div className="login-title-section">
                <Title level={2}>欢迎登录</Title>
                <Text type="secondary">请使用管理账号进入系统</Text>
              </div>
            </div>

            <Form
              name="login"
              onFinish={handleLogin}
              autoComplete="off"
              size="large"
              className="login-form"
            >
              <Form.Item
                name="username"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 3, message: '用户名至少 3 个字符' },
                ]}
              >
                <Input
                  prefix={<UserOutlined className="input-icon" />}
                  placeholder="请输入用户名"
                  autoComplete="username"
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '密码至少 6 个字符' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined className="input-icon" />}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  className="login-button"
                >
                  {loading ? '登录中...' : '立即登录'}
                </Button>
              </Form.Item>
            </Form>

            <div className="login-footer">
              <Text type="secondary" style={{ fontSize: '12px' }}>
                © 2025 科研之友 AI
              </Text>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

function getPlayerUrl(): string {
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:32112`;
}
