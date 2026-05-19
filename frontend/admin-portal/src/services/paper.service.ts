import apiClient from './api';

export interface Paper {
  id: string;
  title: string;
  abstract?: string;
  keywords: string[];
  year?: number;
  venue?: string;
  discipline?: string;
  subField?: string;
  language?: string;
  status: string;
  filePath?: string;
  errorMessage?: string;
  createdAt: string;
  authors?: { author: { id: string; name: string; affiliation?: string }; order: number }[];
}

export interface PaperListResult {
  items: Paper[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DisciplineStat {
  discipline: string;
  count: number;
}

export const paperService = {
  async list(params?: { discipline?: string; status?: string; keyword?: string; page?: number; pageSize?: number }): Promise<PaperListResult> {
    return apiClient.get('/papers/list', { params });
  },

  async getById(id: string): Promise<Paper> {
    return apiClient.get(`/papers/${id}`);
  },

  async upload(file: File, discipline?: string, kbId?: string): Promise<Paper> {
    const formData = new FormData();
    formData.append('file', file);
    if (discipline) formData.append('discipline', discipline);
    if (kbId) formData.append('kbId', kbId);
    return apiClient.post('/papers/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },

  async update(id: string, data: Partial<Paper>): Promise<Paper> {
    return apiClient.put(`/papers/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete(`/papers/${id}`);
  },

  async getDisciplineStats(): Promise<DisciplineStat[]> {
    return apiClient.get('/papers/disciplines');
  },

  async reprocess(id: string, kbId?: string): Promise<{ message: string }> {
    return apiClient.post(`/papers/${id}/reprocess`, { kbId });
  },
};