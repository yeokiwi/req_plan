import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';

const STATUS_COLORS = { draft: '#94a3b8', active: '#3b82f6', approved: '#22c55e', deprecated: '#ef4444' };
const PRIORITY_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    api.requirements.stats().then(setStats).catch(console.error);
    api.requirements.list().then(rows => setRecent(rows.slice(0, 5))).catch(console.error);
  }, []);

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <Link to="/requirements/new" className="btn btn-primary">+ New Requirement</Link>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Projects</div>
            <div className="stat-value">{stats?.projectCount ?? '—'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Modules</div>
            <div className="stat-value">{stats?.moduleCount ?? '—'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Requirements</div>
            <div className="stat-value">{stats?.total ?? '—'}</div>
          </div>
          {stats?.byStatus?.map(s => (
            <div key={s.status} className="stat-card">
              <div className="stat-label">{s.status}</div>
              <div className="stat-value" style={{ color: STATUS_COLORS[s.status] }}>{s.count}</div>
            </div>
          ))}
        </div>

        {stats?.byPriority?.length > 0 && (
          <div className="card mb-4" style={{ marginBottom: 24 }}>
            <div className="section-title">By Priority</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {stats.byPriority.map(p => (
                <div key={p.priority} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: PRIORITY_COLORS[p.priority] }}>{p.count}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{p.priority}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="section-title">Recent Requirements</div>
          {recent.length === 0 ? (
            <div className="empty">No requirements yet. <Link to="/requirements/new">Create one</Link>.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(r => (
                  <tr key={r.id} className="row-link" onClick={() => window.location.href = `/requirements/${r.id}`}>
                    <td className="font-mono text-sm">{r.req_id}</td>
                    <td>{r.title}</td>
                    <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                    <td><span className={`badge badge-${r.priority}`}>{r.priority}</span></td>
                    <td className="text-muted text-sm">{r.created_at?.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
