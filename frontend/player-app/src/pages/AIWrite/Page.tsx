import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  App,
  Button,
  Card,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  BookOutlined,
  FileTextOutlined,
  LinkOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import { aiWriteService, getAiWriteErrorMessage } from '../../services/ai-write.service';
import type {
  AiWriteRecord,
  AiWriteRecordKind,
  AiWriteTimeFilter,
} from '../../types/ai-write';
import {
  AI_WRITE_KIND_OPTIONS,
  AI_WRITE_TIME_FILTER_OPTIONS,
} from '../../types/ai-write';
import './index.css';
import './hub.css';

const { Paragraph, Title } = Typography;

const PAGE_SIZE = 10;
const isUnavailableError = (error: unknown) => isAxiosError(error) && !error.response;

const CREATE_OPTIONS: Array<{
  key: string;
  kind: AiWriteRecordKind;
  title: string;
  subtitle: string;
  disabled?: boolean;
}> = [
  {
    key: 'project',
    kind: 'project',
    title: '项目申请',
    subtitle: '适合基金、立项书和方案申请，按提纲到章节逐步推进。',
  },
  {
    key: 'paper',
    kind: 'paper',
    title: '期刊论文',
    subtitle: '围绕标题、摘要、提纲、章节与全文润色持续写作。',
  },
  {
    key: 'paper-other',
    kind: 'paper',
    title: '其他论文',
    subtitle: '模板暂未开放，后续会扩展更多论文写作类型。',
    disabled: true,
  },
];

const KIND_ICONS: Record<AiWriteRecordKind, JSX.Element> = {
  project: <BookOutlined />,
  paper: <FileTextOutlined />,
};

