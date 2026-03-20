import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    api.projects.list().then(setProjects).catch(console.error);
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      const project = await api.projects.create(form);
      setProjects(prev => [project, ...prev]);
      setForm({ name: '', description: '' });
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm('Delete this project and all its modules?')) return;
    await api.projects.delete(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  }

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Projects</h1>
          {canEdit && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Project</button>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="card empty">No projects yet. Create one to get started.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {projects.map(p => (
              <div
                key={p.id}
                className="card row-link"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{p.name}</div>
                  {canEdit && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={e => handleDelete(e, p.id)}
                      style={{ flexShrink: 0, marginLeft: 8 }}
                    >
                      Delete
                    </button>
                  )}
                </div>
                {p.description && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>{p.description}</p>
                )}
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                  <span>📦 {p.module_count} module{p.module_count !== 1 ? 's' : ''}</span>
                  <span>📄 {p.req_count} requirement{p.req_count !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  by {p.created_by_name} · {p.created_at?.slice(0, 10)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>New Project</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. E-commerce Platform"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
