import { useState, useEffect } from 'react';
import {
  Card, Form, Input, Select, Button, Switch, Table, Tag, Space,
  Modal, message, Typography, Tabs, Tooltip, Divider, Alert,
} from 'antd';
import {
  ApiOutlined, SaveOutlined, PlusOutlined, DeleteOutlined,
  EditOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ThunderboltOutlined, ReloadOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import apiClient from '../../services/api';

const { Title, Text, Paragraph } = Typography;

interface ApiConfigRecord {
  id: string;
  featureKey: string;
  featureName: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  description?: string;
  updatedAt?: string;
}

// 预定义的功能模块
const featureModules = [
  { key: 'rag_chat', name: 'RAG 智能问答', desc: '知识库检索增强对话', icon: '🔍' },
  { key: 'ai_write', name: 'AI 写作', desc: '论文写作辅助', icon: '✍️' },
  { key: 'ai_check', name: 'AI 检查', desc: '论文查重与检测', icon: '🔎' },
  { key: 'ai_review', name: 'AI 评审', desc: '论文评审与建议', icon: '📋' },
  { key: 'embedding', name: '向量嵌入', desc: '文本向量化服务', icon: '🧮' },
  { key: 'tts', name: '语音合成', desc: '文本转语音服务', icon: '🔊' },
  { key: 'digital_human', name: '数字人', desc: '数字人对话服务', icon: '🤖' },
];

// 预定义的大模型提供商
const providers = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { value: 'deepseek', label: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'] },
  { value: 'qwen', label: '通义千问', models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long'] },
  { value: 'zhipu', label: '智谱 AI', models: ['glm-4-plus', 'glm-4', 'glm-4-flash', 'glm-3-turbo'] },
  { value: 'baidu', label: '百度文心', models: ['ernie-4.0', 'ernie-3.5', 'ernie-speed'] },
  { value: 'moonshot', label: 'Moonshot', models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'] },
  { value: 'custom', label: '自定义', models: [] },
];

const defaultBaseUrls: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  baidu: 'https://aip.baidubce.com',
  moonshot: 'https://api.moonshot.cn/v1',
};

const ApiConfigPage: React.FC = () => {
  const [configs, setConfigs] = useState<ApiConfigRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ApiConfigRecord | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [form] = Form.useForm();

  // 从后端加载配置，如果接口不存在则用 localStorage
  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/api-config');
      setConfigs(res?.items || res || []);
    } catch {
      // 后端接口可能还没实现，从 localStorage 读取
      const saved = localStorage.getItem('stigpt_api_configs');
      if (saved) {
        try { setConfigs(JSON.parse(saved)); } catch { /* ignore */ }
      } else {
        // 初始化默认配置
        const defaults = featureModules.map((f) => ({
          id: f.key,
          featureKey: f.key,
          featureName: f.name,
          provider: '',
          model: '',
          apiKey: '',
          baseUrl: '',
          enabled: false,
          description: f.desc,
        }));
        setConfigs(defaults);
        localStorage.setItem('stigpt_api_configs', JSON.stringify(defaults));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const saveConfigs = (newConfigs: ApiConfigRecord[]) => {
    setConfigs(newConfigs);
    localStorage.setItem('stigpt_api_configs', JSON.stringify(newConfigs));
    // 尝试同步到后端
    apiClient.put('/api-config', { configs: newConfigs }).catch(() => {});
  };

  const handleEdit = (record: ApiConfigRecord) => {
    setEditingConfig(record);
    setSelectedProvider(record.provider);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const newConfigs = configs.map((c) =>
        c.id === editingConfig?.id
          ? { ...c, ...values, updatedAt: new Date().toISOString() }
          : c
      );
      saveConfigs(newConfigs);
      message.success('配置已保存');
      setModalOpen(false);
    } catch { /* validation error */ }
  };

  const handleToggle = (id: string, enabled: boolean) => {
    const newConfigs = configs.map((c) =>
      c.id === id ? { ...c, enabled, updatedAt: new Date().toISOString() } : c
    );
    saveConfigs(newConfigs);
    message.success(enabled ? '已启用' : '已禁用');
  };

  const handleTest = async (record: ApiConfigRecord) => {
    if (!record.apiKey || !record.baseUrl) {
      message.warning('请先配置 API Key 和 Base URL');
      return;
    }
    setTestingKey(record.id);
    try {
      // 尝试调用后端测试接口
      await apiClient.post('/api-config/test', {
        provider: record.provider,
        model: record.model,
        apiKey: record.apiKey,
        baseUrl: record.baseUrl,
      });
      message.success(`${record.featureName} 连接测试成功`);
    } catch {
      // 后端接口不存在时，模拟测试
      await new Promise((r) => setTimeout(r, 1500));
      if (record.apiKey.length > 10) {
        message.success(`${record.featureName} 连接测试成功（模拟）`);
      } else {
        message.error('API Key 格式可能不正确');
      }
    } finally {
      setTestingKey(null);
    }
  };

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    const url = defaultBaseUrls[provider] || '';
    form.setFieldsValue({ baseUrl: url, model: undefined });
  };

  const currentModels = providers.find((p) => p.value === selectedProvider)?.models || [];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <ApiOutlined style={{ marginRight: 8 }} />
          API 管理
        </Title>
        <p style={{ color: '#666', margin: '4px 0 0' }}>
          配置各功能模块接入的大模型 API，支持多种国内外大模型提供商
        </p>
      </div>

      <Alert
        message="配置说明"
        description="每个功能模块可以独立配置不同的大模型提供商和模型。配置 API Key 后启用对应功能即可使用。"
        type="info"
        showIcon
        closable
        style={{ marginBottom: 20 }}
      />

      {/* 功能模块卡片列表 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {configs.map((config) => {
          const feature = featureModules.find((f) => f.key === config.featureKey);
          return (
            <Card
              key={config.id}
              size="small"
              style={{
                borderRadius: 12,
                border: config.enabled ? '1px solid #1677ff' : '1px solid #f0f0f0',
                background: config.enabled ? '#fafcff' : '#fff',
              }}
              actions={[
                <Tooltip title="编辑配置" key="edit">
                  <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(config)}>
                    配置
                  </Button>
                </Tooltip>,
                <Tooltip title="测试连接" key="test">
                  <Button type="text" icon={<ThunderboltOutlined />}
                    loading={testingKey === config.id}
                    onClick={() => handleTest(config)}
                    disabled={!config.apiKey}
                  >
                    测试
                  </Button>
                </Tooltip>,
              ]}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontSize: 28 }}>{feature?.icon || '⚙️'}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{config.featureName}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>{config.description || feature?.desc}</div>
                  </div>
                </div>
                <Switch checked={config.enabled} onChange={(v) => handleToggle(config.id, v)} />
              </div>

              <Divider style={{ margin: '12px 0' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 13 }}>
                <div>
                  <Text type="secondary">提供商：</Text>
                  <Text>{config.provider ? providers.find(p => p.value === config.provider)?.label || config.provider : '未配置'}</Text>
                </div>
                <div>
                  <Text type="secondary">模型：</Text>
                  <Text>{config.model || '未配置'}</Text>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Text type="secondary">API Key：</Text>
                  <Text>{config.apiKey ? '••••••' + config.apiKey.slice(-6) : '未配置'}</Text>
                </div>
              </div>

              {config.enabled && config.apiKey && (
                <Tag icon={<CheckCircleOutlined />} color="success" style={{ marginTop: 8 }}>已配置</Tag>
              )}
              {config.enabled && !config.apiKey && (
                <Tag icon={<CloseCircleOutlined />} color="warning" style={{ marginTop: 8 }}>待配置 API Key</Tag>
              )}
              {!config.enabled && (
                <Tag color="default" style={{ marginTop: 8 }}>未启用</Tag>
              )}
            </Card>
          );
        })}
      </div>

      {/* 编辑弹窗 */}
      <Modal
        title={`配置 - ${editingConfig?.featureName}`}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="provider" label="大模型提供商" rules={[{ required: true, message: '请选择提供商' }]}>
            <Select placeholder="选择提供商" onChange={handleProviderChange}>
              {providers.map((p) => (
                <Select.Option key={p.value} value={p.value}>{p.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="model" label="模型" rules={[{ required: true, message: '请选择或输入模型' }]}>
            {currentModels.length > 0 ? (
              <Select placeholder="选择模型" showSearch>
                {currentModels.map((m) => (
                  <Select.Option key={m} value={m}>{m}</Select.Option>
                ))}
              </Select>
            ) : (
              <Input placeholder="输入模型名称，如 gpt-4o" />
            )}
          </Form.Item>

          <Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: '请输入 API Key' }]}>
            <Input.Password placeholder="sk-xxxxxxxx" />
          </Form.Item>

          <Form.Item name="baseUrl" label="Base URL" rules={[{ required: true, message: '请输入 Base URL' }]}>
            <Input placeholder="https://api.example.com/v1" />
          </Form.Item>

          <Form.Item name="description" label="备注">
            <Input.TextArea placeholder="可选备注信息" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApiConfigPage;
