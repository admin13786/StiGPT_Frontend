import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { STIGPT_ROUTE_SURFACES } from './constants/stigptRoutes';
import MainLayout from './layouts/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/Login';
import HomePage from './pages/Home';
import AIHubPage from './pages/AIHub';
import ProfilePage from './pages/Profile';
import ContactsPage from './pages/Contacts';
import GroupsPage from './pages/Groups';
import LibraryPage from './pages/Library';
import AIWritePage from './pages/AIWrite/Page';
import AICheckPage from './pages/AICheck';
import AIReviewPage from './pages/AIReview';
import StigptWebIdxPage from './pages/StigptWebIdx';
import ScholarGraphPage from './pages/ScholarGraph';
import AIWriteWizardPage from './pages/AIWriteWizard';
import './App.css';

dayjs.locale('zh-cn');

const customZhCN = {
  ...zhCN,
  DatePicker: {
    ...zhCN.DatePicker,
    lang: {
      ...zhCN.DatePicker?.lang,
      ok: '确定',
      now: '此刻',
      today: '今天',
    },
  },
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <ConfigProvider
      locale={customZhCN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          colorBgContainer: '#ffffff',
        },
        components: {
          Button: {
            borderRadius: 6,
            controlHeight: 36,
          },
          Input: {
            borderRadius: 6,
            controlHeight: 36,
          },
          Select: {
            borderRadius: 6,
            controlHeight: 36,
          },
          Card: {
            borderRadius: 12,
          },
        },
      }}
    >
      <AntdApp>
        <ErrorBoundary>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Navigate to="/apps" replace />} />
                <Route path="/apps" element={<HomePage />} />
                <Route path="/profile" element={<Navigate to="/apps/personal" replace />} />
                <Route path="/apps/personal" element={<ProfilePage />} />
                <Route path="/contacts" element={<Navigate to="/apps/contact" replace />} />
                <Route path="/apps/contact" element={<ContactsPage />} />
                <Route path="/groups" element={<Navigate to="/apps/groups" replace />} />
                <Route path="/apps/groups" element={<GroupsPage />} />
                <Route path="/library" element={<Navigate to="/apps/collect" replace />} />
                <Route path="/apps/collect" element={<LibraryPage />} />
                <Route path="/apps/ai-hub" element={<AIHubPage />} />
                <Route path="/apps/stigpt" element={<Navigate to="/apps/ai-hub" replace />} />
                <Route
                  path="/apps/stigpt/answer"
                  element={<Navigate to="/apps/stigpt/answer/policy" replace />}
                />
                {STIGPT_ROUTE_SURFACES.map((surface) => (
                  <Route
                    key={`${surface.routeKey}-canonical`}
                    path={surface.canonicalPath}
                    element={<StigptWebIdxPage />}
                  />
                ))}
                {STIGPT_ROUTE_SURFACES.map((surface) => (
                  <Route
                    key={`${surface.routeKey}-legacy`}
                    path={surface.legacyPath}
                    element={<Navigate to={surface.canonicalPath} replace />}
                  />
                ))}
                <Route path="/ai/write" element={<Navigate to="/apps/stigpt/write" replace />} />
                <Route path="/apps/stigpt/write" element={<AIWritePage />} />
                <Route path="/ai/check" element={<Navigate to="/apps/stigpt/check" replace />} />
                <Route path="/apps/stigpt/check" element={<AICheckPage />} />
                <Route path="/apps/stigpt/compliance" element={<AICheckPage />} />
                <Route path="/apps/stigpt/semantic" element={<AICheckPage />} />
                <Route path="/ai/review" element={<Navigate to="/apps/stigpt/review" replace />} />
                <Route path="/apps/stigpt/review" element={<AIReviewPage />} />
                <Route path="/apps/stigpt/inspect" element={<AIReviewPage />} />
                <Route path="/apps/stigpt/graph" element={<ScholarGraphPage />} />
                <Route path="/apps/stigpt/achievement" element={<ScholarGraphPage />} />
              </Route>

              <Route
                path="/apps/stigpt/write/detail"
                element={
                  <ProtectedRoute>
                    <AIWriteWizardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/apps/stigpt/write/detail/essay"
                element={
                  <ProtectedRoute>
                    <AIWriteWizardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/apps/stigpt/write/detial"
                element={
                  <ProtectedRoute>
                    <Navigate to="/apps/stigpt/write/detail" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/apps/stigpt/write/detial/essay"
                element={
                  <ProtectedRoute>
                    <Navigate to="/apps/stigpt/write/detail/essay" replace />
                  </ProtectedRoute>
                }
              />
              <Route path="/stigpt" element={<Navigate to="/apps/ai-hub" replace />} />
              <Route
                path="/stigpt/answer"
                element={<Navigate to="/apps/stigpt/answer/policy" replace />}
              />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
