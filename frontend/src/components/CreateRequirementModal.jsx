import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function CreateRequirementModal({ initialTitle, onCreated, onClose }) {
  const [form, setForm] = useState({
    title: initialTitle || '',
    description: '',
    status: 'draft',
    priority: 'medium',
    module_id: '',
  });
  const [projects, setProjects] = useState([]);
  const [modules, setModules] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.projects.list().then(setProjects).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedProject) {
      api.projects.get(selectedProject).then(p => setModules(p.modules || [])).catch(console.error);
    } else {
      setModules([]);
    }
    setForm(f => ({ ...f, module_id: '' }));
  }, [selectedProject]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const body = {
        title: form.title.trim(),
        description: form.description,
        status: form.status,
        priority: form.priority,
      };
      if (form.module_id) body.module_id = Number(form.module_id);
      const req = await api.requirements.create(body);
      onCreated(req);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h2>Create Requirement</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
              autoFocus
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="approved">Approved</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Project</label>
              <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                <option value="">— None —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Module</label>
              <select value={form.module_id} onChange={e => setForm(f => ({ ...f, module_id: e.target.value }))} disabled={!selectedProject}>
                <option value="">— None —</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Requirement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
