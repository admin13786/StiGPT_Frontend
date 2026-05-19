import api from './api';

// Document interface
export interface Document {
  id: string;
  kbId: string;
  title: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  fileHash: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  chunkCount: number;
  tokenCount: number;
  errorMessage?: string;
  uploadTime: string;
  processedAt?: string;
}

// Document Status interface
export interface DocumentStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  chunkCount: number;
  tokenCount: number;
  errorMessage?: string;
  processedAt?: string;
}

class DocumentService {
  async upload(kbId: string, file: File): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`/knowledge-bases/${kbId}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  }

  async getList(
    kbId: string,
    params?: {
      page?: number;
      limit?: number;
      status?: string;
    },
  ): Promise<{
    items: Document[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const response = await api.get(`/knowledge-bases/${kbId}/documents`, { params });
    return response.data.data;
  }

  async getById(kbId: string, id: string): Promise<Document> {
    const response = await api.get(`/knowledge-bases/${kbId}/documents/${id}`);
    return response.data.data;
  }

  async getStatus(kbId: string, id: string): Promise<DocumentStatus> {
    const response = await api.get(`/knowledge-bases/${kbId}/documents/${id}/status`);
    return response.data.data;
  }

  async delete(kbId: string, id: string): Promise<void> {
    await api.delete(`/knowledge-bases/${kbId}/documents/${id}`);
  }

  async reprocess(kbId: string, id: string): Promise<void> {
    await api.post(`/knowledge-bases/${kbId}/documents/${id}/reprocess`);
  }
}

export default new DocumentService();
