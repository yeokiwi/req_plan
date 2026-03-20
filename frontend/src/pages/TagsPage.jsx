import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

const PRESET_COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function TagsPage() {
  const [tags, setTags] = useState([]);
  const [form, setForm] = useState({ name: '', color: '#6366f1' });
  const [error, setError] = useState('');
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    api.tags.list().then(setTags).catch(console.error);
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      const tag = await api.tags.create(form);
      setTags(prev => [...prev, tag]);
      setForm({ name: '', color: '#6366f1' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this tag? It will be removed from all requirements.')) return;
    await api.tags.delete(id);
    setTags(prev => prev.filter(t => t.id !== id));
  }

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Tags</h1>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {canEdit && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="section-title">Create Tag</div>
            <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                <label>Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. UI, Backend, Security…"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Color</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {PRESET_COLORS.map(c => (
                    <div
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{
                        width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer',
                        border: form.color === c ? '3px solid #0f172a' : '3px solid transparent'
                      }}
                    />
                  ))}
                </div>
              </div>
              <button className="btn btn-primary" type="submit">Create Tag</button>
            </form>
          </div>
        )}

        <div className="card">
          {tags.length === 0 ? (
            <div className="empty">No tags yet.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {tags.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--bg)', borderRadius: 999, border: '1px solid var(--border)' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: t.color, display: 'inline-block' }} />
                  <span style={{ fontWeight: 500 }}>{t.name}</span>
                  {user?.role === 'admin' && (
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ padding: '1px 7px', fontSize: 11 }}
                      onClick={() => handleDelete(t.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
