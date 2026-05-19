import { create } from 'zustand';
import type { User } from '../types';
import { getCurrentUser, clearUserInfo, requestLogout } from '../services/auth.service';

// 延迟导入 websocketService 避免循环依赖
let websocketServicePromise: Promise<typeof import('../services/websocket.service')> | null = null;
const getWebSocketService = async () => {
  if (!websocketServicePromise) {
    websocketServicePromise = import('../services/websocket.service');
  }
  const module = await websocketServicePromise;
  return module.websocketService;
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  initAuth: () => void | Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  // 同步从 localStorage 读取初始状态，避免 ProtectedRoute 的 race condition
  const savedUser = getCurrentUser();
  const savedToken = localStorage.getItem('admin_token');
  const hasAuth = !!(savedUser && savedToken);

  return {
    user: hasAuth ? savedUser : null,
    isAuthenticated: hasAuth,
    isAuthReady: true,
  
    setUser: (user) => set({ 
      user, 
      isAuthenticated: !!user,
      isAuthReady: true,
    }),
    
    logout: async () => {
      requestLogout().finally(async () => {
        const wsService = await getWebSocketService();
        wsService.disconnect();
        clearUserInfo();
        set({ 
          user: null, 
          isAuthenticated: false,
          isAuthReady: true,
        });
      });
    },
    
    initAuth: async () => {
      const user = getCurrentUser();
      const token = localStorage.getItem('admin_token');
      
      if (user && token) {
        set({ 
          user, 
          isAuthenticated: true,
          isAuthReady: true,
        });
        const wsService = await getWebSocketService();
        wsService.connect(token);
      } else {
        set({ 
          user: null, 
          isAuthenticated: false,
          isAuthReady: true,
        });
      }
    },
  };
});
