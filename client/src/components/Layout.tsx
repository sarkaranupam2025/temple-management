import { NavLink } from 'react-router-dom';
import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  user: { firstName: string; lastName: string; role: string };
  onLogout: () => void;
  isAdmin: boolean;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/temples', label: 'Temples', icon: '🛕' },
  { path: '/bookings', label: 'Bookings', icon: '📋' },
  { path: '/donations', label: 'Donations', icon: '💰' },
  { path: '/prasad', label: 'Prasad', icon: '🍲' },
  { path: '/volunteers', label: 'Volunteers', icon: '🤝' },
  { path: '/communication', label: 'Communication', icon: '📢' },
];

const adminItems = [
  { path: '/analytics', label: 'Analytics', icon: '📈' },
];

export default function Layout({ children, user, onLogout, isAdmin }: LayoutProps) {
  const items = isAdmin ? [...navItems, ...adminItems] : navItems;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Temple Management</h2>
          <p>System v1.0</p>
        </div>
        <nav>
          {items.map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'}>
              <span>{item.icon}</span> {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 14, color: '#fff', marginBottom: 4 }}>{user.firstName} {user.lastName}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>{user.role}</div>
          <button onClick={onLogout} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>Logout</button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
