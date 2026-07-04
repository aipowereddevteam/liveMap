import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Map, Heart, Bell, User } from 'lucide-react';

export const BottomNavbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const handleProfileClick = () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (user.role === 'admin') {
      navigate('/admin/dashboard');
    } else if (user.role === 'owner') {
      navigate('/owner/dashboard');
    } else {
      alert(`Logged in as Tenant: ${user.name} (${user.phone})`);
    }
  };

  return (
    <nav className="bottom-nav">
      <button
        className={`bottom-nav-item ${location.pathname === '/' ? 'active' : ''}`}
        onClick={() => navigate('/')}
      >
        <Map size={20} />
        <span>Explore</span>
      </button>

      <button
        className="bottom-nav-item"
        onClick={() => alert('Saved Listings feature is coming soon!')}
      >
        <Heart size={20} />
        <span>Saved</span>
      </button>

      <button
        className="bottom-nav-item"
        onClick={() => alert('Notification Alerts feature is coming soon!')}
      >
        <Bell size={20} />
        <span>Alerts</span>
      </button>

      <button
        className={`bottom-nav-item ${
          ['/admin/dashboard', '/owner/dashboard'].includes(location.pathname) ? 'active' : ''
        }`}
        onClick={handleProfileClick}
      >
        <User size={20} />
        <span>Profile</span>
      </button>
    </nav>
  );
};
