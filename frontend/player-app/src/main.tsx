import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

if (import.meta.env.PROD && typeof window !== 'undefined') {
  const noop = () => undefined;

  // Keep the production bundle quiet without breaking local debugging.
  // @ts-expect-error React DevTools hook is injected by the extension.
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject: noop,
    onCommitFiberRoot: noop,
    onCommitFiberUnmount: noop,
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
