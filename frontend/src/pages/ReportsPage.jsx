import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';

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
  const [tab, setTab]             = useState('dependency'); // 'dependency' | 'coverage'
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
          {[['dependency', 'Dependency Matrix'], ['coverage', 'Coverage Report']].map(([key, label]) => (
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

        {/* Scope selector */}
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

        {/* Content */}
        {noScope ? (
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
