import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function RequirementsPage() {
  const [requirements, setRequirements] = useState([]);
  const [tags, setTags] = useState([]);
  const [projects, setProjects] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    tag: searchParams.get('tag') || '',
    search: searchParams.get('search') || '',
    project_id: searchParams.get('project_id') || '',
    module_id: searchParams.get('module_id') || '',
  });

  useEffect(() => {
    api.tags.list().then(setTags).catch(console.error);
    api.projects.list().then(setProjects).catch(console.error);
    api.modules.list().then(setModules).catch(console.error);
  }, []);

  useEffect(() => {
    loadData();
  }, [filters]);

  async function loadData() {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.tag) params.tag = filters.tag;
      if (filters.search) params.search = filters.search;
      if (filters.project_id) params.project_id = filters.project_id;
      if (filters.module_id) params.module_id = filters.module_id;
      const data = await api.requirements.list(params);
      setRequirements(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function setFilter(key, value) {
    setFilters(f => ({ ...f, [key]: value }));
  }

  const visibleModules = filters.project_id
    ? modules.filter(m => String(m.project_id) === String(filters.project_id))
    : modules;

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm('Delete this requirement?')) return;
    await api.requirements.delete(id);
    setRequirements(prev => prev.filter(r => r.id !== id));
  }

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Requirements</h1>
          {canEdit && (
            <button className="btn btn-primary" onClick={() => navigate('/requirements/new')}>
              + New Requirement
            </button>
          )}
        </div>

        <div className="filters">
          <input
            placeholder="Search by title or ID…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            style={{ minWidth: 200 }}
          />
          <select value={filters.project_id} onChange={e => { setFilter('project_id', e.target.value); setFilter('module_id', ''); }}>
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filters.module_id} onChange={e => setFilter('module_id', e.target.value)}>
            <option value="">All modules</option>
            {visibleModules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={filters.status} onChange={e => setFilter('status', e.target.value)}>
            <option value="">All statuses</option>
            <option>draft</option>
            <option>active</option>
            <option>approved</option>
            <option>deprecated</option>
          </select>
          <select value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
            <option value="">All priorities</option>
            <option>low</option>
            <option>medium</option>
            <option>high</option>
            <option>critical</option>
          </select>
          <select value={filters.tag} onChange={e => setFilter('tag', e.target.value)}>
            <option value="">All tags</option>
            {tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="empty">Loading…</div>
          ) : requirements.length === 0 ? (
            <div className="empty">No requirements found.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Project / Module</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Tags</th>
                    <th>Updated</th>
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {requirements.map(r => (
                    <tr key={r.id} className="row-link" onClick={() => navigate(`/requirements/${r.id}`)}>
                      <td className="font-mono text-sm">{r.req_id}</td>
                      <td style={{ maxWidth: 260 }}>{r.title}</td>
                      <td className="text-sm text-muted">
                        {r.project_name && (
                          <span>
                            <span>{r.project_name}</span>
                            {r.module_name && <span> / {r.module_name}</span>}
                          </span>
                        )}
                      </td>
                      <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                      <td><span className={`badge badge-${r.priority}`}>{r.priority}</span></td>
                      <td>
                        <div className="tags-list">
                          {r.tags?.map(t => (
                            <span key={t.id} className="tag" style={{ background: t.color }}>{t.name}</span>
                          ))}
                        </div>
                      </td>
                      <td className="text-muted text-sm">{r.updated_at?.slice(0, 10)}</td>
                      {canEdit && (
                        <td onClick={e => e.stopPropagation()}>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={e => handleDelete(e, r.id)}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
