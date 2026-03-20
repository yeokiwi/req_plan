import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const [project, setProject] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editing, setEditing] = useState(false);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [moduleForm, setModuleForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.projects.get(id).then(p => {
      setProject(p);
      setForm({ name: p.name, description: p.description || '' });
    }).catch(() => navigate('/projects'));
  }, [id]);

  async function handleSaveProject(e) {
    e.preventDefault();
    try {
      const updated = await api.projects.update(id, form);
      setProject(prev => ({ ...prev, ...updated }));
      setEditing(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateModule(e) {
    e.preventDefault();
    setError('');
    try {
      const mod = await api.projects.createModule(id, moduleForm);
      setProject(prev => ({
        ...prev,
        modules: [...(prev.modules || []), { ...mod, req_count: 0 }],
      }));
      setModuleForm({ name: '', description: '' });
      setShowModuleModal(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteModule(e, moduleId) {
    e.preventDefault();
    if (!confirm('Delete this module? Requirements inside will become unassigned.')) return;
    await api.modules.delete(moduleId);
    setProject(prev => ({ ...prev, modules: prev.modules.filter(m => m.id !== moduleId) }));
  }

  async function handleExport() {
    setExporting(true);
    setError('');
    try {
      const blob = await api.export.project(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(project.name).replace(/[^a-z0-9 \-_]/gi, '').trim()}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  if (!project) return <Layout><div className="page empty">Loading…</div></Layout>;

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/projects')}>← Projects</button>
            <h1 className="page-title">{project.name}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting…' : '⬇ Export to Word'}
            </button>
            {canEdit && !editing && (
              <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit Project</button>
            )}
            {canEdit && (
              <button className="btn btn-primary" onClick={() => setShowModuleModal(true)}>+ New Module</button>
            )}
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {editing ? (
          <div className="card" style={{ marginBottom: 24 }}>
            <form onSubmit={handleSaveProject}>
              <div className="form-group">
                <label>Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </form>
          </div>
        ) : (
          project.description && (
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{project.description}</p>
          )
        )}

        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          Modules ({project.modules?.length || 0})
        </h2>

        {project.modules?.length === 0 ? (
          <div className="card empty">No modules yet. Create one to organise requirements.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {project.modules?.map(mod => (
              <div
                key={mod.id}
                className="card row-link"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/modules/${mod.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{mod.name}</div>
                  {canEdit && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={e => handleDeleteModule(e, mod.id)}
                      style={{ flexShrink: 0, marginLeft: 8 }}
                    >
                      Delete
                    </button>
                  )}
                </div>
                {mod.description && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>{mod.description}</p>
                )}
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  📄 {mod.req_count || 0} requirement{mod.req_count !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <Link
            to={`/requirements?project_id=${id}`}
            className="btn btn-secondary"
          >
            View all requirements in this project →
          </Link>
        </div>
      </div>

      {showModuleModal && (
        <div className="modal-backdrop" onClick={() => setShowModuleModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>New Module</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleCreateModule}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  value={moduleForm.name}
                  onChange={e => setModuleForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Authentication, Checkout, Reporting…"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={moduleForm.description}
                  onChange={e => setModuleForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModuleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Module</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
