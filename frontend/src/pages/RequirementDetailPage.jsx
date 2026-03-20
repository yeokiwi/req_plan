import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

const STATUSES = ['draft', 'active', 'approved', 'deprecated'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const LINK_TYPES = ['related', 'depends_on', 'parent', 'child'];

export default function RequirementDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';
  const isNew = id === 'new';

  const [form, setForm] = useState({ title: '', description: '', status: 'draft', priority: 'medium' });
  const [req, setReq] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const [allReqs, setAllReqs] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Link modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkForm, setLinkForm] = useState({ target_id: '', link_type: 'related' });

  useEffect(() => {
    api.tags.list().then(setAllTags).catch(console.error);
    api.requirements.list().then(setAllReqs).catch(console.error);
    if (!isNew) {
      api.requirements.get(id).then(data => {
        setReq(data);
        setForm({ title: data.title, description: data.description || '', status: data.status, priority: data.priority });
      }).catch(() => navigate('/requirements'));
    }
  }, [id]);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (isNew) {
        const created = await api.requirements.create(form);
        navigate(`/requirements/${created.id}`);
      } else {
        const updated = await api.requirements.update(id, form);
        setReq(updated);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddTag(tagId) {
    const updated = await api.requirements.addTag(id, parseInt(tagId));
    setReq(updated);
  }

  async function handleRemoveTag(tagId) {
    const updated = await api.requirements.removeTag(id, tagId);
    setReq(updated);
  }

  async function handleAddLink(e) {
    e.preventDefault();
    try {
      const updated = await api.requirements.addLink(id, { target_id: parseInt(linkForm.target_id), link_type: linkForm.link_type });
      setReq(updated);
      setShowLinkModal(false);
      setLinkForm({ target_id: '', link_type: 'related' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveLink(linkId) {
    const updated = await api.requirements.removeLink(id, linkId);
    setReq(updated);
  }

  const usedTagIds = new Set(req?.tags?.map(t => t.id) || []);
  const availableTags = allTags.filter(t => !usedTagIds.has(t.id));
  const linkedTargetIds = new Set(req?.links?.map(l => l.target_id) || []);
  const availableReqs = allReqs.filter(r => r.id !== parseInt(id) && !linkedTargetIds.has(r.id));

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/requirements')}>← Back</button>
            <h1 className="page-title">
              {isNew ? 'New Requirement' : (req?.req_id || '…')}
            </h1>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className={isNew ? '' : 'detail-grid'}>
          <div>
            <div className="card">
              <form onSubmit={handleSave}>
                <div className="form-group">
                  <label>Title *</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    disabled={!canEdit}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    disabled={!canEdit}
                    rows={5}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} disabled={!canEdit}>
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Priority</label>
                    <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} disabled={!canEdit}>
                      {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                {canEdit && (
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Saving…' : (isNew ? 'Create Requirement' : 'Save Changes')}
                  </button>
                )}
              </form>
            </div>

            {!isNew && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="section-title">Traceability Links</div>
                {req?.links?.length === 0 && (
                  <p className="text-muted text-sm" style={{ marginBottom: 12 }}>No links yet.</p>
                )}
                {req?.links?.map(link => (
                  <div key={link.id} className="link-item">
                    <div>
                      <span className="badge badge-draft" style={{ marginRight: 6 }}>{link.link_type.replace('_', ' ')}</span>
                      <Link to={`/requirements/${link.target_id}`} className="font-mono text-sm">
                        {link.target_req_id}
                      </Link>
                      <span style={{ marginLeft: 6, color: 'var(--text-muted)' }}>{link.target_title}</span>
                    </div>
                    {canEdit && (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRemoveLink(link.id)}>Remove</button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setShowLinkModal(true)}>
                    + Add Link
                  </button>
                )}
              </div>
            )}
          </div>

          {!isNew && (
            <div>
              <div className="card">
                <div className="section-title">Details</div>
                <div className="detail-meta">
                  <div className="meta-item">
                    <label>Status</label>
                    <div className="meta-value"><span className={`badge badge-${req?.status}`}>{req?.status}</span></div>
                  </div>
                  <div className="meta-item">
                    <label>Priority</label>
                    <div className="meta-value"><span className={`badge badge-${req?.priority}`}>{req?.priority}</span></div>
                  </div>
                  <div className="meta-item">
                    <label>Created by</label>
                    <div className="meta-value">{req?.created_by_name || '—'}</div>
                  </div>
                  <div className="meta-item">
                    <label>Created</label>
                    <div className="meta-value text-sm">{req?.created_at?.slice(0, 10)}</div>
                  </div>
                  <div className="meta-item">
                    <label>Updated by</label>
                    <div className="meta-value">{req?.updated_by_name || '—'}</div>
                  </div>
                  <div className="meta-item">
                    <label>Updated</label>
                    <div className="meta-value text-sm">{req?.updated_at?.slice(0, 10)}</div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ marginTop: 16 }}>
                <div className="section-title">Tags</div>
                <div className="tags-list" style={{ marginBottom: 12 }}>
                  {req?.tags?.length === 0 && <span className="text-muted text-sm">No tags yet.</span>}
                  {req?.tags?.map(t => (
                    <span key={t.id} className="tag" style={{ background: t.color }}>
                      {t.name}
                      {canEdit && (
                        <span className="tag-remove" onClick={() => handleRemoveTag(t.id)}>×</span>
                      )}
                    </span>
                  ))}
                </div>
                {canEdit && availableTags.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={e => { if (e.target.value) handleAddTag(e.target.value); e.target.value = ''; }}
                    style={{ fontSize: 12 }}
                  >
                    <option value="">+ Add tag…</option>
                    {availableTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showLinkModal && (
        <div className="modal-backdrop" onClick={() => setShowLinkModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Traceability Link</h2>
            <form onSubmit={handleAddLink}>
              <div className="form-group">
                <label>Target Requirement</label>
                <select value={linkForm.target_id} onChange={e => setLinkForm(f => ({ ...f, target_id: e.target.value }))} required>
                  <option value="">Select requirement…</option>
                  {availableReqs.map(r => (
                    <option key={r.id} value={r.id}>{r.req_id} — {r.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Link Type</label>
                <select value={linkForm.link_type} onChange={e => setLinkForm(f => ({ ...f, link_type: e.target.value }))}>
                  {LINK_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowLinkModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Link</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
