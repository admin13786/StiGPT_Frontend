import api from './api';

// Knowledge Base interface
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

// Create Knowledge Base DTO
export interface CreateKnowledgeBaseDto {
  name: string;
  description?: string;
  aclScope: 'public' | 'internal' | 'department' | 'private';
  aclUsers?: string[];
}

// Update Knowledge Base DTO
export interface UpdateKnowledgeBaseDto {
  name?: string;
  description?: string;
  aclScope?: 'public' | 'internal' | 'department' | 'private';
  aclUsers?: string[];
}

// Knowledge Base Stats interface
export interface KnowledgeBaseStats {
  documentCount: number;
  chunkCount: number;
  totalSize: number;
  lastUpdated: string;
}

class KnowledgeService {
  async create(data: CreateKnowledgeBaseDto): Promise<KnowledgeBase> {
    return api.post('/knowledge-bases', data);
  }

  async getList(params?: {
    page?: number;
    limit?: number;
    search?: string;
    aclScope?: string;
  }): Promise<{
    items: KnowledgeBase[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return api.get('/knowledge-bases', { params });
  }

  async getById(id: string): Promise<KnowledgeBase> {
    return api.get(`/knowledge-bases/${id}`);
  }

  async update(id: string, data: UpdateKnowledgeBaseDto): Promise<KnowledgeBase> {
    return api.patch(`/knowledge-bases/${id}`, data);
  }

  async delete(id: string): Promise<void> {
    await api.delete(`/knowledge-bases/${id}`);
  }

  async getStats(id: string): Promise<KnowledgeBaseStats> {
    return api.get(`/knowledge-bases/${id}/stats`);
  }
}

export default new KnowledgeService();
