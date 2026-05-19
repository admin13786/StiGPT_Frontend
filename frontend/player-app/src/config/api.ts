/**
 * API 配置
 * 使用相对路径，通过 nginx 代理访问后端
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Socket.IO 使用 HTTP URL，动态获取当前域名
export const WS_URL = import.meta.env.VITE_WS_URL || (() => {
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const host = window.location.host;
  return `${protocol}//${host}`;
})();

