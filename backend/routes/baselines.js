const express = require('express');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function getBaseline(id) {
  const baseline = db.prepare(`
    SELECT b.*, u.username as created_by_name, p.name as project_name
    FROM baselines b
    LEFT JOIN users u ON b.created_by = u.id
    LEFT JOIN projects p ON b.project_id = p.id
    WHERE b.id = ?
  `).get(id);
  if (!baseline) return null;
  baseline.requirements = db.prepare(
    'SELECT * FROM baseline_requirements WHERE baseline_id = ? ORDER BY req_id'
  ).all(id);
  baseline.links = db.prepare(
    'SELECT * FROM baseline_links WHERE baseline_id = ?'
  ).all(id);
  return baseline;
}

// List baselines for a project (summary only)
router.get('/', (req, res) => {
  const { project_id } = req.query;
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });
  const rows = db.prepare(`
    SELECT b.id, b.name, b.description, b.project_id, b.created_at,
           u.username as created_by_name,
           COUNT(br.id) as req_count,
           (SELECT COUNT(*) FROM baseline_links WHERE baseline_id = b.id) as link_count
    FROM baselines b
    LEFT JOIN users u ON b.created_by = u.id
    LEFT JOIN baseline_requirements br ON br.baseline_id = b.id
    WHERE b.project_id = ?
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `).all(project_id);
  res.json(rows);
});

// Get full baseline detail
router.get('/:id', (req, res) => {
  const baseline = getBaseline(req.params.id);
  if (!baseline) return res.status(404).json({ error: 'Baseline not found' });
  res.json(baseline);
});

// Create a baseline snapshot
router.post('/', requireRole('admin', 'manager'), (req, res) => {
  const { project_id, name, description } = req.body;
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(project_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const result = db.prepare(
    'INSERT INTO baselines (project_id, name, description, created_by) VALUES (?, ?, ?, ?)'
  ).run(project_id, name.trim(), description || '', req.user.id);
  const baselineId = Number(result.lastInsertRowid);

  // Snapshot all requirements that belong to this project via their module
  const reqs = db.prepare(`
    SELECT r.id, r.req_id, r.title, r.description, r.status, r.priority,
           r.module_id, m.name as module_name
    FROM requirements r
    JOIN modules m ON r.module_id = m.id
    WHERE m.project_id = ?
    ORDER BY r.req_id
  `).all(project_id);

  const insertReq = db.prepare(`
    INSERT INTO baseline_requirements
      (baseline_id, requirement_id, req_id, title, description, status, priority, module_id, module_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  reqs.forEach(r => {
    insertReq.run(baselineId, r.id, r.req_id, r.title, r.description || '', r.status, r.priority, r.module_id, r.module_name);
  });

  // Snapshot all links where both ends are within this project
  if (reqs.length > 0) {
    const reqIds = reqs.map(r => r.id);
    const ph = reqIds.map(() => '?').join(',');
    const links = db.prepare(`
      SELECT source_id, target_id, link_type FROM requirement_links
      WHERE source_id IN (${ph}) AND target_id IN (${ph})
    `).all(...reqIds, ...reqIds);

    const insertLink = db.prepare(`
      INSERT INTO baseline_links (baseline_id, source_requirement_id, target_requirement_id, link_type)
      VALUES (?, ?, ?, ?)
    `);
    links.forEach(l => insertLink.run(baselineId, l.source_id, l.target_id, l.link_type));
  }

  res.status(201).json(getBaseline(baselineId));
});

// Restore a baseline
router.post('/:id/restore', requireRole('admin', 'manager'), (req, res) => {
  const baseline = getBaseline(req.params.id);
  if (!baseline) return res.status(404).json({ error: 'Baseline not found' });

  let updated = 0;
  const restoredIds = [];

  // Update each requirement that still exists (matched by original id)
  baseline.requirements.forEach(br => {
    const existing = db.prepare('SELECT id FROM requirements WHERE id = ?').get(br.requirement_id);
    if (existing) {
      db.prepare(`
        UPDATE requirements
        SET title = ?, description = ?, status = ?, priority = ?, module_id = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(br.title, br.description, br.status, br.priority, br.module_id, br.requirement_id);
      updated++;
      restoredIds.push(br.requirement_id);
    }
  });

  // Restore links among the successfully restored requirements
  if (restoredIds.length > 0) {
    const ph = restoredIds.map(() => '?').join(',');
    db.prepare(
      `DELETE FROM requirement_links WHERE source_id IN (${ph}) AND target_id IN (${ph})`
    ).run(...restoredIds, ...restoredIds);

    const restoredSet = new Set(restoredIds);
    const insertLink = db.prepare(
      'INSERT OR IGNORE INTO requirement_links (source_id, target_id, link_type) VALUES (?, ?, ?)'
    );
    baseline.links.forEach(l => {
      if (restoredSet.has(l.source_requirement_id) && restoredSet.has(l.target_requirement_id)) {
        insertLink.run(l.source_requirement_id, l.target_requirement_id, l.link_type);
      }
    });
  }

  const skipped = baseline.requirements.length - updated;
  res.json({
    message: `Restored ${updated} requirement${updated !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} skipped — deleted since snapshot)` : ''}.`,
    updated_count: updated,
    skipped_count: skipped,
  });
});

// Delete a baseline
router.delete('/:id', requireRole('admin', 'manager'), (req, res) => {
  const info = db.prepare('DELETE FROM baselines WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Baseline not found' });
  res.status(204).end();
});

module.exports = router;
