import apiClient from './api';
import type { UrgencyRule, UrgencyRuleConditions } from '../types';

export interface UrgencyRulePayload {
  name: string;
  enabled?: boolean;
  priorityWeight: number;
  description?: string;
  conditions: UrgencyRuleConditions;
}

export const getUrgencyRules = async (): Promise<UrgencyRule[]> => {
  return apiClient.get('/urgency-rules');
};

export const createUrgencyRule = async (data: UrgencyRulePayload) => {
  return apiClient.post('/urgency-rules', data);
};

export const updateUrgencyRule = async (
  id: string,
  data: Partial<UrgencyRulePayload>,
) => {
  return apiClient.patch(`/urgency-rules/${id}`, data);
};

export const deleteUrgencyRule = async (id: string) => {
  return apiClient.delete(`/urgency-rules/${id}`);
};

export const recalculateUrgencyQueue = async () => {
  return apiClient.post('/urgency-rules/recalculate-queue', {});
};

