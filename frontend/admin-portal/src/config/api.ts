/**
 * API 与 WebSocket 配置
 * 使用相对路径，通过 nginx 代理访问后端
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const WS_URL =
  import.meta.env.VITE_WS_URL || (() => {
    // Socket.IO 需要完整的 URL，动态获取当前域名
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const host = window.location.host;
    return `${protocol}//${host}`;
  })();

export const DIFY_BASE_URL =
  import.meta.env.VITE_DIFY_BASE_URL || '';

export const DIFY_API_KEY =
  import.meta.env.VITE_DIFY_API_KEY || '';

export const DIFY_APP_MODE = (import.meta.env.VITE_DIFY_APP_MODE ||
  'chat') as 'chat' | 'workflow';

export const DIFY_WORKFLOW_ID =
  import.meta.env.VITE_DIFY_WORKFLOW_ID || '';

export const AGENT_STATUS_POLL_INTERVAL =
  Number(import.meta.env.VITE_AGENT_STATUS_POLL_INTERVAL || 30000);
