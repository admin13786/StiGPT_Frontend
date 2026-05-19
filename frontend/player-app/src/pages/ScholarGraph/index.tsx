import { startTransition, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  List,
  Radio,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ApartmentOutlined,
  ArrowRightOutlined,
  ClusterOutlined,
  ReadOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { graphService, getGraphErrorMessage } from '../../services/graph.service';
import type {
  GraphAuthorDetail,
  GraphAuthorSearchItem,
  GraphEntityType,
  GraphInstitutionDetail,
  GraphInstitutionSearchItem,
  GraphPaperDetail,
  GraphPaperRelations,
  GraphPaperSearchItem,
  GraphSearchQuery,
  GraphSearchResponse,
  GraphSearchType,
  GraphTopicSearchItem,
} from '../../types/graph';
import './index.css';

const { Paragraph, Text, Title } = Typography;

type ActiveEntity =
  | { type: 'paper'; id: string }
  | { type: 'author'; id: string }
  | { type: 'institution'; id: string }
  | { type: 'topic'; id: string; name: string };

type GraphDetailState =
  | { type: 'paper'; paper: GraphPaperDetail; relations: GraphPaperRelations }
  | { type: 'author'; author: GraphAuthorDetail }
  | { type: 'institution'; institution: GraphInstitutionDetail }
  | { type: 'topic'; topic: GraphTopicSearchItem };

const SEARCH_TYPE_OPTIONS: Array<{ label: string; value: GraphSearchType }> = [
  { label: '全部', value: 'all' },
  { label: '论文', value: 'paper' },
  { label: '作者', value: 'author' },
  { label: '机构', value: 'institution' },
  { label: '主题', value: 'topic' },
];

const formatDate = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD') : '--';

const formatMetaLine = (...parts: Array<string | number | null | undefined>) =>
  parts.filter(Boolean).join(' · ');

const getItemTitle = (
  type: GraphEntityType,
  item:
    | GraphPaperSearchItem
    | GraphAuthorSearchItem
    | GraphInstitutionSearchItem
    | GraphTopicSearchItem,
) => {
  if (type === 'paper') {
    return (item as GraphPaperSearchItem).title;
  }

  return (item as GraphAuthorSearchItem | GraphInstitutionSearchItem | GraphTopicSearchItem)
    .name;
};

type GraphSurfaceMode = 'graph' | 'achievement';

const GRAPH_SURFACE_CONFIG: Record<
  GraphSurfaceMode,
  {
    tag: string;
    title: string;
    description: string;
    placeholder: string;
    buttonLabel: string;
    emptyDescription: string;
    detailEmptyDescription: string;
    defaultSearchType: GraphSearchType;
  }
> = {
  graph: {
    tag: '学术图谱',
    title: '搜索论文、作者、机构与主题关联',
    description:
      '这里把图谱能力收成一个真正可用的科研导航页。你可以从论文跳到作者，从机构定位核心研究者，再从主题反向发现相关论文。',
    placeholder: '搜索论文、作者、机构或主题',
    buttonLabel: '搜索图谱',
    emptyDescription: '搜索学术图谱后，可查看论文、作者、机构与主题之间的关联。',
    detailEmptyDescription: '选择左侧图谱实体后，这里会展示对应的论文、作者、机构或主题详情。',
    defaultSearchType: 'all',
  },
  achievement: {
    tag: '文献查真',
    title: '核验论文、作者与机构关系',
    description:
      '这里把文献查真能力落到真实可搜索的数据关系上。你可以先核验论文，再追溯作者、机构与主题关联，辅助判断文献来源和上下文是否可信。',
    placeholder: '输入论文标题、作者、机构或主题关键词',
    buttonLabel: '开始查真',
    emptyDescription: '输入论文、作者、机构或主题后，可在这里核验关系链与基础信息。',
    detailEmptyDescription: '选择左侧实体后，这里会展示对应的论文、作者、机构或主题核验详情。',
    defaultSearchType: 'paper',
  },
};

const ScholarGraphPage = () => {
  const location = useLocation();
  const [messageApi, contextHolder] = message.useMessage();
  const [query, setQuery] = useState('');
  const surfaceMode: GraphSurfaceMode = location.pathname.includes('/achievement')
    ? 'achievement'
    : 'graph';
  const surfaceConfig = GRAPH_SURFACE_CONFIG[surfaceMode];
  const [searchType, setSearchType] = useState<GraphSearchType>(surfaceConfig.defaultSearchType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<GraphSearchResponse | null>(null);
  const [activeEntity, setActiveEntity] = useState<ActiveEntity | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<GraphDetailState | null>(null);

  useEffect(() => {
    setSearchType(surfaceConfig.defaultSearchType);
    setSearchResult(null);
    setActiveEntity(null);
    setDetail(null);
    setDetailError(null);
    setError(null);
  }, [surfaceConfig.defaultSearchType]);

  const summaryTotals = useMemo(() => {
    if (!searchResult) {
      return {
        papers: 0,
        authors: 0,
        institutions: 0,
        topics: 0,
      };
    }

    if (searchResult.type === 'all') {
      return searchResult.totals;
    }

    return {
      papers: searchResult.type === 'paper' ? searchResult.total : 0,
      authors: searchResult.type === 'author' ? searchResult.total : 0,
      institutions: searchResult.type === 'institution' ? searchResult.total : 0,
      topics: searchResult.type === 'topic' ? searchResult.total : 0,
    };
  }, [searchResult]);

  const runSearch = async (
    overrides?: Partial<GraphSearchQuery> & { openFirst?: boolean },
  ) => {
    const nextType = overrides?.type || searchType;
    const nextQuery = overrides?.q ?? query;
    const openFirst = overrides?.openFirst ?? true;

    setLoading(true);
    setError(null);

    try {
      const response = await graphService.search({
        q: nextQuery.trim() || undefined,
        type: nextType,
        pageNo: overrides?.pageNo || 1,
        pageSize: overrides?.pageSize || 8,
      });

      startTransition(() => {
        setSearchResult(response);
      });

      if (!openFirst) {
        return;
      }

      const firstEntity = pickFirstEntity(response);
      if (firstEntity) {
        await openEntity(firstEntity, false);
      } else {
        setActiveEntity(null);
        setDetail(null);
      }
    } catch (searchError) {
      const nextMessage = getGraphErrorMessage(searchError);
      setError(nextMessage);
      messageApi.error(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const openEntity = async (entity: ActiveEntity, showToast = false) => {
    if (entity.type === 'topic') {
      setActiveEntity(entity);
      setDetail({
        type: 'topic',
        topic: {
          id: entity.id,
          name: entity.name,
          normalizedName: entity.name.toLowerCase(),
        },
      });
      setDetailError(null);
      return;
    }

    setActiveEntity(entity);
    setDetailLoading(true);
    setDetailError(null);

    try {
      if (entity.type === 'paper') {
        const [paper, relations] = await Promise.all([
          graphService.getPaper(entity.id),
          graphService.getPaperRelations(entity.id),
        ]);

        setDetail({
          type: 'paper',
          paper,
          relations,
        });
      } else if (entity.type === 'author') {
        const author = await graphService.getAuthor(entity.id);
        setDetail({
          type: 'author',
          author,
        });
      } else if (entity.type === 'institution') {
        const institution = await graphService.getInstitution(entity.id);
        setDetail({
          type: 'institution',
          institution,
        });
      }

      if (showToast) {
        messageApi.success('图谱详情已加载。');
      }
    } catch (entityError) {
      const nextMessage = getGraphErrorMessage(entityError);
      setDetailError(nextMessage);
      if (showToast) {
        messageApi.error(nextMessage);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    runSearch({
      type: 'all',
      q: '',
      openFirst: true,
    });
  }, []);

  const renderPaperItem = (item: GraphPaperSearchItem) => (
    <button
      key={item.id}
      type="button"
      className={`graph-result-item ${
        activeEntity?.type === 'paper' && activeEntity.id === item.id ? 'graph-result-item-active' : ''
      }`}
      onClick={() => openEntity({ type: 'paper', id: item.id }, true)}
    >
      <div className="graph-result-item-head">
        <Tag color="blue">论文</Tag>
        <Text type="secondary">
          {formatMetaLine(item.year, item.venue || item.discipline)}
        </Text>
      </div>
      <div className="graph-result-item-title">{item.title}</div>
      <div className="graph-result-item-meta">
        {formatMetaLine(
          item.subField,
          `${item._count?.authors || 0} 位作者`,
          `${item._count?.citedBy || item.citationCount || 0} 次被引`,
        )}
      </div>
    </button>
  );

  const renderAuthorItem = (item: GraphAuthorSearchItem) => (
    <button
      key={item.id}
      type="button"
      className={`graph-result-item ${
        activeEntity?.type === 'author' && activeEntity.id === item.id ? 'graph-result-item-active' : ''
      }`}
      onClick={() => openEntity({ type: 'author', id: item.id }, true)}
    >
      <div className="graph-result-item-head">
        <Tag color="gold">作者</Tag>
        <Text type="secondary">{item.hIndex ? `H 指数 ${item.hIndex}` : '作者画像'}</Text>
      </div>
      <div className="graph-result-item-title">{item.name}</div>
      <div className="graph-result-item-meta">
        {formatMetaLine(
          item.affiliation,
          `${item._count?.papers || 0} 篇论文`,
          `${(item._count?.collaborationsFrom || 0) + (item._count?.collaborationsTo || 0)} 条关联`,
        )}
      </div>
    </button>
  );

  const renderInstitutionItem = (item: GraphInstitutionSearchItem) => (
    <button
      key={item.id}
      type="button"
      className={`graph-result-item ${
        activeEntity?.type === 'institution' && activeEntity.id === item.id
          ? 'graph-result-item-active'
          : ''
      }`}
      onClick={() => openEntity({ type: 'institution', id: item.id }, true)}
    >
      <div className="graph-result-item-head">
        <Tag color="green">机构</Tag>
        <Text type="secondary">{formatMetaLine(item.country, item.city)}</Text>
      </div>
      <div className="graph-result-item-title">{item.name}</div>
      <div className="graph-result-item-meta">
        {formatMetaLine(item.nameEn, `${item._count?.authors || 0} 位关联作者`)}
      </div>
    </button>
  );

  const renderTopicItem = (item: GraphTopicSearchItem) => (
    <button
      key={item.id}
      type="button"
      className={`graph-result-item ${
        activeEntity?.type === 'topic' && activeEntity.id === item.id ? 'graph-result-item-active' : ''
      }`}
      onClick={() => openEntity({ type: 'topic', id: item.id, name: item.name }, true)}
    >
      <div className="graph-result-item-head">
        <Tag color="purple">主题</Tag>
        <Text type="secondary">{`${item._count?.papers || 0} 篇关联论文`}</Text>
      </div>
      <div className="graph-result-item-title">{item.name}</div>
      <div className="graph-result-item-meta">{item.normalizedName}</div>
    </button>
  );

  const renderResultSection = (
    title: string,
    icon: React.ReactNode,
    items: React.ReactNode[],
  ) => (
    <Card
      className="graph-results-section"
      title={
        <Space size={8}>
          {icon}
          <span>{title}</span>
        </Space>
      }
      bordered={false}
    >
      {items.length > 0 ? items : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无匹配结果" />}
    </Card>
  );

  const renderSearchResults = () => {
    if (loading) {
      return (
        <div className="graph-state">
          <Spin />
        </div>
      );
    }

    if (error) {
      return <Alert type="error" showIcon message={error} />;
    }

    if (!searchResult) {
      return <Empty description={surfaceConfig.emptyDescription} />;
    }

    if (searchResult.type === 'all') {
      return (
        <div className="graph-all-results">
          {renderResultSection(
            '论文',
            <ReadOutlined />,
            searchResult.results.papers.map(renderPaperItem),
          )}
          {renderResultSection(
            '作者',
            <TeamOutlined />,
            searchResult.results.authors.map(renderAuthorItem),
          )}
          {renderResultSection(
            '机构',
            <ApartmentOutlined />,
            searchResult.results.institutions.map(renderInstitutionItem),
          )}
          {renderResultSection(
            '主题',
            <ClusterOutlined />,
            searchResult.results.topics.map(renderTopicItem),
          )}
        </div>
      );
    }

    const items =
      searchResult.type === 'paper'
        ? (searchResult.items as GraphPaperSearchItem[]).map(renderPaperItem)
        : searchResult.type === 'author'
          ? (searchResult.items as GraphAuthorSearchItem[]).map(renderAuthorItem)
          : searchResult.type === 'institution'
            ? (searchResult.items as GraphInstitutionSearchItem[]).map(renderInstitutionItem)
            : (searchResult.items as GraphTopicSearchItem[]).map(renderTopicItem);

    return (
      <Card
        className="graph-results-section"
        bordered={false}
        title={`共 ${searchResult.total} 条结果`}
      >
        {items.length > 0 ? items : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无匹配结果" />}
      </Card>
    );
  };

  const renderPaperDetail = (paperDetail: GraphPaperDetail, relations: GraphPaperRelations) => (
    <>
      <div className="graph-detail-header">
        <Tag color="blue">论文</Tag>
        <Title level={4}>{paperDetail.title}</Title>
        <Paragraph type="secondary">
          {formatMetaLine(
            paperDetail.year,
            paperDetail.venue,
            paperDetail.discipline,
            paperDetail.subField,
          )}
        </Paragraph>
      </div>

      <div className="graph-stat-grid">
        <Card bordered={false}>
          <Statistic title="作者" value={paperDetail.authors.length} />
        </Card>
        <Card bordered={false}>
          <Statistic title="主题" value={paperDetail.topics.length} />
        </Card>
        <Card bordered={false}>
          <Statistic title="参考文献" value={relations.references.length} />
        </Card>
        <Card bordered={false}>
          <Statistic title="被引" value={relations.citedBy.length} />
        </Card>
      </div>

      <Card className="graph-detail-card" bordered={false} title="论文快照">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="状态">{paperDetail.status || '--'}</Descriptions.Item>
          <Descriptions.Item label="语言">{paperDetail.language || '--'}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{formatDate(paperDetail.updatedAt)}</Descriptions.Item>
        </Descriptions>
        <Paragraph className="graph-detail-paragraph">
          {paperDetail.abstract || '当前论文还没有可展示的摘要内容。'}
        </Paragraph>
      </Card>

      <Card className="graph-detail-card" bordered={false} title="作者">
        <div className="graph-chip-list">
          {paperDetail.authors.map((author) => (
            <button
              key={author.id}
              type="button"
              className="graph-chip-button"
              onClick={() => openEntity({ type: 'author', id: author.id }, true)}
            >
              {author.name}
            </button>
          ))}
        </div>
      </Card>

      <Card className="graph-detail-card" bordered={false} title="主题">
        <div className="graph-chip-list">
          {paperDetail.topics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              className="graph-chip-button graph-chip-button-light"
              onClick={() => {
                setQuery(topic.name);
                setSearchType('paper');
                runSearch({ q: topic.name, type: 'paper', openFirst: false });
                openEntity({ type: 'topic', id: topic.id, name: topic.name }, true);
              }}
            >
              {topic.name}
            </button>
          ))}
        </div>
      </Card>

      <Card className="graph-detail-card" bordered={false} title="参考文献">
        <List
          dataSource={relations.references.slice(0, 8)}
          locale={{ emptyText: '当前还没有索引到参考文献。' }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="open"
                  type="link"
                  size="small"
                  onClick={() => openEntity({ type: 'paper', id: item.id }, true)}
                >
                  打开
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={item.title}
                description={formatMetaLine(item.year, item.venue, `${item.citationCount || 0} 次被引`)}
              />
            </List.Item>
          )}
        />
      </Card>

      <Card className="graph-detail-card" bordered={false} title="被引论文">
        <List
          dataSource={relations.citedBy.slice(0, 8)}
          locale={{ emptyText: '当前还没有索引到引用关系。' }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="open"
                  type="link"
                  size="small"
                  onClick={() => openEntity({ type: 'paper', id: item.id }, true)}
                >
                  打开
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={item.title}
                description={formatMetaLine(item.year, item.venue, `${item.citationCount || 0} 次被引`)}
              />
            </List.Item>
          )}
        />
      </Card>
    </>
  );

  const renderAuthorDetail = (authorDetail: GraphAuthorDetail) => (
    <>
      <div className="graph-detail-header">
        <Tag color="gold">作者</Tag>
        <Title level={4}>{authorDetail.name}</Title>
        <Paragraph type="secondary">
          {formatMetaLine(authorDetail.affiliation, authorDetail.hIndex ? `H 指数 ${authorDetail.hIndex}` : '')}
        </Paragraph>
      </div>

      <div className="graph-stat-grid">
        <Card bordered={false}>
          <Statistic title="论文" value={authorDetail.stats.paperCount} />
        </Card>
        <Card bordered={false}>
          <Statistic title="机构" value={authorDetail.stats.institutionCount} />
        </Card>
        <Card bordered={false}>
          <Statistic title="合作者" value={authorDetail.stats.collaborationCount} />
        </Card>
      </div>

      <Card className="graph-detail-card" bordered={false} title="机构关联">
        <div className="graph-chip-list">
          {authorDetail.institutions.map((institution) => (
            <button
              key={institution.id}
              type="button"
              className="graph-chip-button"
              onClick={() => openEntity({ type: 'institution', id: institution.id }, true)}
            >
              {institution.name}
            </button>
          ))}
        </div>
      </Card>

      <Card className="graph-detail-card" bordered={false} title="核心合作者">
        <List
          dataSource={authorDetail.topCollaborators.slice(0, 8)}
          locale={{ emptyText: '当前还没有索引到合作者关系。' }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="open"
                  type="link"
                  size="small"
                  onClick={() => openEntity({ type: 'author', id: item.id }, true)}
                >
                  打开
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={item.name}
                description={formatMetaLine(item.affiliation, `${item.paperCount} 篇合作论文`, item.lastYear)}
              />
            </List.Item>
          )}
        />
      </Card>

      <Card className="graph-detail-card" bordered={false} title="近期论文">
        <List
          dataSource={authorDetail.papers.slice(0, 10)}
          locale={{ emptyText: '当前还没有关联论文。' }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="open"
                  type="link"
                  size="small"
                  onClick={() => openEntity({ type: 'paper', id: item.id }, true)}
                >
                  打开
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={item.title}
                description={formatMetaLine(item.year, item.venue, item.subField)}
              />
            </List.Item>
          )}
        />
      </Card>
    </>
  );

  const renderInstitutionDetail = (institutionDetail: GraphInstitutionDetail) => (
    <>
      <div className="graph-detail-header">
        <Tag color="green">机构</Tag>
        <Title level={4}>{institutionDetail.name}</Title>
        <Paragraph type="secondary">
          {formatMetaLine(institutionDetail.nameEn, institutionDetail.country, institutionDetail.city)}
        </Paragraph>
      </div>

      <div className="graph-stat-grid">
        <Card bordered={false}>
          <Statistic title="关联作者" value={institutionDetail.stats.authorCount} />
        </Card>
      </div>

      <Card className="graph-detail-card" bordered={false} title="机构画像">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="标准化标识">
            {institutionDetail.normalizedName}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {formatDate(institutionDetail.updatedAt)}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card className="graph-detail-card" bordered={false} title="代表作者">
        <List
          dataSource={institutionDetail.topAuthors.slice(0, 12)}
          locale={{ emptyText: '当前还没有索引到机构作者关系。' }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="open"
                  type="link"
                  size="small"
                  onClick={() => openEntity({ type: 'author', id: item.id }, true)}
                >
                  打开
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={item.name}
                description={formatMetaLine(item.affiliation, `${item.paperCount} 篇论文`, item.isPrimary ? '主要机构' : '')}
              />
            </List.Item>
          )}
        />
      </Card>
    </>
  );

  const renderTopicDetail = (topic: GraphTopicSearchItem) => (
    <>
      <div className="graph-detail-header">
        <Tag color="purple">主题</Tag>
        <Title level={4}>{topic.name}</Title>
        <Paragraph type="secondary">{topic.normalizedName}</Paragraph>
      </div>

      <Card className="graph-detail-card" bordered={false} title="主题钻取">
        <Paragraph className="graph-detail-paragraph">
          主题实体可以作为论文发现的路由入口。点击下方按钮后，当前搜索会切换到与该主题相关的论文集合。
        </Paragraph>
        <Button
          type="primary"
          icon={<ArrowRightOutlined />}
          onClick={() => {
            setQuery(topic.name);
            setSearchType('paper');
            runSearch({ q: topic.name, type: 'paper', openFirst: true });
          }}
        >
          搜索该主题下的论文
        </Button>
      </Card>
    </>
  );

  return (
    <div className="scholar-graph-page">
      {contextHolder}
      <section className="graph-main-column">
        <Card className="graph-hero-card" bordered={false}>
          <div className="graph-hero-head">
            <div>
              <Tag color="cyan">{surfaceConfig.tag}</Tag>
              <Title level={2}>{surfaceConfig.title}</Title>
              <Paragraph className="graph-hero-copy">
                {surfaceConfig.description}
              </Paragraph>
            </div>
            <Button icon={<ReloadOutlined />} onClick={() => runSearch({ openFirst: false })}>
              刷新
            </Button>
          </div>

          <div className="graph-search-controls">
            <Input
              allowClear
              size="large"
              value={query}
              placeholder={surfaceConfig.placeholder}
              prefix={<SearchOutlined />}
              onChange={(event) => setQuery(event.target.value)}
              onPressEnter={() => runSearch()}
            />
            <Radio.Group
              value={searchType}
              options={SEARCH_TYPE_OPTIONS}
              optionType="button"
              buttonStyle="solid"
              onChange={(event) => setSearchType(event.target.value)}
            />
            <Button type="primary" size="large" icon={<SearchOutlined />} onClick={() => runSearch()}>
              {surfaceConfig.buttonLabel}
            </Button>
          </div>

          <div className="graph-summary-grid">
            <Card bordered={false}>
              <Statistic title="论文" value={summaryTotals.papers} prefix={<ReadOutlined />} />
            </Card>
            <Card bordered={false}>
              <Statistic title="作者" value={summaryTotals.authors} prefix={<TeamOutlined />} />
            </Card>
            <Card bordered={false}>
              <Statistic
                title="机构"
                value={summaryTotals.institutions}
                prefix={<ApartmentOutlined />}
              />
            </Card>
            <Card bordered={false}>
              <Statistic title="主题" value={summaryTotals.topics} prefix={<ClusterOutlined />} />
            </Card>
          </div>
        </Card>

        {renderSearchResults()}
      </section>

      <aside className="graph-detail-column">
        <Card className="graph-detail-shell" bordered={false}>
          {detailLoading ? (
            <div className="graph-state">
              <Spin />
            </div>
          ) : detailError ? (
            <Alert type="error" showIcon message={detailError} />
          ) : !detail ? (
            <Empty description={surfaceConfig.detailEmptyDescription} />
          ) : detail.type === 'paper' ? (
            renderPaperDetail(detail.paper, detail.relations)
          ) : detail.type === 'author' ? (
            renderAuthorDetail(detail.author)
          ) : detail.type === 'institution' ? (
            renderInstitutionDetail(detail.institution)
          ) : (
            renderTopicDetail(detail.topic)
          )}
        </Card>
      </aside>
    </div>
  );
};

function pickFirstEntity(response: GraphSearchResponse): ActiveEntity | null {
  if (response.type === 'all') {
    const firstPaper = response.results.papers[0];
    if (firstPaper) {
      return { type: 'paper', id: firstPaper.id };
    }

    const firstAuthor = response.results.authors[0];
    if (firstAuthor) {
      return { type: 'author', id: firstAuthor.id };
    }

    const firstInstitution = response.results.institutions[0];
    if (firstInstitution) {
      return { type: 'institution', id: firstInstitution.id };
    }

    const firstTopic = response.results.topics[0];
    return firstTopic ? { type: 'topic', id: firstTopic.id, name: firstTopic.name } : null;
  }

  const firstItem = response.items[0];
  if (!firstItem) {
    return null;
  }

  if (response.type === 'paper') {
    return { type: 'paper', id: firstItem.id };
  }

  if (response.type === 'author') {
    return { type: 'author', id: firstItem.id };
  }

  if (response.type === 'institution') {
    return { type: 'institution', id: firstItem.id };
  }

  return {
    type: 'topic',
    id: firstItem.id,
    name: getItemTitle('topic', firstItem as GraphTopicSearchItem),
  };
}

export default ScholarGraphPage;
