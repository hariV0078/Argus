import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { useAuthStore } from './store/authStore';
import { useServerStore } from './store/serverStore';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { NewScan } from './pages/NewScan';
import { Jobs } from './pages/Jobs';
import { JobDetail } from './pages/JobDetail';
import { Outputs } from './pages/Outputs';
import { OutputModel } from './pages/OutputModel';
import { OutputPointCloud } from './pages/OutputPointCloud';
import { OutputMap } from './pages/OutputMap';
import { Profile } from './pages/Profile';
import { NotFound } from './pages/NotFound';

function Protected({ children }: { children: ReactNode }) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const loggedIn = useAuthStore((s) => s.loggedIn);
  if (!hydrated) return null;
  if (!loggedIn) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateServer = useServerStore((s) => s.hydrate);

  useEffect(() => {
    hydrateAuth();
    hydrateServer();
  }, [hydrateAuth, hydrateServer]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<Protected><Home /></Protected>} />
        <Route path="/new" element={<Protected><NewScan /></Protected>} />
        <Route path="/jobs" element={<Protected><Jobs /></Protected>} />
        <Route path="/jobs/:jobId" element={<Protected><JobDetail /></Protected>} />
        <Route path="/outputs" element={<Protected><Outputs /></Protected>} />
        <Route path="/outputs/model" element={<Protected><OutputModel /></Protected>} />
        <Route path="/outputs/pointcloud" element={<Protected><OutputPointCloud /></Protected>} />
        <Route path="/outputs/map" element={<Protected><OutputMap /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