const formatDateTime = (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm');

const resolveBridgeSourceLabel = (value?: unknown): string | null => {
  if (value === 'ai-check') {
    return '来自 AI 检查整改';
  }
  if (value === 'ai-review') {
    return '来自 AI 评审整改';
  }
  return null;
};

const buildSourceReportPath = (context?: Record<string, unknown> | null): string | null => {
  if (!context) {
    return null;
  }

  const source = context.bridgeSource;
  const recordId =
    typeof context.bridgeSourceRecordId === 'string' ? context.bridgeSourceRecordId.trim() : '';
  const taskType =
    typeof context.bridgeSourceTaskType === 'string' ? context.bridgeSourceTaskType.trim() : '';

  if (!recordId) {
    return null;
  }

  if (source === 'ai-check') {
    const search = new URLSearchParams({ taskId: recordId });
    if (taskType) {
      search.set('taskType', taskType);
    }
    return `/apps/stigpt/check?${search.toString()}`;
  }

  if (source === 'ai-review') {
    const search = new URLSearchParams({ taskId: recordId });
    if (taskType) {
      search.set('taskType', taskType);
    }
    return `/apps/stigpt/review?${search.toString()}`;
  }

  return null;
};

const AIWritePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();

  const [records, setRecords] = useState<AiWriteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [activeKind, setActiveKind] = useState<AiWriteRecordKind>('project');
  const [timeFilter, setTimeFilter] = useState<AiWriteTimeFilter>('all');
  const [pageNo, setPageNo] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string>();

  const deferredSearchText = useDeferredValue(searchText);

  useEffect(() => {
    let cancelled = false;

    const loadRecords = async () => {
      setLoading(true);
      try {
        const result = await aiWriteService.listRecords({
          kind: activeKind,
          searchKey: deferredSearchText.trim() || undefined,
          writingTime: timeFilter,
          pageNo,
          pageSize: PAGE_SIZE,
        });

        if (cancelled) {
          return;
        }

        setRecords(result.records);
        setTotal(result.total);
      } catch (error) {
        if (!cancelled) {
          if (isUnavailableError(error)) {
            setRecords([]);
            setTotal(0);
            return;
          }
          message.error(getAiWriteErrorMessage(error, 'AI 写作列表加载失败。'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRecords();

    return () => {
      cancelled = true;
    };
  }, [activeKind, deferredSearchText, message, pageNo, refreshToken, timeFilter]);

  const openWriter = (kind: AiWriteRecordKind, taskId?: string) => {
    const search = new URLSearchParams();
    search.set('kind', kind);
    search.set('from', `${location.pathname}${location.search}`);
    if (taskId) {
      search.set('taskId', taskId);
    }

    if (kind === 'paper') {
      navigate(`/apps/stigpt/write/detail/essay?${search.toString()}`);
      return;
    }

    navigate(`/apps/stigpt/write/detail?${search.toString()}`);
  };

  const handleDelete = async (record: AiWriteRecord) => {
    setDeletingId(record.id);
    try {
      await aiWriteService.deleteRecord(record.id);
      message.success('写作记录已删除。');
      setRefreshToken((value) => value + 1);
    } catch (error) {
      message.error(getAiWriteErrorMessage(error, '删除写作记录失败。'));
    } finally {
      setDeletingId(undefined);
    }
  };

  const tableColumns: TableColumnsType<AiWriteRecord> = [
    {
      title: '名称',
      dataIndex: 'title',
      key: 'title',
      width: '68%',
      render: (_, record) => (
        <div className="ai-write-table-title-cell">
          <div className="ai-write-table-title-line">
            <div className="ai-write-table-title">{record.title}</div>
            <Tag color="blue">{record.typeLabel}</Tag>
            {record.executionMeta ? (
              <Tag
                color={
                  record.generationMode === 'fallback'
                    ? 'warning'
                    : record.generationMode === 'mixed'
                      ? 'gold'
                      : 'success'
                }
              >
                {record.generationModeLabel}
              </Tag>
            ) : (
              <Tag>待生成</Tag>
            )}
            {record.isActive ? <span className="ai-write-table-live">进行中</span> : null}
          </div>
          <Paragraph ellipsis={{ rows: 2 }} className="ai-write-table-preview">
            {record.previewText || record.statusHint || '暂无摘要内容'}
          </Paragraph>
          <div className="ai-write-table-meta-line">
            <span>{record.researchField || '未填写研究方向'}</span>
            <span>{record.statusLabel} / {record.stageLabel}</span>
            <span>{record.wordCount > 0 ? `${record.wordCount} 字` : '未生成正文'}</span>
            {record.executionMeta?.warnings?.length ? (
              <span>降级提示：{record.executionMeta.warnings[0]}</span>
            ) : null}
          </div>
          {record.context && typeof record.context === 'object' ? (
            <div className="ai-write-table-meta-line ai-write-table-meta-line-secondary">
              {resolveBridgeSourceLabel((record.context as Record<string, unknown>).bridgeSource) ? (
                <span>{resolveBridgeSourceLabel((record.context as Record<string, unknown>).bridgeSource)}</span>
              ) : null}
              {record.executionMeta ? (
                <span>
                  执行轨迹：{record.executionMeta.history.map((item) => item.stage).slice(-3).join(' / ')}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: '最近更新',
      key: 'updatedAt',
      width: 180,
      render: (_, record) => (
        <div className="ai-write-table-date-cell">
          <div>{formatDateTime(record.updatedAt)}</div>
          <span>创建于 {formatDateTime(record.createdAt)}</span>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 152,
      align: 'right',
      render: (_, record) => (
        <div className="ai-write-table-actions">
          <Button
            type="primary"
            ghost
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              openWriter(record.kind, record.id);
            }}
          >
            打开
          </Button>
          {buildSourceReportPath((record.context as Record<string, unknown> | null) || null) ? (
            <Button
              size="small"
              icon={<LinkOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                navigate(
                  buildSourceReportPath((record.context as Record<string, unknown> | null) || null)!,
                );
              }}
            >
              来源报告
            </Button>
          ) : null}
          <Popconfirm
            title="删除这条写作记录？"
            description="提纲、章节和全文草稿都会一并删除。"
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              danger
              size="small"
              loading={deletingId === record.id}
              onClick={(event) => event.stopPropagation()}
            >
              删除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="ai-write-hub-page">
      <section className="ai-tool-hero ai-tool-hero-write">
        <div className="ai-tool-hero-copy">
          <span className="ai-tool-hero-kicker">ScholarMate AI Write</span>
          <h1>AI 写作</h1>
          <p>
            面向项目申请和期刊论文，把资料准备、提纲规划、章节生成、全文润色和检查评审回流放在同一条写作链路里。
          </p>
          <div className="ai-tool-hero-tags">
            <Tag bordered={false}>项目申请</Tag>
            <Tag bordered={false}>期刊论文</Tag>
            <Tag bordered={false}>整改回流</Tag>
          </div>
        </div>
        <div className="ai-tool-hero-side">
          <div className="ai-tool-hero-metric">
            <strong>{total}</strong>
            <span>当前记录</span>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建写作
          </Button>
        </div>
      </section>
      <div className="ai-page-layout ai-write-hub-layout">
        <aside className="ai-page-sidebar ai-write-hub-sidebar">
          <Card className="ai-write-sidebar-card ai-tool-sidebar-panel" variant="borderless">
            <div className="ai-tool-sidebar-header">
              <div className="ai-write-sidebar-brand">
                <div className="ai-write-sidebar-brand-icon">
                  <FileTextOutlined />
                </div>
                <div className="ai-write-sidebar-brand-copy">
                  <div className="ai-tool-sidebar-title">AI 写作</div>
                </div>
              </div>
            </div>
            <div className="ai-tool-sidebar-nav">
              {AI_WRITE_KIND_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`ai-tool-nav-item ${
                    activeKind === item.value ? 'ai-sidebar-nav-item-active' : ''
                  }`}
                  onClick={() => {
                    startTransition(() => {
                      setActiveKind(item.value);
                      setPageNo(1);
                    });
                  }}
                >
                  <div className="ai-tool-nav-icon">{KIND_ICONS[item.value]}</div>
                  <div className="ai-tool-nav-copy">
                    <div className="ai-write-sidebar-nav-title">{item.label}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="ai-tool-sidebar-divider" />
            <div className="ai-tool-sidebar-section">
              <div className="ai-write-filter-head">
                <div className="ai-write-sidebar-section-label">筛选条件</div>
                <button
                  type="button"
                  className="ai-write-filter-reset"
                  onClick={() => {
                    startTransition(() => {
                      setActiveKind('project');
                      setTimeFilter('all');
                      setSearchText('');
                      setPageNo(1);
                    });
                  }}
                >
                  重置
                </button>
              </div>
              <div className="ai-write-sidebar-section-label ai-write-sidebar-section-label-sub">
                写作时间
              </div>
              {AI_WRITE_TIME_FILTER_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`ai-sidebar-filter-item ${
                    timeFilter === item.value ? 'ai-sidebar-filter-item-active' : ''
                  }`}
                  onClick={() => {
                    startTransition(() => {
                      setTimeFilter(item.value);
                      setPageNo(1);
                    });
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Card>
        </aside>

        <section className="ai-page-content ai-write-page-content ai-write-hub-content">
          <div className="ai-write-list-shell">
            <div className="ai-write-list-head">
              <div className="ai-write-list-heading">
                <Title level={3} className="ai-content-title">
                  最近记录
                </Title>
              </div>
              <div className="ai-write-head-actions">
                <Input
                  allowClear
                  className="ai-search-input ai-write-search"
                  prefix={<SearchOutlined />}
                  placeholder="请输入关键词..."
                  value={searchText}
                  onChange={(event) => {
                    startTransition(() => {
                      setSearchText(event.target.value);
                      setPageNo(1);
                    });
                  }}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                  新建写作
                </Button>
              </div>
            </div>

            {loading ? (
              <Card className="ai-write-panel-card ai-write-loading-card" variant="borderless">
                <Spin />
              </Card>
            ) : (
              <div className="ai-write-table-card">
                <Table<AiWriteRecord>
                  rowKey="id"
                  columns={tableColumns}
                  dataSource={records}
                  pagination={false}
                  size="middle"
                  scroll={{ x: 960 }}
                  locale={{ emptyText: '暂无数据' }}
                  rowClassName={() => 'ai-write-record-row'}
                  onRow={(record) => ({
                    onClick: () => openWriter(record.kind, record.id),
                  })}
                />
              </div>
            )}

            <div className="ai-write-pagination">
              <Pagination
                current={pageNo}
                pageSize={PAGE_SIZE}
                total={total}
                onChange={(nextPage) => setPageNo(nextPage)}
                showSizeChanger={false}
                showTotal={(value) => `共 ${value} 条`}
              />
            </div>

            <div className="ai-page-footer">
              AI 生成内容仅作为写作草稿参考，正式提交前请结合真实文献、基金要求与人工判断完成校对。
            </div>
          </div>
        </section>
      </div>

      <Modal
        open={createOpen}
        footer={null}
        onCancel={() => setCreateOpen(false)}
        width={720}
        className="ai-write-create-modal"
        closeIcon={null}
      >
        <div className="ai-write-create-modal-head">
          <div className="ai-write-create-modal-title">新建 AI 写作</div>
          <div className="ai-write-create-modal-subtitle">
            选择你要创建的写作类型，继续沿用现有创建流程进入对应写作详情页。
          </div>
        </div>
        <div className="ai-write-create-options">
          {CREATE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`ai-write-create-option ${option.disabled ? 'is-disabled' : ''}`}
              disabled={option.disabled}
              onClick={() => {
                if (option.disabled) {
                  return;
                }
                setCreateOpen(false);
                openWriter(option.kind);
              }}
            >
              <div className="ai-write-create-option-icon">
                <FileTextOutlined />
              </div>
              <div className="ai-write-create-option-title">{option.title}</div>
              <div className="ai-write-create-option-subtitle">{option.subtitle}</div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default AIWritePage;
