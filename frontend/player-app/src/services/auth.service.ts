import apiClient from './api';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  realName?: string;
  email?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    role: 'ADMIN' | 'AGENT' | 'USER';
    realName?: string;
    email?: string;
    avatar?: string;
  };
}

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    return apiClient.post('/auth/login', data);
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    return apiClient.post('/auth/register', data);
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore
    }
  },
};
