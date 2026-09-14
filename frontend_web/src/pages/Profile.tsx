import { useNavigate } from 'react-router-dom';
import { IoLogOutOutline } from 'react-icons/io5';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useAuthStore } from '../store/authStore';
import { useServerStore } from '../store/serverStore';
import './pages.css';

export function Profile() {
  const navigate = useNavigate();
  const name = useAuthStore((s) => s.name);
  const email = useAuthStore((s) => s.email);
  const org = useAuthStore((s) => s.org);
  const logout = useAuthStore((s) => s.logout);
  const backendUrl = useServerStore((s) => s.backendUrl);
  const connected = useServerStore((s) => s.connected);
  const utmEpsg = useServerStore((s) => s.utmEpsg);

  const initials = (name || 'Operator')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const onLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="h-title">Profile</h1>
      </div>

      <div className="profile-header">
        <div className="profile-avatar">{initials}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>{name || 'Operator'}</div>
          <div className="p-meta">{org || 'NTRO'}</div>
        </div>
      </div>

      <Card>
        <div className="profile-row">
          <span className="profile-row-label">Email</span>
          <span className="profile-row-value">{email}</span>
        </div>
        <div className="profile-row">
          <span className="profile-row-label">Organization</span>
          <span className="profile-row-value">{org}</span>
        </div>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <div className="profile-row">
          <span className="profile-row-label">Backend URL</span>
          <span className="profile-row-value" style={{ overflowWrap: 'anywhere', textAlign: 'right' }}>
            {backendUrl || '—'}
          </span>
        </div>
        <div className="profile-row">
          <span className="profile-row-label">Connection</span>
          <span className="profile-row-value" style={{ color: connected ? 'var(--signal)' : 'var(--dim)' }}>
            {connected ? 'Connected' : 'Offline'}
          </span>
        </div>
        <div className="profile-row">
          <span className="profile-row-label">Default UTM EPSG</span>
          <span className="profile-row-value">{utmEpsg}</span>
        </div>
      </Card>

      <Button variant="danger" icon={<IoLogOutOutline size={18} />} style={{ marginTop: 20 }} onClick={onLogout}>
        Sign out
      </Button>
    </div>
  );
}
