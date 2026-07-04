import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../context/AuthContext';
import { AlertCircle, KeyRound, Phone, User, Mail, ShieldCheck } from 'lucide-react';

export const Register: React.FC = () => {
  const { register, verifyOtp, error, clearError } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('tenant');

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
      const result = await register({
        name,
        phone,
        email: email || undefined,
        passwordHash: password,
        role,
      });

      setSuccessMessage(result.message);
      setIsVerifying(true);
    } catch (err) {
      // Error is stored in AuthContext and rendered below
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
      setSuccessMessage('Registration and verification complete! You can now log in.');
      setIsVerifying(false);
      
      // Delay navigation slightly to let the user read the success alert
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err) {
      // Error handled by AuthContext
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel">
        <div className="auth-header">
          <h2 className="auth-title">Create Account</h2>
          <p className="auth-subtitle">
            {isVerifying
              ? `Verification code sent to ${email}`
              : 'Join the rental marketplace and start searching'}
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
              {localLoading ? 'Verifying...' : 'Verify Email Address'}
            </button>
          </form>
        ) : (
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="name"
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  className="form-control"
                  style={{ width: '100%', paddingLeft: '2.5rem' }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <User
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
              <label htmlFor="email">Email Address (Required)</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="e.g. john@example.com"
                  className="form-control"
                  style={{ width: '100%', paddingLeft: '2.5rem' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Mail
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
                  placeholder="At least 6 characters"
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

            <div className="form-group">
              <label htmlFor="role">Register As</label>
              <select
                id="role"
                className="form-control"
                style={{ width: '100%' }}
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="tenant">Tenant (Search & Contact Owners)</option>
                <option value="owner">Property Owner (Create & Manage Listings)</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={localLoading}>
              {localLoading ? 'Creating Account...' : 'Register'}
            </button>

            <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#6366f1', fontWeight: 600 }}>
                Sign in here
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
