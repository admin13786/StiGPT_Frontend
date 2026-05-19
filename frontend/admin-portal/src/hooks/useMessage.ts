import { App } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

/**
 * 获取 Ant Design 的 message 实例，避免直接调用静态方法导致的上下文警告
 */
export const useMessage = (): MessageInstance => {
  const { message } = App.useApp();
  return message;
};

