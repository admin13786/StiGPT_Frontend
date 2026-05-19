import { useEffect, useState } from 'react';
import { App, Button, Form, Input } from 'antd';
import { IdcardOutlined, LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../stores/authStore';
import './index.css';

type Mode = 'login' | 'register';

const DEFAULT_POST_LOGIN_PATH = '/apps';
const DEFAULT_ADMIN_PORT = '32111';

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    const userStr = searchParams.get('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setAuth(user, token);
        message.success('登录成功');
        navigate(DEFAULT_POST_LOGIN_PATH, { replace: true });
      } catch {
        // Keep the normal login form visible when callback payload is invalid.
      }
    }
  }, [searchParams, setAuth, navigate, message]);

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await authService.login(values);
      const { user, accessToken } = res;

      if (user.role === 'ADMIN' || user.role === 'AGENT') {
        message.success('登录成功，正在跳转管理后台');
        const adminUrl = resolveAdminUrl();
        const params = new URLSearchParams({
          token: accessToken,
          user: JSON.stringify(user),
        });
        setTimeout(() => {
          window.location.href = `${adminUrl}/login?${params.toString()}`;
        }, 500);
        return;
      }

      setAuth(user, accessToken);
      message.success('登录成功');
      navigate(DEFAULT_POST_LOGIN_PATH, { replace: true });
    } catch (error: any) {
      if (error?.response?.status === 401) {
        message.error(error.response?.data?.message || '用户名或密码错误');
      } else {
        message.error('登录失败，请检查网络连接');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: {
    username: string;
    password: string;
    confirmPassword: string;
    realName?: string;
    email?: string;
  }) => {
    setLoading(true);
    try {
      const res = await authService.register({
        username: values.username,
        password: values.password,
        realName: values.realName,
        email: values.email,
      });
      const { user, accessToken } = res;
      setAuth(user, accessToken);
      message.success('注册成功，欢迎使用科研之友');
      navigate(DEFAULT_POST_LOGIN_PATH, { replace: true });
    } catch (error: any) {
      message.error(error?.response?.data?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-intro">
          <div className="login-brand-mark">科</div>
          <div className="login-kicker">ScholarMate Apps</div>
          <h1>科研之友应用中心</h1>
          <p>
            集中管理个人主页、文献收藏、项目组协作和 AI 科研助手，让问答、写作、检查、
            评审自然衔接成一条科研工作流。
          </p>
          <div className="login-feature-grid">
            <span>AI 问答</span>
            <span>AI 写作</span>
            <span>AI 检查</span>
            <span>AI 评审</span>
          </div>
        </section>

        <section className="login-card">
          <div className="login-card-head">
            <div>
              <div className="login-title">{mode === 'login' ? '登录' : '注册'}</div>
              <div className="login-subtitle">
                {mode === 'login' ? '进入你的科研工作台' : '创建一个科研之友账号'}
              </div>
            </div>
          </div>

          {mode === 'login' ? (
            <Form name="login" onFinish={handleLogin} autoComplete="off" size="large" className="login-form">
              <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="current-password" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block className="login-btn">
                {loading ? '登录中...' : '登录'}
              </Button>
            </Form>
          ) : (
            <Form name="register" onFinish={handleRegister} autoComplete="off" size="large" className="login-form">
              <Form.Item
                name="username"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 3, message: '用户名至少 3 个字符' },
                  { max: 20, message: '用户名最多 20 个字符' },
                  { pattern: /^[a-zA-Z0-9_]+$/, message: '只能包含字母、数字和下划线' },
                ]}
              >
                <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
              </Form.Item>
              <Form.Item name="realName">
                <Input prefix={<IdcardOutlined />} placeholder="真实姓名（选填）" />
              </Form.Item>
              <Form.Item name="email" rules={[{ type: 'email', message: '邮箱格式不正确' }]}>
                <Input prefix={<MailOutlined />} placeholder="邮箱（选填）" />
              </Form.Item>
              <Form.Item
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '密码至少 6 个字符' },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请确认密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) return Promise.resolve();
                      return Promise.reject(new Error('两次密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="确认密码" autoComplete="new-password" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block className="login-btn">
                {loading ? '注册中...' : '注册'}
              </Button>
            </Form>
          )}

          <div className="login-footer">
            {mode === 'login' ? (
              <span>
                还没有账号？
                <button type="button" onClick={() => setMode('register')}>立即注册</button>
              </span>
            ) : (
              <span>
                已有账号？
                <button type="button" onClick={() => setMode('login')}>返回登录</button>
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

function resolveAdminUrl(): string {
  const configuredUrl = import.meta.env.VITE_ADMIN_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${DEFAULT_ADMIN_PORT}`;
}

export default LoginPage;
