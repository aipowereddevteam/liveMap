import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Eye, ShieldAlert, AlertCircle, TrendingUp, Users, Activity, FileText } from 'lucide-react';

interface Photo {
  id: string;
  url: string;
}

interface User {
  id: string;
  name: string;
  phone: string;
}

interface PendingProperty {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  type: string;
  rent: number;
  deposit: number;
  address: string;
  status: string;
  createdAt: string;
  owner: User;
  photos: Photo[];
}

interface Report {
  id: string;
  propertyId: string;
  reportedBy: string;
  reason: string;
  status: 'open' | 'resolved';
  createdAt: string;
  property: {
    id: string;
    title: string;
    status: string;
  };
  reporter: User;
}

interface Analytics {
  listingCount: number;
  approvedListingCount: number;
  pendingListingCount: number;
  leadCount: number;
  dau: number;
}

export const AdminDashboard: React.FC = () => {
  const [pendingQueue, setPendingQueue] = useState<PendingProperty[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rejection/Suspension Prompt Modals
  const [actionModal, setActionModal] = useState<{
    type: 'reject' | 'suspend_property' | 'suspend_user';
    propertyId?: string;
    userId?: string;
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch all admin data
  const fetchAdminData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Parallel fetching of dashboard data
      const [queueData, reportsData, statsData] = await Promise.all([
        api.get<PendingProperty[]>('/admin/properties?status=pending'),
        api.get<Report[]>('/admin/reports'),
        api.get<Analytics>('/admin/analytics'),
      ]);

      setPendingQueue(queueData);
      setReports(reportsData);
      setAnalytics(statsData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch admin dashboard records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleApproveProperty = async (propertyId: string) => {
    if (!window.confirm('Approve this listing? It will go live in tenant searches.')) return;
    try {
      setError(null);
      await api.patch(`/admin/properties/${propertyId}/approve`);
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Failed to approve listing');
    }
  };

  const handleOpenActionModal = (
    type: 'reject' | 'suspend_property' | 'suspend_user',
    propertyId?: string,
    userId?: string
  ) => {
    setActionReason('');
    setActionModal({ type, propertyId, userId });
  };

  const handleModalActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal) return;

    try {
      setActionLoading(true);
      setError(null);

      if (actionModal.type === 'reject') {
        await api.patch(`/admin/properties/${actionModal.propertyId}/reject`, { reason: actionReason });
      } else if (actionModal.type === 'suspend_property') {
        await api.patch(`/admin/properties/${actionModal.propertyId}/suspend`, { reason: actionReason });
      } else if (actionModal.type === 'suspend_user') {
        await api.patch(`/admin/users/${actionModal.userId}/suspend`, { reason: actionReason });
      }

      setActionModal(null);
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Failed to complete moderation action');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      setError(null);
      await api.patch(`/admin/reports/${reportId}/resolve`);
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Failed to resolve report');
    }
  };

  return (
    <div className="dashboard-container">
      <div>
        <h1 style={{ fontSize: '2rem' }}>Super Admin Moderation Center</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          Approve pending listings, handle reports, and analyze traffic
        </p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
          Error: {error}
        </div>
      )}

      {/* Analytics Summary Stats Grid */}
      {analytics && (
        <div className="stats-grid">
          <div className="glass-panel stat-card">
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8' }}>
              <TrendingUp size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
              Active / Total Listings
            </label>
            <div className="stat-value">
              {analytics.approvedListingCount} <span style={{ fontSize: '1rem', color: '#64748b' }}>/ {analytics.listingCount}</span>
            </div>
          </div>

          <div className="glass-panel stat-card">
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8' }}>
              <Users size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
              Total Leads (Enquiries)
            </label>
            <div className="stat-value" style={{ color: '#06b6d4' }}>{analytics.leadCount}</div>
          </div>

          <div className="glass-panel stat-card">
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8' }}>
              <Activity size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
              Daily Active Users (DAU)
            </label>
            <div className="stat-value" style={{ color: '#10b981' }}>{analytics.dau}</div>
          </div>

          <div className="glass-panel stat-card">
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8' }}>
              <FileText size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
              Moderation Queue Size
            </label>
            <div className="stat-value" style={{ color: '#f59e0b' }}>{analytics.pendingListingCount}</div>
          </div>
        </div>
      )}

      {/* Property Approval Moderation Queue */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b' }}>
          <ShieldAlert size={18} />
          Pending Approvals Queue ({pendingQueue.length})
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading queue...</div>
        ) : pendingQueue.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#94a3b8' }}>
            Moderation queue is clean. No listings pending approval.
          </div>
        ) : (
          <div className="dashboard-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Listing info</th>
                  <th>Type</th>
                  <th>Owner Name</th>
                  <th>Owner Phone</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingQueue.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.title}</div>
                        <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{p.address}</div>
                        <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '0.2rem', fontStyle: 'italic' }}>
                          "{p.description.substring(0, 100)}..."
                        </div>
                      </div>
                    </td>
                    <td style={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>{p.type}</td>
                    <td>{p.owner.name}</td>
                    <td>
                      {p.owner.phone}
                      <span style={{ fontSize: '0.65rem', color: '#f59e0b', display: 'block', marginTop: '0.1rem', fontWeight: 600 }}>
                        ⚠️ Unverified Phone
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <a
                          href={`/listings/${p.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                          title="Preview Listing"
                        >
                          <Eye size={14} />
                        </a>
                        <button
                          onClick={() => handleApproveProperty(p.id)}
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}
                          title="Approve Listing"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleOpenActionModal('reject', p.id)}
                          className="btn btn-danger"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                          title="Reject Listing"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tenant Reports / Flags Manager */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
          <AlertCircle size={18} />
          Tenant Listing Reports ({reports.length})
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading reports...</div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#94a3b8' }}>
            No listing reports currently filed.
          </div>
        ) : (
          <div className="dashboard-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Reported Listing</th>
                  <th>Flag reason</th>
                  <th>Reporter</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600 }}>{report.property.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          ID: <a href={`/listings/${report.propertyId}`} target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>{report.propertyId}</a>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: '#cbd5e1' }}>"{report.reason}"</td>
                    <td>
                      <div>{report.reporter.name}</div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        {report.reporter.phone}
                        <span style={{ fontSize: '0.65rem', color: '#f59e0b', display: 'block', marginTop: '0.1rem', fontWeight: 600 }}>
                          ⚠️ Unverified Phone
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="user-badge"
                        style={{
                          background: report.status === 'open' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                          color: report.status === 'open' ? '#ef4444' : '#10b981',
                        }}
                      >
                        {report.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        {report.status === 'open' && (
                          <>
                            <button
                              onClick={() => handleResolveReport(report.id)}
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: '#10b981' }}
                            >
                              Resolve Flag
                            </button>
                            <button
                              onClick={() => handleOpenActionModal('suspend_property', report.propertyId)}
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: '#f59e0b' }}
                            >
                              Suspend Listing
                            </button>
                            <button
                              onClick={() => {
                                // Find property owner ID from the reports parent data if available,
                                // but we can query it easily from backend. Let's find ownerId by fetching property if needed.
                                // Actually, let's allow suspending target owner user
                                const pendingProperty = pendingQueue.find(p => p.id === report.propertyId);
                                const ownerId = pendingProperty ? pendingProperty.ownerId : '';
                                handleOpenActionModal('suspend_user', undefined, ownerId);
                              }}
                              className="btn btn-danger"
                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                              disabled={!pendingQueue.some(p => p.id === report.propertyId)}
                            >
                              Suspend Owner
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Moderation Actions Modal */}
      {actionModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ background: '#0f172a', borderColor: '#1e293b' }}>
            <h2 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem', textTransform: 'capitalize' }}>
              {actionModal.type.replace('_', ' ')} Required
            </h2>

            <form onSubmit={handleModalActionSubmit} className="modal-form">
              <div className="form-group">
                <label>Please provide a detailed explanation/reason</label>
                <textarea
                  required
                  rows={4}
                  placeholder={`Explain the reason for this ${actionModal.type.replace('_', ' ')} action...`}
                  className="form-control"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.2rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={actionLoading}>
                  {actionLoading ? 'Submitting...' : 'Confirm Action'}
                </button>
                <button type="button" onClick={() => setActionModal(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
