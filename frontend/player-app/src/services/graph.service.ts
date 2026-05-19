import { isAxiosError } from 'axios';
import apiClient from './api';
import type {
  GraphAuthorDetail,
  GraphInstitutionDetail,
  GraphPaperDetail,
  GraphPaperRelations,
  GraphSearchQuery,
  GraphSearchResponse,
} from '../types/graph';

class GraphService {
  async search(query: GraphSearchQuery) {
    const response = await apiClient.get<GraphSearchResponse>('/graph/search', {
      params: query,
    });
    return response as unknown as GraphSearchResponse;
  }

  async getPaper(id: string) {
    const response = await apiClient.get<GraphPaperDetail>(`/graph/papers/${id}`);
    return response as unknown as GraphPaperDetail;
  }

  async getPaperRelations(id: string) {
    const response = await apiClient.get<GraphPaperRelations>(`/graph/papers/${id}/relations`);
    return response as unknown as GraphPaperRelations;
  }

  async getAuthor(id: string) {
    const response = await apiClient.get<GraphAuthorDetail>(`/graph/authors/${id}`);
    return response as unknown as GraphAuthorDetail;
  }

  async getInstitution(id: string) {
    const response = await apiClient.get<GraphInstitutionDetail>(`/graph/institutions/${id}`);
    return response as unknown as GraphInstitutionDetail;
  }
}

export const graphService = new GraphService();

export const getGraphErrorMessage = (error: unknown) => {
  if (isAxiosError(error)) {
    const responseMessage =
      typeof error.response?.data?.message === 'string'
        ? error.response?.data?.message
        : undefined;

    if (responseMessage) {
      return responseMessage;
    }

    if (error.response?.status === 404) {
      return 'Graph data is not available for the selected item yet.';
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Unable to load graph data right now.';
};
