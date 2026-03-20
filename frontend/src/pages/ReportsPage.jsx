import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

const LINK_BG = { related: '#dbeafe', depends_on: '#fef3c7', parent: '#ede9fe', child: '#dcfce7' };
const LINK_FG = { related: '#1d4ed8', depends_on: '#92400e', parent: '#5b21b6', child: '#15803d' };

const STATUS_COLOR = {
  draft: '#94a3b8', active: '#2563eb', review: '#d97706', approved: '#16a34a', rejected: '#dc2626',
};
const PRIORITY_COLOR = {
  low: '#94a3b8', medium: '#d97706', high: '#ea580c', critical: '#dc2626',
};

const BADGE = {
  display: 'inline-block', padding: '2px 8px', borderRadius: 10,
  fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const [tab, setTab]             = useState('dependency'); // 'dependency' | 'coverage' | 'baselines'
  const [projects, setProjects]   = useState([]);
  const [allModules, setAllModules] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [moduleId, setModuleId]   = useState('');
  const [requirements, setRequirements] = useState([]);
  const [links, setLinks]         = useState([]);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    api.projects.list().then(setProjects).catch(console.error);
    api.modules.list().then(setAllModules).catch(console.error);
  }, []);

  useEffect(() => {
    if (!projectId) { setRequirements([]); setLinks([]); return; }
    load();
  }, [projectId, moduleId]);

  async function load() {
    setLoading(true);
    try {
      const params = moduleId ? { module_id: moduleId } : { project_id: projectId };
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

  const visibleModules = projectId
    ? allModules.filter(m => String(m.project_id) === String(projectId))
    : allModules;

  // ── Dependency matrix ──────────────────────────────────────────────────────
  const depLinks = links.filter(l => l.link_type === 'depends_on');
  const depReqIds = new Set([...depLinks.map(l => l.source_id), ...depLinks.map(l => l.target_id)]);
  const depReqs = requirements.filter(r => depReqIds.has(r.id));
  const depMap = {};
  depLinks.forEach(l => {
    if (!depMap[l.source_id]) depMap[l.source_id] = {};
    depMap[l.source_id][l.target_id] = true;
  });

  // ── Coverage report ────────────────────────────────────────────────────────
  const linkedIds = new Set([...links.map(l => l.source_id), ...links.map(l => l.target_id)]);
  const coveredReqs   = requirements.filter(r => linkedIds.has(r.id));
  const uncoveredReqs = requirements.filter(r => !linkedIds.has(r.id));
  const coveragePct = requirements.length
    ? Math.round((coveredReqs.length / requirements.length) * 100) : 0;

  // Link-type breakdown for covered reqs
  const linkTypeCounts = {};
  links.forEach(l => { linkTypeCounts[l.link_type] = (linkTypeCounts[l.link_type] || 0) + 1; });

  // Per-module breakdown
  const modMap = {};
  requirements.forEach(r => {
    const k = r.module_id || '__none__';
    if (!modMap[k]) modMap[k] = { name: r.module_name || '(No module)', total: 0, covered: 0 };
    modMap[k].total++;
    if (linkedIds.has(r.id)) modMap[k].covered++;
  });
  const modBreakdown = Object.values(modMap).map(m => ({
    ...m, uncovered: m.total - m.covered,
    pct: Math.round((m.covered / m.total) * 100),
  }));

  const noScope = !projectId;
  const empty   = !loading && projectId && requirements.length === 0;

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Reports</h1>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
          {[['dependency', 'Dependency Matrix'], ['coverage', 'Coverage Report'], ['baselines', 'Baselines']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: tab === key ? 700 : 400,
                color: tab === key ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -2, fontSize: 14,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scope selector — hidden for Baselines tab (it has its own project picker) */}
        {tab !== 'baselines' && (
          <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>Project *</label>
                <select value={projectId} onChange={e => handleProjectChange(e.target.value)}>
                  <option value="">— Select a project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>
                  Module <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <select value={moduleId} onChange={e => setModuleId(e.target.value)} disabled={!projectId}>
                  <option value="">All modules</option>
                  {visibleModules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {tab === 'baselines' ? (
          <BaselinesTab projects={projects} />
        ) : noScope ? (
          <div className="card empty">Select a project above to generate the report.</div>
        ) : loading ? (
          <div className="card empty">Loading…</div>
        ) : empty ? (
          <div className="card empty">No requirements found for the selected scope.</div>
        ) : tab === 'dependency' ? (
          <DepMatrix depReqs={depReqs} depMap={depMap} navigate={navigate} />
        ) : (
          <CoverageReport
            requirements={requirements}
            coveredReqs={coveredReqs}
            uncoveredReqs={uncoveredReqs}
            coveragePct={coveragePct}
            linkTypeCounts={linkTypeCounts}
            modBreakdown={modBreakdown}
            navigate={navigate}
          />
        )}
      </div>
    </Layout>
  );
}

// ── Dependency Matrix tab ──────────────────────────────────────────────────────
function DepMatrix({ depReqs, depMap, navigate }) {
  if (depReqs.length === 0) {
    return <div className="card empty">No <em>Depends On</em> links found in this scope.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        Only requirements with at least one <strong>Depends On</strong> link are shown.
        A cell marked <strong style={{ color: LINK_FG.depends_on }}>D</strong> means the row requirement depends on the column requirement.
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="matrix-wrap">
          <table className="matrix-table">
            <thead>
              <tr>
                <th className="matrix-corner" style={{ fontSize: 11 }}>
                  Dependent <span style={{ opacity: .6 }}>╲</span> Dependency
                </th>
                {depReqs.map(r => (
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
              {depReqs.map(src => (
                <tr key={src.id}>
                  <td
                    className="matrix-row-label"
                    onClick={() => navigate(`/requirements/${src.id}`)}
                    title={src.title}
                  >
                    <span className="font-mono" style={{ flexShrink: 0, fontSize: 11, fontWeight: 600 }}>
                      {src.req_id}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-muted)', fontSize: 11 }}>
                      {src.title}
                    </span>
                  </td>
                  {depReqs.map(tgt => {
                    if (src.id === tgt.id) return <td key={tgt.id} className="matrix-cell-self">—</td>;
                    if (depMap[src.id]?.[tgt.id]) {
                      return (
                        <td
                          key={tgt.id}
                          className="matrix-cell-link"
                          style={{ background: LINK_BG.depends_on, color: LINK_FG.depends_on }}
                          title={`${src.req_id} depends on ${tgt.req_id}`}
                        >
                          D
                        </td>
                      );
                    }
                    return <td key={tgt.id} className="matrix-cell-empty" />;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Coverage Report tab ────────────────────────────────────────────────────────
function CoverageReport({ requirements, coveredReqs, uncoveredReqs, coveragePct, linkTypeCounts, modBreakdown, navigate }) {
  const pctColor = coveragePct >= 80 ? '#16a34a' : coveragePct >= 50 ? '#d97706' : '#dc2626';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Summary stats */}
      <div className="stat-grid">
        {[
          { label: 'Total Requirements', value: requirements.length, color: null },
          { label: 'Covered', value: coveredReqs.length, color: '#16a34a' },
          { label: 'Uncovered', value: uncoveredReqs.length, color: uncoveredReqs.length > 0 ? '#dc2626' : '#16a34a' },
          { label: 'Coverage', value: `${coveragePct}%`, color: pctColor },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={s.color ? { color: s.color } : {}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Coverage bar */}
      <div className="card" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
          <span>Overall Coverage</span>
          <span style={{ color: pctColor }}>{coveragePct}%</span>
        </div>
        <div style={{ height: 14, borderRadius: 7, background: '#f1f5f9', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 7, background: pctColor,
            width: `${coveragePct}%`, transition: 'width .4s ease',
          }} />
        </div>
        {Object.keys(linkTypeCounts).length > 0 && (
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            {Object.entries(linkTypeCounts).map(([type, count]) => (
              <span
                key={type}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: LINK_BG[type] || '#f1f5f9', color: LINK_FG[type] || '#334155',
                }}
              >
                {count} {type.replace('_', ' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Per-module breakdown */}
      {modBreakdown.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
            Coverage by Module
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Module', 'Total', 'Covered', 'Uncovered', 'Coverage'].map(h => (
                  <th key={h} style={{
                    padding: '8px 14px', textAlign: 'left',
                    borderBottom: '1px solid var(--border)',
                    fontWeight: 600, fontSize: 12, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '.04em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modBreakdown.map((m, i) => {
                const c = m.pct >= 80 ? '#16a34a' : m.pct >= 50 ? '#d97706' : '#dc2626';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 14px', fontWeight: 500 }}>{m.name}</td>
                    <td style={{ padding: '8px 14px' }}>{m.total}</td>
                    <td style={{ padding: '8px 14px', color: '#16a34a', fontWeight: 600 }}>{m.covered}</td>
                    <td style={{
                      padding: '8px 14px', fontWeight: m.uncovered > 0 ? 600 : 400,
                      color: m.uncovered > 0 ? '#dc2626' : 'var(--text-muted)',
                    }}>
                      {m.uncovered}
                    </td>
                    <td style={{ padding: '8px 14px', minWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 4, background: c, width: `${m.pct}%` }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: c, minWidth: 32 }}>{m.pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Uncovered requirements list */}
      {uncoveredReqs.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
            Uncovered Requirements
            <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, color: 'var(--text-muted)' }}>
              — no traceability links
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['ID', 'Title', 'Module', 'Status', 'Priority'].map(h => (
                  <th key={h} style={{
                    padding: '8px 14px', textAlign: 'left',
                    borderBottom: '1px solid var(--border)',
                    fontWeight: 600, fontSize: 12, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '.04em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uncoveredReqs.map(r => (
                <tr
                  key={r.id}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => navigate(`/requirements/${r.id}`)}
                >
                  <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontWeight: 600 }}>{r.req_id}</td>
                  <td style={{ padding: '8px 14px', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title}
                  </td>
                  <td style={{ padding: '8px 14px', color: 'var(--text-muted)' }}>{r.module_name || '—'}</td>
                  <td style={{ padding: '8px 14px' }}>
                    <span style={{ ...BADGE, background: (STATUS_COLOR[r.status] || '#94a3b8') + '22', color: STATUS_COLOR[r.status] || '#94a3b8' }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '8px 14px' }}>
                    <span style={{ ...BADGE, background: (PRIORITY_COLOR[r.priority] || '#94a3b8') + '22', color: PRIORITY_COLOR[r.priority] || '#94a3b8' }}>
                      {r.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card empty" style={{ color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4' }}>
          All requirements have at least one traceability link.
        </div>
      )}
    </div>
  );
}

// ── Diff computation (pure function, no React) ─────────────────────────────────
function computeDiff(bA, bB) {
  const mapA = {};
  bA.requirements.forEach(r => { mapA[r.requirement_id] = r; });
  const mapB = {};
  bB.requirements.forEach(r => { mapB[r.requirement_id] = r; });

  const allIds = new Set([...Object.keys(mapA), ...Object.keys(mapB)].map(Number));
  const added = [], removed = [], changed = [];

  allIds.forEach(id => {
    const a = mapA[id], b = mapB[id];
    if (!a && b)  { added.push(b); return; }
    if (a && !b)  { removed.push(a); return; }
    const diffs = [];
    for (const f of ['title', 'description', 'status', 'priority', 'module_name']) {
      const va = (a[f] || '').toString(), vb = (b[f] || '').toString();
      if (va !== vb) diffs.push({ field: f, from: va || '—', to: vb || '—' });
    }
    if (diffs.length > 0) changed.push({ req: b, diffs });
  });

  // Build req_id lookup from both baselines
  const idToReqId = {};
  [...bA.requirements, ...bB.requirements].forEach(r => { idToReqId[r.requirement_id] = r.req_id; });

  const linkKey = l => `${l.source_requirement_id}|${l.target_requirement_id}|${l.link_type}`;
  const setA = new Set(bA.links.map(linkKey));
  const setB = new Set(bB.links.map(linkKey));
  const linksAdded   = bB.links.filter(l => !setA.has(linkKey(l)));
  const linksRemoved = bA.links.filter(l => !setB.has(linkKey(l)));

  return { added, removed, changed, linksAdded, linksRemoved, idToReqId };
}

// ── Baselines Tab ──────────────────────────────────────────────────────────────
function BaselinesTab({ projects }) {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const [projectId, setProjectId]   = useState('');
  const [baselines, setBaselines]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [formName, setFormName]     = useState('');
  const [formDesc, setFormDesc]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expanded, setExpanded]     = useState(null);
  const [restoreMsg, setRestoreMsg] = useState({});
  const [restoring, setRestoring]   = useState(null);

  // Compare state
  const [baselineAId, setBaselineAId] = useState('');
  const [baselineBId, setBaselineBId] = useState('');
  const [diff, setDiff]               = useState(null);
  const [comparing, setComparing]     = useState(false);

  useEffect(() => {
    if (!projectId) { setBaselines([]); setDiff(null); return; }
    loadBaselines();
  }, [projectId]);

  // Reset compare when project changes
  useEffect(() => {
    setBaselineAId(''); setBaselineBId(''); setDiff(null);
  }, [projectId]);

  async function loadBaselines() {
    setLoading(true);
    try { setBaselines(await api.baselines.list(projectId)); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!formName.trim()) { setFormError('Name is required.'); return; }
    setSaving(true); setFormError('');
    try {
      await api.baselines.create({ project_id: projectId, name: formName.trim(), description: formDesc.trim() });
      setFormName(''); setFormDesc(''); setShowForm(false);
      await loadBaselines();
    } catch (err) {
      setFormError(err.message);
    } finally { setSaving(false); }
  }

  async function handleExpand(id) {
    if (expandedId === id) { setExpandedId(null); setExpanded(null); return; }
    setExpandedId(id); setExpanded(null);
    try { setExpanded(await api.baselines.get(id)); }
    catch (err) { console.error(err); }
  }

  async function handleRestore(id) {
    if (!window.confirm('Restore this baseline? Requirements that still exist will be reverted to their snapshot values and links will be restored. New requirements added after the snapshot are not affected.')) return;
    setRestoring(id);
    try {
      const result = await api.baselines.restore(id);
      setRestoreMsg(prev => ({ ...prev, [id]: result.message }));
    } catch (err) {
      setRestoreMsg(prev => ({ ...prev, [id]: `Error: ${err.message}` }));
    } finally { setRestoring(null); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this baseline? This cannot be undone.')) return;
    try {
      await api.baselines.delete(id);
      if (expandedId === id) { setExpandedId(null); setExpanded(null); }
      if (String(baselineAId) === String(id)) { setBaselineAId(''); setDiff(null); }
      if (String(baselineBId) === String(id)) { setBaselineBId(''); setDiff(null); }
      setRestoreMsg(prev => { const n = { ...prev }; delete n[id]; return n; });
      await loadBaselines();
    } catch (err) { console.error(err); }
  }

  async function handleCompare() {
    if (!baselineAId || !baselineBId || baselineAId === baselineBId) return;
    setComparing(true); setDiff(null);
    try {
      const [bA, bB] = await Promise.all([
        api.baselines.get(baselineAId),
        api.baselines.get(baselineBId),
      ]);
      setDiff({ result: computeDiff(bA, bB), nameA: bA.name, nameB: bB.name });
    } catch (err) { console.error(err); }
    finally { setComparing(false); }
  }

  const TH_STYLE = {
    padding: '7px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)',
    fontWeight: 600, fontSize: 11, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '.04em', background: '#f8fafc',
  };

  const canCompare = baselineAId && baselineBId && baselineAId !== baselineBId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Project selector + Create button */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>Project *</label>
            <select value={projectId} onChange={e => { setProjectId(e.target.value); setShowForm(false); setRestoreMsg({}); }}>
              <option value="">— Select a project —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {projectId && canEdit && (
            <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
              {showForm ? '✕ Cancel' : '+ Create Baseline'}
            </button>
          )}
        </div>

        {/* Create form */}
        {showForm && (
          <form onSubmit={handleCreate} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>Name *</label>
                <input
                  value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. v1.0 Release Baseline"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>
                  Description <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <textarea
                  value={formDesc} onChange={e => setFormDesc(e.target.value)}
                  rows={2} placeholder="What changed, why this snapshot was taken…"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
              {formError && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{formError}</div>}
              <div>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : '💾 Save Baseline'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Compare panel — shown when ≥ 2 baselines exist */}
      {projectId && baselines.length >= 2 && (
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Compare Baselines</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>Baseline A (before)</label>
              <select value={baselineAId} onChange={e => { setBaselineAId(e.target.value); setDiff(null); }}>
                <option value="">— Select —</option>
                {baselines.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div style={{ paddingBottom: 2, color: 'var(--text-muted)', fontWeight: 700 }}>vs</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>Baseline B (after)</label>
              <select value={baselineBId} onChange={e => { setBaselineBId(e.target.value); setDiff(null); }}>
                <option value="">— Select —</option>
                {baselines.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleCompare}
              disabled={!canCompare || comparing}
            >
              {comparing ? 'Comparing…' : '⇄ Compare'}
            </button>
          </div>
          {baselineAId && baselineBId && baselineAId === baselineBId && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--warning)' }}>Select two different baselines.</div>
          )}
        </div>
      )}

      {/* Diff result */}
      {diff && <BaselineDiff diff={diff} />}

      {/* Baselines list */}
      {!projectId ? null : loading ? (
        <div className="card empty">Loading…</div>
      ) : baselines.length === 0 ? (
        <div className="card empty">No baselines saved for this project yet.</div>
      ) : (
        baselines.map(b => {
          const isExpanded = expandedId === b.id;
          const msg = restoreMsg[b.id];
          return (
            <div key={b.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{b.name}</div>
                  {b.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{b.description}</div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12 }}>
                    <span>{new Date(b.created_at).toLocaleString()}</span>
                    <span>by {b.created_by_name}</span>
                    <span><strong>{b.req_count}</strong> reqs · <strong>{b.link_count}</strong> links</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => handleExpand(b.id)}>
                    {isExpanded ? '▲ Hide' : '▼ Details'}
                  </button>
                  {canEdit && (
                    <>
                      <button
                        className="btn btn-primary" style={{ fontSize: 12 }}
                        onClick={() => handleRestore(b.id)}
                        disabled={restoring === b.id}
                      >
                        {restoring === b.id ? 'Restoring…' : '↩ Restore'}
                      </button>
                      <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={() => handleDelete(b.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {msg && (
                <div style={{
                  margin: '0 16px 12px', padding: '8px 12px', borderRadius: 6, fontSize: 13,
                  background: msg.startsWith('Error') ? '#fef2f2' : '#f0fdf4',
                  color: msg.startsWith('Error') ? '#dc2626' : '#16a34a',
                  border: `1px solid ${msg.startsWith('Error') ? '#fecaca' : '#bbf7d0'}`,
                }}>
                  {msg}
                </div>
              )}

              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
                  {!expanded || expanded.id !== b.id ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
                  ) : expanded.requirements.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No requirements in this snapshot.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          {['ID', 'Title', 'Module', 'Status', 'Priority'].map(h => (
                            <th key={h} style={TH_STYLE}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {expanded.requirements.map(r => (
                          <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{r.req_id}</td>
                            <td style={{ padding: '6px 12px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</td>
                            <td style={{ padding: '6px 12px', color: 'var(--text-muted)' }}>{r.module_name || '—'}</td>
                            <td style={{ padding: '6px 12px' }}>
                              <span style={{ ...BADGE, background: (STATUS_COLOR[r.status] || '#94a3b8') + '22', color: STATUS_COLOR[r.status] || '#94a3b8' }}>
                                {r.status}
                              </span>
                            </td>
                            <td style={{ padding: '6px 12px' }}>
                              <span style={{ ...BADGE, background: (PRIORITY_COLOR[r.priority] || '#94a3b8') + '22', color: PRIORITY_COLOR[r.priority] || '#94a3b8' }}>
                                {r.priority}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Baseline Diff Renderer ─────────────────────────────────────────────────────
function BaselineDiff({ diff }) {
  const { result, nameA, nameB } = diff;
  const { added, removed, changed, linksAdded, linksRemoved, idToReqId } = result;

  const totalChanges = added.length + removed.length + changed.length + linksAdded.length + linksRemoved.length;

  const SECTION = ({ color, bg, border, title, count, children }) => (
    <div className="card" style={{ padding: 0, overflow: 'hidden', border: `1px solid ${border}` }}>
      <div style={{ padding: '10px 16px', background: bg, borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color }}>{title}</span>
        <span style={{ ...BADGE, background: color + '22', color, fontSize: 11 }}>{count}</span>
      </div>
      <div style={{ padding: '12px 16px' }}>{children}</div>
    </div>
  );

  const TH = { padding: '6px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid var(--border)', background: '#f8fafc' };
  const TD = { padding: '6px 12px', borderBottom: '1px solid var(--border)', fontSize: 12 };

  function ReqRow({ r }) {
    return (
      <tr>
        <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 600 }}>{r.req_id}</td>
        <td style={{ ...TD, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</td>
        <td style={{ ...TD, color: 'var(--text-muted)' }}>{r.module_name || '—'}</td>
        <td style={TD}>
          <span style={{ ...BADGE, background: (STATUS_COLOR[r.status] || '#94a3b8') + '22', color: STATUS_COLOR[r.status] || '#94a3b8' }}>{r.status}</span>
        </td>
        <td style={TD}>
          <span style={{ ...BADGE, background: (PRIORITY_COLOR[r.priority] || '#94a3b8') + '22', color: PRIORITY_COLOR[r.priority] || '#94a3b8' }}>{r.priority}</span>
        </td>
      </tr>
    );
  }

  function ReqTable({ rows }) {
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>{['ID', 'Title', 'Module', 'Status', 'Priority'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <ReqRow key={i} r={r} />)}</tbody>
      </table>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div className="card" style={{ padding: '14px 20px' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
          Comparison: <span style={{ color: 'var(--primary)' }}>{nameA}</span>
          <span style={{ margin: '0 8px', color: 'var(--text-muted)', fontWeight: 400 }}>→</span>
          <span style={{ color: 'var(--primary)' }}>{nameB}</span>
        </div>
        {totalChanges === 0 ? (
          <div style={{ color: '#16a34a', fontWeight: 600, fontSize: 13 }}>No differences — the two baselines are identical.</div>
        ) : (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Added', count: added.length, color: '#16a34a' },
              { label: 'Removed', count: removed.length, color: '#dc2626' },
              { label: 'Changed', count: changed.length, color: '#d97706' },
              { label: 'Links +', count: linksAdded.length, color: '#2563eb' },
              { label: 'Links −', count: linksRemoved.length, color: '#7c3aed' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Added requirements */}
      {added.length > 0 && (
        <SECTION title="Added Requirements" count={added.length} color="#16a34a" bg="#f0fdf4" border="#bbf7d0">
          <ReqTable rows={added} />
        </SECTION>
      )}

      {/* Removed requirements */}
      {removed.length > 0 && (
        <SECTION title="Removed Requirements" count={removed.length} color="#dc2626" bg="#fef2f2" border="#fecaca">
          <ReqTable rows={removed} />
        </SECTION>
      )}

      {/* Changed requirements */}
      {changed.length > 0 && (
        <SECTION title="Changed Requirements" count={changed.length} color="#d97706" bg="#fffbeb" border="#fde68a">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>{['ID', 'Field', `${nameA} (before)`, `${nameB} (after)`].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {changed.map(({ req, diffs }, i) =>
                diffs.map((d, j) => (
                  <tr key={`${i}-${j}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    {j === 0 && (
                      <td rowSpan={diffs.length} style={{ ...TD, fontFamily: 'monospace', fontWeight: 600, verticalAlign: 'top', borderRight: '1px solid var(--border)' }}>
                        {req.req_id}
                      </td>
                    )}
                    <td style={{ ...TD, fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                      {d.field.replace('_', ' ')}
                    </td>
                    <td style={{ ...TD, color: '#dc2626', textDecoration: 'line-through', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.from}
                    </td>
                    <td style={{ ...TD, color: '#16a34a', fontWeight: 600, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.to}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </SECTION>
      )}

      {/* Link changes */}
      {(linksAdded.length > 0 || linksRemoved.length > 0) && (
        <SECTION
          title="Link Changes"
          count={linksAdded.length + linksRemoved.length}
          color="#2563eb" bg="#eff6ff" border="#bfdbfe"
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>{['Change', 'Source', 'Type', 'Target'].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {linksAdded.map((l, i) => (
                <tr key={`a${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...TD, color: '#16a34a', fontWeight: 700 }}>+ Added</td>
                  <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 600 }}>{idToReqId[l.source_requirement_id] || l.source_requirement_id}</td>
                  <td style={TD}>{l.link_type.replace('_', ' ')}</td>
                  <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 600 }}>{idToReqId[l.target_requirement_id] || l.target_requirement_id}</td>
                </tr>
              ))}
              {linksRemoved.map((l, i) => (
                <tr key={`r${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...TD, color: '#dc2626', fontWeight: 700 }}>− Removed</td>
                  <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 600 }}>{idToReqId[l.source_requirement_id] || l.source_requirement_id}</td>
                  <td style={TD}>{l.link_type.replace('_', ' ')}</td>
                  <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 600 }}>{idToReqId[l.target_requirement_id] || l.target_requirement_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SECTION>
      )}
    </div>
  );
}
