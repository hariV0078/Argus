import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  IoAirplane,
  IoCube,
  IoHome,
  IoLayers,
  IoLogOutOutline,
  IoPerson,
} from 'react-icons/io5';
import { BrandMark } from './BrandMark';
import { useAuthStore } from '../../store/authStore';
import './layout.css';

const NAV = [
  { to: '/home', label: 'Home', icon: IoHome },
  { to: '/new', label: 'New Scan', icon: IoAirplane },
  { to: '/jobs', label: 'Jobs', icon: IoLayers },
  { to: '/outputs', label: 'Outputs', icon: IoCube },
  { to: '/profile', label: 'Profile', icon: IoPerson },
];

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const name = useAuthStore((s) => s.name);
  const org = useAuthStore((s) => s.org);
  const logout = useAuthStore((s) => s.logout);

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
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <BrandMark size={38} />
          <div>
            <div className="sidebar-brand-name">Argus</div>
            <div className="sidebar-brand-tag">Drone → 3D model</div>
          </div>
        </div>

        <nav>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-user-name">{name || 'Operator'}</div>
              <div className="sidebar-user-org">{org || 'NTRO'}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={onLogout}>
            <IoLogOutOutline size={14} /> Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrandMark size={30} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Argus</span>
          </div>
          <button className="logout-btn" style={{ width: 'auto', margin: 0 }} onClick={onLogout}>
            <IoLogOutOutline size={14} />
          </button>
        </div>
        <div className="content">{children}</div>
      </div>

      <nav className="bottom-nav">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-nav-link${isActive ? ' active' : ''}`}>
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
