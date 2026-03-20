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
  const [mode, setMode]             = useState('scope'); // 'scope' | 'mvs'

  // Scope mode state
  const [projectId, setProjectId]   = useState('');
  const [moduleId, setModuleId]     = useState('');

  // Module vs Module state
  const [moduleAId, setModuleAId]   = useState('');
  const [moduleBId, setModuleBId]   = useState('');

  const [requirements, setRequirements]   = useState([]); // rows (scope) or module A reqs
  const [requirementsB, setRequirementsB] = useState([]); // columns for mvs mode
  const [links, setLinks]                 = useState([]);
  const [loading, setLoading]             = useState(false);
  const [exporting, setExporting]         = useState(false);
  const [exportError, setExportError]     = useState('');

  // Tooltip state
  const [hoveredReq, setHoveredReq] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    api.projects.list().then(setProjects).catch(console.error);
    api.modules.list().then(setAllModules).catch(console.error);
  }, []);

  // Scope mode: load when project/module changes
  useEffect(() => {
    if (mode !== 'scope') return;
    if (!projectId && !moduleId) {
      setRequirements([]);
      setLinks([]);
      return;
    }
    loadScopeMatrix();
  }, [projectId, moduleId, mode]);

  // Module vs Module: load when both modules are selected
  useEffect(() => {
    if (mode !== 'mvs') return;
    if (!moduleAId || !moduleBId) {
      setRequirements([]);
      setRequirementsB([]);
      setLinks([]);
      return;
    }
    loadMvsMatrix();
  }, [moduleAId, moduleBId, mode]);

  async function loadScopeMatrix() {
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
      setRequirementsB([]);
      setLinks(lnks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMvsMatrix() {
    setLoading(true);
    try {
      const [reqsA, reqsB, lnks] = await Promise.all([
        api.requirements.list({ module_id: moduleAId }),
        api.requirements.list({ module_id: moduleBId }),
        api.links.list({ source_module_id: moduleAId, target_module_id: moduleBId }),
      ]);
      setRequirements(reqsA);
      setRequirementsB(reqsB);
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

  function handleModeChange(newMode) {
    setMode(newMode);
    setRequirements([]);
    setRequirementsB([]);
    setLinks([]);
    setHoveredReq(null);
  }

  function handleSwapModules() {
    const tmp = moduleAId;
    setModuleAId(moduleBId);
    setModuleBId(tmp);
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

  // Build link lookup: linkMap[srcId][tgtId] = link_type
  const linkMap = {};
  links.forEach(l => {
    if (!linkMap[l.source_id]) linkMap[l.source_id] = {};
    linkMap[l.source_id][l.target_id] = l.link_type;
  });

  // Build outgoing/incoming for tooltip
  const outgoingLinks = {};
  const incomingLinks = {};
  links.forEach(l => {
    if (!outgoingLinks[l.source_id]) outgoingLinks[l.source_id] = [];
    outgoingLinks[l.source_id].push({ req_id: l.target_req_id, title: l.target_title, link_type: l.link_type, id: l.target_id });
    if (!incomingLinks[l.target_id]) incomingLinks[l.target_id] = [];
    incomingLinks[l.target_id].push({ req_id: l.source_req_id, title: l.source_title, link_type: l.link_type, id: l.source_id });
  });

  const isMvs = mode === 'mvs';
  const rowReqs = requirements;
  const colReqs = isMvs ? requirementsB : requirements;

  const visibleModules = projectId
    ? allModules.filter(m => String(m.project_id) === String(projectId))
    : allModules;

  const linkCount = links.length;
  const linkedReqIds = new Set([...links.map(l => l.source_id), ...links.map(l => l.target_id)]);

  const hasMatrix = rowReqs.length > 0 && colReqs.length > 0;
  const needsSelection = isMvs ? (!moduleAId || !moduleBId) : !projectId;

  const tooltipOutgoing = hoveredReq ? (outgoingLinks[hoveredReq.id] || []) : [];
  const tooltipIncoming = hoveredReq ? (incomingLinks[hoveredReq.id] || []) : [];
  const hasTooltipContent = tooltipOutgoing.length > 0 || tooltipIncoming.length > 0;

  function handleMouseEnter(req, e) {
    setHoveredReq(req);
    updateTooltipPos(e);
  }

  function handleMouseMove(e) {
    if (hoveredReq) updateTooltipPos(e);
  }

  function updateTooltipPos(e) {
    const x = Math.min(e.clientX + 16, window.innerWidth - 320);
    const y = Math.min(e.clientY + 16, window.innerHeight - 200);
    setTooltipPos({ x, y });
  }

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Traceability Matrix</h1>
          {projectId && mode === 'scope' && (
            <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting…' : '⬇ Export to Word'}
            </button>
          )}
        </div>

        {exportError && <div className="alert alert-error">{exportError}</div>}

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            className={`btn ${mode === 'scope' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleModeChange('scope')}
          >
            Within Scope
          </button>
          <button
            className={`btn ${mode === 'mvs' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleModeChange('mvs')}
          >
            Module vs Module
          </button>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          {mode === 'scope' ? (
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
          ) : (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>Module A (rows)</label>
                <select value={moduleAId} onChange={e => setModuleAId(e.target.value)}>
                  <option value="">— Select module —</option>
                  {allModules.map(m => (
                    <option key={m.id} value={m.id}>{m.project_name} / {m.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ paddingBottom: 2 }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleSwapModules}
                  title="Swap modules"
                  disabled={!moduleAId && !moduleBId}
                >
                  ⇄ Swap
                </button>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>Module B (columns)</label>
                <select value={moduleBId} onChange={e => setModuleBId(e.target.value)}>
                  <option value="">— Select module —</option>
                  {allModules.map(m => (
                    <option key={m.id} value={m.id}>{m.project_name} / {m.name}</option>
                  ))}
                </select>
              </div>
              {hasMatrix && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', paddingBottom: 4 }}>
                  <strong>{rowReqs.length}</strong> × <strong>{colReqs.length}</strong> &nbsp;·&nbsp;
                  <strong>{linkCount}</strong> links
                </div>
              )}
            </div>
          )}
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
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4, fontStyle: 'italic' }}>
            Hover a requirement to see its dependencies
          </span>
        </div>

        {/* Matrix */}
        {needsSelection ? (
          <div className="card empty">
            {isMvs
              ? 'Select two modules above to compare their traceability.'
              : 'Select a project above to view its traceability matrix.'}
          </div>
        ) : loading ? (
          <div className="card empty">Loading…</div>
        ) : !hasMatrix ? (
          <div className="card empty">No requirements found for the selected scope.</div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="matrix-wrap">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th className="matrix-corner">
                      {isMvs ? (
                        <span style={{ fontSize: 10, lineHeight: 1.4 }}>
                          A <span style={{ opacity: .6 }}>╲</span> B
                        </span>
                      ) : (
                        <>Source <span style={{ opacity: .6 }}>╲</span> Target</>
                      )}
                    </th>
                    {colReqs.map(r => (
                      <th key={r.id} className="matrix-col-header">
                        <span
                          className="matrix-col-label"
                          onClick={() => navigate(`/requirements/${r.id}`)}
                          onMouseEnter={e => handleMouseEnter(r, e)}
                          onMouseMove={handleMouseMove}
                          onMouseLeave={() => setHoveredReq(null)}
                          title={`${r.req_id}: ${r.title}`}
                        >
                          {r.req_id}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowReqs.map(src => (
                    <tr key={src.id}>
                      <td
                        className="matrix-row-label"
                        onClick={() => navigate(`/requirements/${src.id}`)}
                        onMouseEnter={e => handleMouseEnter(src, e)}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={() => setHoveredReq(null)}
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
                      {colReqs.map(tgt => {
                        if (!isMvs && src.id === tgt.id) {
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

      {/* Hover tooltip */}
      {hoveredReq && (
        <div
          className="req-tooltip"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
          onMouseEnter={() => setHoveredReq(null)}
        >
          <div className="req-tooltip-header">
            <span style={{ fontWeight: 700 }}>{hoveredReq.req_id}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 12 }}>{hoveredReq.title}</span>
          </div>
          {!hasTooltipContent ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>No links</div>
          ) : (
            <>
              {tooltipOutgoing.length > 0 && (
                <div>
                  <div className="req-tooltip-section-label">Links to</div>
                  {tooltipOutgoing.map((l, i) => (
                    <div key={i} className="req-tooltip-link">
                      <span
                        className="req-tooltip-link-badge"
                        style={{ background: LINK_BG[l.link_type], color: LINK_FG[l.link_type] }}
                      >
                        {LINK_SHORT[l.link_type]}
                      </span>
                      <span style={{ fontWeight: 600 }}>{l.req_id}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: 12 }}>{l.title}</span>
                    </div>
                  ))}
                </div>
              )}
              {tooltipIncoming.length > 0 && (
                <div>
                  <div className="req-tooltip-section-label">Linked from</div>
                  {tooltipIncoming.map((l, i) => (
                    <div key={i} className="req-tooltip-link">
                      <span
                        className="req-tooltip-link-badge"
                        style={{ background: LINK_BG[l.link_type], color: LINK_FG[l.link_type] }}
                      >
                        {LINK_SHORT[l.link_type]}
                      </span>
                      <span style={{ fontWeight: 600 }}>{l.req_id}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: 12 }}>{l.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Layout>
  );
}
