import { io, Socket } from 'socket.io-client';
import { WS_URL } from '../config/api';
import { useSessionStore } from '../stores/sessionStore';
import { useAgentStore } from '../stores/agentStore';
import type { Session, Message } from '../types';
import { notificationService } from './notification.service';
import { getGlobalMessage } from '../utils/message';

// 页面标题更新函数
let titleBlinkInterval: ReturnType<typeof setInterval> | null = null;
let baseTitle = '';

// 获取基础标题（去除未读数）
function getBaseTitle(): string {
  if (!baseTitle) {
    baseTitle = document.title.replace(/^\(\d+\)\s*/, '') || '科研之友 AI 管理后台';
  }
  return baseTitle;
}

function updatePageTitle(unreadCount: number) {
  const title = getBaseTitle();
  
  if (unreadCount > 0) {
    // 清除之前的闪烁定时器
    if (titleBlinkInterval) {
      clearInterval(titleBlinkInterval);
    }
    
    // 优雅的标题闪烁效果（更平滑的过渡）
    let showCount = true;
    let fadeStep = 0;
    
    const updateTitle = () => {
      if (showCount) {
        // 显示未读数，使用更醒目的格式
        document.title = `🔔 (${unreadCount}) ${title}`;
      } else {
        // 隐藏未读数，但保留提示
        document.title = `● ${title}`;
      }
      showCount = !showCount;
    };
    
    // 初始显示
    document.title = `🔔 (${unreadCount}) ${title}`;
    
    // 每 2 秒切换一次（更优雅的节奏）
    titleBlinkInterval = setInterval(updateTitle, 2000);
  } else {
    document.title = title;
    if (titleBlinkInterval) {
      clearInterval(titleBlinkInterval);
      titleBlinkInterval = null;
    }
  }
}

