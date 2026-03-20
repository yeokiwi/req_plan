import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';

const LINK_SHORT  = { related: 'R', depends_on: 'D', parent: 'P', child: 'C' };
const LINK_BG     = { related: '#dbeafe', depends_on: '#fef3c7', parent: '#ede9fe', child: '#dcfce7' };
const LINK_FG     = { related: '#1d4ed8', depends_on: '#92400e', parent: '#5b21b6', child: '#15803d' };
const LINK_LABELS = { related: 'Related', depends_on: 'Depends On', parent: 'Parent', child: 'Child' };

export default function TraceabilityPage() {
  const navigate = useNavigate();
  const [projects, setProjects]     = useState([]);
  const [allModules, setAllModules] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [links, setLinks]           = useState([]);
  const [projectId, setProjectId]   = useState('');
  const [moduleId, setModuleId]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    api.projects.list().then(setProjects).catch(console.error);
    api.modules.list().then(setAllModules).catch(console.error);
  }, []);

  useEffect(() => {
    if (!projectId && !moduleId) {
      setRequirements([]);
      setLinks([]);
      return;
    }
    loadMatrix();
  }, [projectId, moduleId]);

  async function loadMatrix() {
    setLoading(true);
    try {
      const params = {};
      if (moduleId) params.module_id = moduleId;
      else if (projectId) params.project_id = projectId;

      const [reqs, lnks] = await Promise.all([
        api.requirements.list(params),
        api.links.list(params),
      ]);
      setRequirements(reqs);
      setLinks(lnks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleProjectChange(pid) {
    setProjectId(pid);
    setModuleId('');
  }

  async function handleExport() {
    if (!projectId) return;
    setExporting(true);
    setExportError('');
    try {
      const blob = await api.export.project(projectId);
      const project = projects.find(p => String(p.id) === String(projectId));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(project?.name || 'export').replace(/[^a-z0-9 \-_]/gi, '').trim()}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  }

  // Build lookup: linkMap[srcId][tgtId] = link_type
  const linkMap = {};
  links.forEach(l => {
    if (!linkMap[l.source_id]) linkMap[l.source_id] = {};
    linkMap[l.source_id][l.target_id] = l.link_type;
  });

  const visibleModules = projectId
    ? allModules.filter(m => String(m.project_id) === String(projectId))
    : allModules;

  const selectedProject = projects.find(p => String(p.id) === String(projectId));

  const linkCount = links.length;
  const linkedReqIds = new Set([...links.map(l => l.source_id), ...links.map(l => l.target_id)]);

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Traceability Matrix</h1>
          {projectId && (
            <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting…' : '⬇ Export to Word'}
            </button>
          )}
        </div>

        {exportError && <div className="alert alert-error">{exportError}</div>}

        {/* Filters */}
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>Project *</label>
              <select value={projectId} onChange={e => handleProjectChange(e.target.value)}>
                <option value="">— Select a project —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>
                Module <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <select
                value={moduleId}
                onChange={e => setModuleId(e.target.value)}
                disabled={!projectId}
              >
                <option value="">All modules</option>
                {visibleModules.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            {requirements.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', paddingBottom: 4 }}>
                <strong>{requirements.length}</strong> requirements &nbsp;·&nbsp;
                <strong>{linkCount}</strong> links &nbsp;·&nbsp;
                <strong>{linkedReqIds.size}</strong> linked
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Legend:</span>
          {Object.entries(LINK_LABELS).map(([type, label]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: 4, fontWeight: 700,
                background: LINK_BG[type], color: LINK_FG[type],
              }}>
                {LINK_SHORT[type]}
              </span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Matrix */}
        {!projectId ? (
          <div className="card empty">Select a project above to view its traceability matrix.</div>
        ) : loading ? (
          <div className="card empty">Loading…</div>
        ) : requirements.length === 0 ? (
          <div className="card empty">No requirements found for the selected scope.</div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="matrix-wrap">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th className="matrix-corner">
                      Source <span style={{ opacity: .6 }}>╲</span> Target
                    </th>
                    {requirements.map(r => (
                      <th key={r.id} className="matrix-col-header">
                        <span
                          className="matrix-col-label"
                          onClick={() => navigate(`/requirements/${r.id}`)}
                          title={`${r.req_id}: ${r.title}`}
                        >
                          {r.req_id}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requirements.map(src => (
                    <tr key={src.id}>
                      <td
                        className="matrix-row-label"
                        onClick={() => navigate(`/requirements/${src.id}`)}
                        title={src.title}
                      >
                        <span className="font-mono" style={{ flexShrink: 0, fontSize: 11, fontWeight: 600 }}>
                          {src.req_id}
                        </span>
                        <span style={{
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          color: 'var(--text-muted)', fontSize: 11,
                        }}>
                          {src.title}
                        </span>
                      </td>
                      {requirements.map(tgt => {
                        if (src.id === tgt.id) {
                          return <td key={tgt.id} className="matrix-cell-self">—</td>;
                        }
                        const lt = linkMap[src.id]?.[tgt.id];
                        if (!lt) return <td key={tgt.id} className="matrix-cell-empty" />;
                        return (
                          <td
                            key={tgt.id}
                            className="matrix-cell-link"
                            style={{ background: LINK_BG[lt], color: LINK_FG[lt] }}
                            title={`${src.req_id} → ${lt.replace('_', ' ')} → ${tgt.req_id}`}
                          >
                            {LINK_SHORT[lt]}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
