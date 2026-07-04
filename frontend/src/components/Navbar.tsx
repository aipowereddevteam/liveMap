import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, LogOut, LogIn, Compass, Shield, User } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">
        <Home size={22} className="accent-icon" style={{ color: '#7c66ff' }} />
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, letterSpacing: '-0.02em' }}>LiveMap</span>
      </Link>

      <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
        {/* Desktop-only Navigation Links */}
        <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <Link to="/" className="nav-link-icon" title="Search Map" style={{ color: location.pathname === '/' ? '#00fbfb' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <Compass size={20} />
          </Link>

          {user && user.role === 'owner' && (
            <Link
              to="/owner/dashboard"
              className="nav-link-icon"
              title="Owner Dashboard"
              style={{ color: location.pathname === '/owner/dashboard' ? '#00fbfb' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
            >
              <User size={20} />
            </Link>
          )}

          {user && user.role === 'admin' && (
            <Link
              to="/admin/dashboard"
              className="nav-link-icon"
              title="Admin Panel"
              style={{ color: location.pathname === '/admin/dashboard' ? '#00fbfb' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
            >
              <Shield size={20} />
            </Link>
          )}
        </div>

        {/* Action Button: Single Icon (Matches PWA mockup) */}
        {!user ? (
          <Link 
            to="/login" 
            className="nav-action-btn" 
            title="Login / Register"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'var(--transition-fast)'
            }}
          >
            <LogIn size={18} />
          </Link>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            {/* Show name only on desktop screens */}
            <span className="nav-user-name-desktop" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {user.name}
            </span>
            <button 
              onClick={handleLogout} 
              className="nav-action-btn" 
              title="Logout"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#ffb4ab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