// 初始化时更新标题（显示当前未读数）
if (typeof window !== 'undefined') {
  const { getTotalUnread } = useSessionStore.getState();
  const totalUnread = getTotalUnread();
  if (totalUnread > 0) {
    updatePageTitle(totalUnread);
  }
}

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private rateLimitUntil = 0;
  private rateLimitTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly rateLimitCooldownMs = 3000;

  private handleAgentStatusPayload(payload: {
    agentId: string;
    isOnline: boolean;
    username?: string;
    realName?: string;
    avatar?: string;
  }) {
    const { updateAgentStatus } = useAgentStore.getState();
    updateAgentStatus(payload.agentId, payload.isOnline, {
      username: payload.username,
      realName: payload.realName,
      avatar: payload.avatar,
      isOnline: payload.isOnline,
    });

    const displayName = payload.realName || payload.username || '成员';
    console.log(`${displayName}${payload.isOnline ? '已上线' : '已离线'}`);
  }

  connect(token: string) {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(WS_URL, {
      auth: {
        token: token
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventListeners();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.rateLimitTimer) {
      clearTimeout(this.rateLimitTimer);
      this.rateLimitTimer = null;
    }
    this.rateLimitUntil = 0;
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // 连接成功
    this.socket.on('connect', () => {
      console.log('WebSocket连接成功');
      this.reconnectAttempts = 0;
    });

    // 连接断开
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket连接断开:', reason);
      if (reason === 'io server disconnect') {
        // 服务器主动断开，需要重新连接
        this.socket?.connect();
      }
    });

    // 连接错误
    this.socket.on('connect_error', (error) => {
      console.error('WebSocket连接错误:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('无法连接到服务器，请检查网络连接');
      }
    });

    this.socket.on('error', (error) => {
      if (error?.code === 429001) {
        this.triggerRateLimit();
        return;
      }
      console.error('WebSocket错误:', error);
    });

    // 新会话通知
    this.socket.on('new-session', (session: Session) => {
      const { queuedSessions, setQueuedSessions } = useSessionStore.getState();
      // 检查是否已存在，避免重复添加
      const exists = queuedSessions.some(s => s.id === session.id);
      if (!exists) {
        setQueuedSessions([...queuedSessions, session]);
        console.log(`新会话: ${session.ticket?.ticketNo || session.id}`);
      }
      // 触发刷新事件，让页面重新加载完整列表
      window.dispatchEvent(new CustomEvent('refresh-sessions'));
    });

    this.socket.on('agent-status-changed', (payload) => {
      this.handleAgentStatusPayload(payload);
    });

    // 会话状态更新
    this.socket.on('session-update', (data: Partial<Session> & { sessionId: string }) => {
      const { updateSession } = useSessionStore.getState();
      updateSession(data.sessionId, data);
      
      // 如果会话已关闭，刷新会话列表
      if (data.status === 'CLOSED') {
        // 触发会话列表刷新（通过事件或直接调用）
        window.dispatchEvent(new CustomEvent('session-closed', { detail: data.sessionId }));
      }
    });

    // 接收消息
    this.socket.on('message', (data: { sessionId: string; message: Message } | Message) => {
      const { addMessage, setSessionMessages, currentSession, getTotalUnread } = useSessionStore.getState();
      
      let sessionId: string | undefined;
      let messageData: Message;
      
      // 兼容两种格式：{ sessionId, message } 或直接是 message 对象
      if (data && typeof data === 'object' && 'sessionId' in data && 'message' in data) {
        // 格式：{ sessionId, message }
        sessionId = (data as { sessionId: string; message: Message }).sessionId;
        messageData = (data as { sessionId: string; message: Message }).message;
      } else if (data && typeof data === 'object' && 'sessionId' in data) {
        // 格式：直接是 message 对象，但包含 sessionId
        const msg = data as any;
        sessionId = msg.sessionId;
        messageData = msg;
      } else {
        console.warn('未知的消息格式:', data);
        return;
      }
      
      if (!sessionId || !messageData) {
        console.warn('消息格式不完整:', data);
        return;
      }
      
      // 获取当前消息列表
      const state = useSessionStore.getState();
      const currentMessages = state.sessionMessages[sessionId] || [];
      
      // 检查是否有临时消息需要替换
      const tempMessage = currentMessages.find(
        (msg) => msg.id.startsWith('temp-') && 
        msg.content === messageData.content &&
        msg.senderType === messageData.senderType
      );
      
      if (tempMessage) {
        // 移除临时消息并添加真实消息
        const filteredMessages = currentMessages.filter(m => m.id !== tempMessage.id);
        const newMessages = [...filteredMessages, messageData].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setSessionMessages(sessionId, newMessages);
      } else {
        // 直接添加消息（addMessage 会自动去重和排序，并处理未读数）
        addMessage(sessionId, messageData);
      }
      
      // 如果消息不是来自当前用户，且不在当前查看的会话中，触发通知
      const isCurrentSession = currentSession?.id === sessionId;
      const isFromCurrentUser = messageData.senderType === 'AGENT';
      const shouldNotify = !isCurrentSession && !isFromCurrentUser;
      
      if (shouldNotify) {
        // 播放提示音
        notificationService.playSound();
        
        // 获取会话信息用于通知
        const state = useSessionStore.getState();
        const session = [...state.activeSessions, ...state.queuedSessions].find(
          s => s.id === sessionId
        );
        const sessionName = session?.ticket?.playerIdOrName || '未知玩家';
        const messagePreview = messageData.content.substring(0, 50);
        
        // 显示浏览器通知
        notificationService.showNotification(
          `新消息 - ${sessionName}`,
          {
            body: messagePreview,
            tag: `session-${sessionId}`, // 每个会话独立通知
          }
        );
        
        // 更新页面标题显示未读数
        const totalUnread = getTotalUnread();
        updatePageTitle(totalUnread);
      }
    });
  }

  // 客服发送消息
  sendAgentMessage(sessionId: string, content: string, messageType: 'TEXT' | 'IMAGE' = 'TEXT'): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return new Promise((resolve) => {
      if (this.isRateLimited()) {
        resolve({ success: false, error: '发送过快，请稍后再试' });
        return;
      }
      if (!this.socket?.connected) {
        resolve({ success: false, error: '连接已断开' });
        return;
      }

      this.socket.emit('agent:send-message', 
        { sessionId, content, messageType },
        (response: { success: boolean; messageId?: string; error?: string }) => {
          if (response?.error === 'rate_limited') {
            this.triggerRateLimit();
            resolve({ success: false, error: '发送过快，请稍后再试' });
            return;
          }
          resolve(response);
        }
      );
    });
  }

  // 加入会话房间
  joinSession(sessionId: string): Promise<{ success: boolean }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ success: false });
        return;
      }

      this.socket.emit('join-session', 
        { sessionId },
        (response: { success: boolean }) => {
          resolve(response);
        }
      );
    });
  }

  // 离开会话房间
  leaveSession(sessionId: string): Promise<{ success: boolean }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ success: false });
        return;
      }

      this.socket.emit('leave-session', 
        { sessionId },
        (response: { success: boolean }) => {
          resolve(response);
        }
      );
    });
  }

  // 获取连接状态
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  private isRateLimited(): boolean {
    return Date.now() < this.rateLimitUntil;
  }

  private triggerRateLimit() {
    this.rateLimitUntil = Date.now() + this.rateLimitCooldownMs;
    if (this.rateLimitTimer) {
      clearTimeout(this.rateLimitTimer);
    }
    this.rateLimitTimer = setTimeout(() => {
      this.rateLimitUntil = 0;
      this.rateLimitTimer = null;
    }, this.rateLimitCooldownMs);
    getGlobalMessage().warning('发送过快，请稍后再试');
  }
}

// 导出单例实例
export const websocketService = new WebSocketService();
