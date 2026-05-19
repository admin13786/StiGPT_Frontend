import type { MessageInstance } from 'antd/es/message/interface';

/**
 * Global Ant Design message bridge for non-React modules.
 */
let globalMessageInstance: MessageInstance | null = null;

export const setGlobalMessage = (message: MessageInstance) => {
  globalMessageInstance = message;
};

export const getGlobalMessage = (): MessageInstance => {
  if (globalMessageInstance) {
    return globalMessageInstance;
  }

  // Avoid static-message warnings before the Antd App context is mounted.
  return {
    success: (() => undefined) as MessageInstance['success'],
    error: (() => undefined) as MessageInstance['error'],
    warning: (() => undefined) as MessageInstance['warning'],
    info: (() => undefined) as MessageInstance['info'],
    loading: (() => undefined) as MessageInstance['loading'],
    open: (() => undefined) as MessageInstance['open'],
    destroy: (() => undefined) as MessageInstance['destroy'],
  } as MessageInstance;
};
