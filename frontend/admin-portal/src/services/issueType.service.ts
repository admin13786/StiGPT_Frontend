/**
 * 问题类型服务
 */
import apiClient from './api';
import type { IssueType } from '../types';

/**
 * 获取所有问题类型（管理端，包括未启用的）
 */
export const getAllIssueTypes = async (): Promise<IssueType[]> => {
  return apiClient.get('/issue-types/all');
};

/**
 * 获取启用的问题类型（玩家端）
 */
export const getIssueTypes = async (): Promise<IssueType[]> => {
  return apiClient.get('/issue-types');
};

/**
 * 获取启用的问题类型
 */
export const getEnabledIssueTypes = async (): Promise<IssueType[]> => {
  return apiClient.get('/issue-types?enabled=true');
};

/**
 * 获取单个问题类型
 */
export const getIssueType = async (id: string): Promise<IssueType> => {
  return apiClient.get(`/issue-types/${id}`);
};

/**
 * 创建问题类型
 */
export const createIssueType = async (data: Partial<IssueType>): Promise<IssueType> => {
  return apiClient.post('/issue-types', data);
};

/**
 * 更新问题类型
 */
export const updateIssueType = async (
  id: string,
  data: Partial<IssueType>,
): Promise<IssueType> => {
  return apiClient.put(`/issue-types/${id}`, data);
};

/**
 * 删除问题类型
 */
export const deleteIssueType = async (id: string): Promise<void> => {
  return apiClient.delete(`/issue-types/${id}`);
};
