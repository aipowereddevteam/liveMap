import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, KeyRound, Phone, ShieldCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, verifyOtp, error, clearError } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMessage(null);
    setLocalLoading(true);

    try {
      await login(phone, password);
      // Success, redirect to home page
      navigate('/');
    } catch (err: any) {
      // Check if user is not verified (403 error code from backend service)
      if (err.code === 'FORBIDDEN' && err.message.includes('not verified')) {
        setIsVerifying(true);
        clearError();
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalLoading(true);

    try {
      await verifyOtp(phone, otpCode);
      setSuccessMessage('Verification successful! You can now log in with your password.');
      setIsVerifying(false);
      setOtpCode('');
    } catch (err: any) {
      // Error handled by AuthContext
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel">
        <div className="auth-header">
          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-subtitle">
            {isVerifying
              ? 'Enter the 6-digit verification code sent to your registered email'
              : 'Sign in to access map listings and contact owners'}
          </p>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              padding: '0.8rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              padding: '0.8rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
            }}
          >
            <ShieldCheck size={18} style={{ flexShrink: 0 }} />
            <span>{successMessage}</span>
          </div>
        )}

        {isVerifying ? (
          <form className="modal-form" onSubmit={handleVerifyOtp}>
            <div className="form-group">
              <label htmlFor="otp">Verification Code</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="otp"
                  type="text"
                  maxLength={6}
                  required
                  placeholder="Enter 6-digit code"
                  className="form-control"
                  style={{ width: '100%', paddingLeft: '2.5rem' }}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                />
                <KeyRound
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.8rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748b',
                  }}
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                💡 Tip: Check your terminal console where the mock OTP code is printed, or enter `123456` in development.
              </p>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={localLoading}>
              {localLoading ? 'Verifying...' : 'Verify Account'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%' }}
              onClick={() => {
                setIsVerifying(false);
                clearError();
              }}
            >
              Back to Login
            </button>
          </form>
        ) : (
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="phone"
                  type="tel"
                  required
                  placeholder="e.g. +919876543210"
                  className="form-control"
                  style={{ width: '100%', paddingLeft: '2.5rem' }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <Phone
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.8rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748b',
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="form-control"
                  style={{ width: '100%', paddingLeft: '2.5rem' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <KeyRound
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.8rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748b',
                  }}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={localLoading}>
              {localLoading ? 'Signing In...' : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: '#6366f1', fontWeight: 600 }}>
                Register here
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
