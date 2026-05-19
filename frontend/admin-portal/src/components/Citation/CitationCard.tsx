import React from 'react';
import { Card, Tag, Space, Typography, Button } from 'antd';
import { FileTextOutlined, LinkOutlined } from '@ant-design/icons';
import type { Citation } from '../../services/rag.service';
import './CitationCard.css';

const { Text, Paragraph } = Typography;

interface CitationCardProps {
  citation: Citation;
  index: number;
  onViewDocument?: (documentId: string) => void;
}

const CitationCard: React.FC<CitationCardProps> = ({
  citation,
  index,
  onViewDocument,
}) => {
  return (
    <Card
      className="citation-card"
      size="small"
      bordered
      hoverable
    >
      <div className="citation-header">
        <Space>
          <Tag color="blue" className="citation-index">
            [{index + 1}]
          </Tag>
          <FileTextOutlined />
          <Text strong className="citation-title">
            {citation.documentTitle}
          </Text>
        </Space>
        <Tag color="green" className="citation-score">
          {(citation.score * 100).toFixed(1)}%
        </Tag>
      </div>

      <Paragraph
        className="citation-content"
        ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
      >
        {citation.content}
      </Paragraph>

      <div className="citation-footer">
        <Space split={<span className="divider">|</span>}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            块索引: {citation.chunkIndex}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            块ID: {citation.chunkId.substring(0, 8)}...
          </Text>
        </Space>
        {onViewDocument && (
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => onViewDocument(citation.documentId)}
          >
            查看文档
          </Button>
        )}
      </div>
    </Card>
  );
};

export default CitationCard;
