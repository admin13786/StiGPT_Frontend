import { create } from 'zustand';

export interface User {
  id: string;
  username: string;
  role: 'ADMIN' | 'AGENT' | 'USER';
  realName?: string;
  email?: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  initAuth: () => void;
}

// 同步从 localStorage 读取初始状态，避免 ProtectedRoute 的 race condition
function getInitialState(): { user: User | null; token: string | null; isAuthenticated: boolean } {
  try {
    const token = localStorage.getItem('stigpt_token');
    const userStr = localStorage.getItem('stigpt_user');
    if (token && userStr) {
      const user = JSON.parse(userStr) as User;
      return { user, token, isAuthenticated: true };
    }
  } catch {
    // ignore
  }
  return { user: null, token: null, isAuthenticated: false };
}

const initial = getInitialState();

export const useAuthStore = create<AuthState>((set) => ({
  ...initial,

  setAuth: (user, token) => {
    localStorage.setItem('stigpt_token', token);
    localStorage.setItem('stigpt_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('stigpt_token');
    localStorage.removeItem('stigpt_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  initAuth: () => {
    const token = localStorage.getItem('stigpt_token');
    const userStr = localStorage.getItem('stigpt_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token, isAuthenticated: true });
      } catch {
        set({ user: null, token: null, isAuthenticated: false });
      }
    }
  },
}));
