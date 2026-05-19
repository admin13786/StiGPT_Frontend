import api from './api';

// Citation interface
export interface Citation {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
  chunkIndex: number;
}

// RAG Query Response interface
export interface RagQueryResponse {
  answer: string;
  citations: Citation[];
  retrievedCount: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  processingTime: number;
}

// RAG Query DTO
export interface RagQueryDto {
  query: string;
  kbId: string;
  sessionId?: string;
  topK?: number;
  temperature?: number;
  stream?: boolean;
}

// Popular Citation interface
export interface PopularCitation {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  citationCount: number;
}

// Citation Stats interface
export interface CitationStats {
  totalCitations: number;
  uniqueDocuments: number;
  recentCitations: Array<{
    documentTitle: string;
    chunkId: string;
    score: number;
    createdAt: string;
  }>;
}

class RagService {
  async query(data: RagQueryDto): Promise<RagQueryResponse> {
    const response = await api.post('/rag/query', data);
    return response.data;
  }

  async getPopularCitations(kbId: string, limit: number = 10): Promise<PopularCitation[]> {
    const response = await api.get(`/rag/knowledge-bases/${kbId}/popular-citations`, {
      params: { limit },
    });
    return response.data;
  }

  async getCitationStats(kbId: string): Promise<CitationStats> {
    const response = await api.get(`/rag/knowledge-bases/${kbId}/citation-stats`);
    return response.data;
  }
}

export default new RagService();
