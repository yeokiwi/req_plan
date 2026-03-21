import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import WikiEditor from '../components/WikiEditor';
import CreateRequirementModal from '../components/CreateRequirementModal';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function ModuleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const [mod, setMod] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('requirements');
  const [wikiPage, setWikiPage] = useState(null);
  const [wikiSaveStatus, setWikiSaveStatus] = useState('');
  const [showCreateReq, setShowCreateReq] = useState(false);
  const [createReqTitle, setCreateReqTitle] = useState('');
  const [createReqCallback, setCreateReqCallback] = useState(null);
  const wikiSaveTimer = useRef(null);

  useEffect(() => {
    api.modules.get(id).then(m => {
      setMod(m);
      setForm({ name: m.name, description: m.description || '' });
    }).catch(() => navigate('/projects'));
    api.requirements.list({ module_id: id }).then(setRequirements).catch(console.error);
    api.wiki.getByModule(id).then(setWikiPage).catch(console.error);
  }, [id]);

  const handleWikiUpdate = useCallback((content) => {
    if (!wikiPage) return;
    setWikiSaveStatus('Unsaved');
    if (wikiSaveTimer.current) clearTimeout(wikiSaveTimer.current);
    wikiSaveTimer.current = setTimeout(async () => {
      try {
        setWikiSaveStatus('Saving...');
        await api.wiki.update(wikiPage.id, { content });
        setWikiSaveStatus('Saved');
      } catch {
        setWikiSaveStatus('Save failed');
      }
    }, 1500);
  }, [wikiPage]);

  function handleCreateRequirement(selectedText, callback) {
    setCreateReqTitle(selectedText);
    setCreateReqCallback(() => callback);
    setShowCreateReq(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      const updated = await api.modules.update(id, form);
      setMod(prev => ({ ...prev, ...updated }));
      setEditing(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteReq(reqId) {
    if (!confirm('Delete this requirement?')) return;
    await api.requirements.delete(reqId);
    setRequirements(prev => prev.filter(r => r.id !== reqId));
  }

  if (!mod) return <Layout><div className="page empty">Loading…</div></Layout>;

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/projects/${mod.project_id}`)}>
              ← {mod.project_name}
            </button>
            <h1 className="page-title">{mod.name}</h1>
            <span className="text-muted text-sm">module</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {canEdit && !editing && (
              <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit Module</button>
            )}
            {canEdit && (
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/requirements/new?module_id=${id}`)}
              >
                + New Requirement
              </button>
            )}
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {editing ? (
          <div className="card" style={{ marginBottom: 24 }}>
            <form onSubmit={handleSave}>
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
          mod.description && (
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{mod.description}</p>
          )
        )}

        <div className="module-tabs">
          <button className={`tab-btn ${activeTab === 'requirements' ? 'active' : ''}`} onClick={() => setActiveTab('requirements')}>
            Requirements ({requirements.length})
          </button>
          <button className={`tab-btn ${activeTab === 'wiki' ? 'active' : ''}`} onClick={() => setActiveTab('wiki')}>
            Wiki
            {wikiSaveStatus && <span className={`wiki-save-status-inline ${wikiSaveStatus === 'Saved' ? 'saved' : wikiSaveStatus === 'Save failed' ? 'error' : ''}`}>{wikiSaveStatus}</span>}
          </button>
        </div>

        {activeTab === 'requirements' && (
          <div className="card" style={{ padding: 0 }}>
            {requirements.length === 0 ? (
              <div className="empty">No requirements in this module yet.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Tags</th>
                      {canEdit && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {requirements.map(r => (
                      <tr
                        key={r.id}
                        className="row-link"
                        onClick={() => navigate(`/requirements/${r.id}`)}
                      >
                        <td className="font-mono text-sm">{r.req_id}</td>
                        <td>{r.title}</td>
                        <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                        <td><span className={`badge badge-${r.priority}`}>{r.priority}</span></td>
                        <td>
                          <div className="tags-list">
                            {r.tags?.map(t => (
                              <span key={t.id} className="tag" style={{ background: t.color }}>{t.name}</span>
                            ))}
                          </div>
                        </td>
                        {canEdit && (
                          <td onClick={e => e.stopPropagation()}>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteReq(r.id)}>Delete</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'wiki' && (
          <div className="card wiki-module-card">
            {wikiPage ? (
              <WikiEditor
                content={wikiPage.content}
                onUpdate={handleWikiUpdate}
                readOnly={!canEdit}
                onCreateRequirement={canEdit ? handleCreateRequirement : undefined}
                placeholder={`Write about ${mod.name}... Use @ to reference requirements`}
              />
            ) : (
              <div className="empty">Loading wiki...</div>
            )}
          </div>
        )}
      </div>

      {showCreateReq && (
        <CreateRequirementModal
          initialTitle={createReqTitle}
          onClose={() => { setShowCreateReq(false); setCreateReqCallback(null); }}
          onCreated={(req) => {
            setShowCreateReq(false);
            if (createReqCallback) createReqCallback(req);
            setCreateReqCallback(null);
            // Refresh requirements list
            api.requirements.list({ module_id: id }).then(setRequirements).catch(console.error);
          }}
        />
      )}
    </Layout>
  );
}
