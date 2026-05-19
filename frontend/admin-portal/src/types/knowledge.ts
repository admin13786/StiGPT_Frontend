/**
 * 知识库相关类型定义
 */

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  aclScope: 'public' | 'internal' | 'department' | 'private';
  aclUsers?: string[];
  documentCount: number;
  chunkCount: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeBaseDto {
  name: string;
  description?: string;
  aclScope: 'public' | 'internal' | 'department' | 'private';
  aclUsers?: string[];
}

export interface UpdateKnowledgeBaseDto {
  name?: string;
  description?: string;
  aclScope?: 'public' | 'internal' | 'department' | 'private';
  aclUsers?: string[];
}

export interface KnowledgeBaseStats {
  documentCount: number;
  chunkCount: number;
  totalSize: number;
  lastUpdated: string;
}
