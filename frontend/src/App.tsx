import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { UserRole } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { ListingDetail } from './pages/ListingDetail';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { OwnerDashboard } from './pages/OwnerDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { BottomNavbar } from './components/BottomNavbar';

// Route gate requiring user login
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '5rem', color: '#94a3b8' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Route gate requiring specific role permissions
const RoleRoute: React.FC<{ children: React.ReactNode; allowedRoles: UserRole[] }> = ({
  children,
  allowedRoles,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '5rem', color: '#94a3b8' }}>Loading...</div>;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#070a13',
          color: '#cbd5e1',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '4px solid rgba(99, 102, 241, 0.1)',
              borderTopColor: '#6366f1',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem auto',
            }}
          />
          <h3>Booting LiveMap Portal...</h3>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        <Routes>
          {/* Public Search Page */}
          <Route path="/" element={<Home />} />
          <Route path="/listings/:id" element={<ListingDetail />} />

          {/* Authentication Pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Owner Protected Panel */}
          <Route
            path="/owner/dashboard"
            element={
              <PrivateRoute>
                <RoleRoute allowedRoles={['owner']}>
                  <OwnerDashboard />
                </RoleRoute>
              </PrivateRoute>
            }
          />

          {/* Admin Protected Panel */}
          <Route
            path="/admin/dashboard"
            element={
              <PrivateRoute>
                <RoleRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </RoleRoute>
              </PrivateRoute>
            }
          />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNavbar />
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
