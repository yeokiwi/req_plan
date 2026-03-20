const express = require('express');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function generateReqId() {
  const count = db.prepare('SELECT COUNT(*) as c FROM requirements').get().c;
  return `REQ-${String(count + 1).padStart(4, '0')}`;
}

function getFullRequirement(id) {
  const req = db.prepare(`
    SELECT r.*, u1.username as created_by_name, u2.username as updated_by_name,
           m.name as module_name, m.project_id,
           p.name as project_name
    FROM requirements r
    LEFT JOIN users u1 ON r.created_by = u1.id
    LEFT JOIN users u2 ON r.updated_by = u2.id
    LEFT JOIN modules m ON r.module_id = m.id
    LEFT JOIN projects p ON m.project_id = p.id
    WHERE r.id = ?
  `).get(id);
  if (!req) return null;

  req.tags = db.prepare(`
    SELECT t.id, t.name, t.color FROM tags t
    JOIN requirement_tags rt ON rt.tag_id = t.id
    WHERE rt.requirement_id = ?
  `).all(id);

  req.links = db.prepare(`
    SELECT rl.id, rl.link_type, rl.target_id,
           r.req_id as target_req_id, r.title as target_title,
           m.name as target_module_name, p.name as target_project_name
    FROM requirement_links rl
    JOIN requirements r ON r.id = rl.target_id
    LEFT JOIN modules m ON r.module_id = m.id
    LEFT JOIN projects p ON m.project_id = p.id
    WHERE rl.source_id = ?
  `).all(id);

  return req;
}

// List requirements with optional filters
router.get('/', (req, res) => {
  const { status, priority, tag, search, module_id, project_id } = req.query;
  let query = `
    SELECT DISTINCT r.id, r.req_id, r.title, r.status, r.priority, r.created_at, r.updated_at,
           u.username as created_by_name, r.module_id,
           m.name as module_name, m.project_id, p.name as project_name
    FROM requirements r
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN modules m ON r.module_id = m.id
    LEFT JOIN projects p ON m.project_id = p.id
    LEFT JOIN requirement_tags rt ON rt.requirement_id = r.id
    LEFT JOIN tags t ON t.id = rt.tag_id
    WHERE 1=1
  `;
  const params = [];
  if (status) { query += ' AND r.status = ?'; params.push(status); }
  if (priority) { query += ' AND r.priority = ?'; params.push(priority); }
  if (tag) { query += ' AND t.name = ?'; params.push(tag); }
  if (search) { query += ' AND (r.title LIKE ? OR r.req_id LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (module_id) { query += ' AND r.module_id = ?'; params.push(module_id); }
  if (project_id) { query += ' AND m.project_id = ?'; params.push(project_id); }
  query += ' ORDER BY r.created_at DESC';
  const rows = db.prepare(query).all(...params);
  rows.forEach(row => {
    row.tags = db.prepare(`
      SELECT t.id, t.name, t.color FROM tags t
      JOIN requirement_tags rt ON rt.tag_id = t.id
      WHERE rt.requirement_id = ?
    `).all(row.id);
  });
  res.json(rows);
});

router.get('/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM requirements').get().c;
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM requirements GROUP BY status').all();
  const byPriority = db.prepare('SELECT priority, COUNT(*) as count FROM requirements GROUP BY priority').all();
  const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
  const moduleCount = db.prepare('SELECT COUNT(*) as c FROM modules').get().c;
  res.json({ total, byStatus, byPriority, projectCount, moduleCount });
});

router.post('/', requireRole('admin', 'manager'), (req, res) => {
  const { title, description, status, priority, tags, module_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const req_id = generateReqId();
  const result = db.prepare(`
    INSERT INTO requirements (req_id, title, description, status, priority, created_by, module_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req_id, title, description || '', status || 'draft', priority || 'medium', req.user.id, module_id || null);

  if (tags && tags.length > 0) {
    const insertTag = db.prepare('INSERT OR IGNORE INTO requirement_tags (requirement_id, tag_id) VALUES (?, ?)');
    tags.forEach(tagId => insertTag.run(Number(result.lastInsertRowid), tagId));
  }

  res.status(201).json(getFullRequirement(Number(result.lastInsertRowid)));
});

router.get('/:id', (req, res) => {
  const req_data = getFullRequirement(req.params.id);
  if (!req_data) return res.status(404).json({ error: 'Requirement not found' });
  res.json(req_data);
});

router.put('/:id', requireRole('admin', 'manager'), (req, res) => {
  const existing = db.prepare('SELECT * FROM requirements WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Requirement not found' });

  const title = req.body.title !== undefined ? req.body.title : existing.title;
  const description = req.body.description !== undefined ? req.body.description : existing.description;
  const status = req.body.status !== undefined ? req.body.status : existing.status;
  const priority = req.body.priority !== undefined ? req.body.priority : existing.priority;
  const module_id = req.body.module_id !== undefined ? (req.body.module_id || null) : existing.module_id;

  db.prepare(`
    UPDATE requirements
    SET title = ?, description = ?, status = ?, priority = ?, module_id = ?,
        updated_by = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(title, description, status, priority, module_id, req.user.id, req.params.id);

  res.json(getFullRequirement(req.params.id));
});

router.delete('/:id', requireRole('admin', 'manager'), (req, res) => {
  const info = db.prepare('DELETE FROM requirements WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Requirement not found' });
  res.status(204).end();
});

// Tags on a requirement
router.post('/:id/tags', requireRole('admin', 'manager'), (req, res) => {
  const { tag_id } = req.body;
  if (!tag_id) return res.status(400).json({ error: 'tag_id is required' });
  db.prepare('INSERT OR IGNORE INTO requirement_tags (requirement_id, tag_id) VALUES (?, ?)').run(req.params.id, tag_id);
  res.json(getFullRequirement(req.params.id));
});

router.delete('/:id/tags/:tagId', requireRole('admin', 'manager'), (req, res) => {
  db.prepare('DELETE FROM requirement_tags WHERE requirement_id = ? AND tag_id = ?').run(req.params.id, req.params.tagId);
  res.json(getFullRequirement(req.params.id));
});

// Traceability links
router.post('/:id/links', requireRole('admin', 'manager'), (req, res) => {
  const { target_id, link_type } = req.body;
  if (!target_id) return res.status(400).json({ error: 'target_id is required' });
  if (parseInt(target_id) === parseInt(req.params.id)) {
    return res.status(400).json({ error: 'Cannot link a requirement to itself' });
  }
  try {
    db.prepare(`
      INSERT INTO requirement_links (source_id, target_id, link_type) VALUES (?, ?, ?)
    `).run(req.params.id, target_id, link_type || 'related');
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Link already exists' });
    throw err;
  }
  res.json(getFullRequirement(req.params.id));
});

router.delete('/:id/links/:linkId', requireRole('admin', 'manager'), (req, res) => {
  db.prepare('DELETE FROM requirement_links WHERE id = ? AND source_id = ?').run(req.params.linkId, req.params.id);
  res.json(getFullRequirement(req.params.id));
});

// Tags CRUD
router.get('/meta/tags', (req, res) => {
  res.json(db.prepare('SELECT * FROM tags ORDER BY name').all());
});

router.post('/meta/tags', requireRole('admin', 'manager'), (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name, color || '#6366f1');
    res.status(201).json(db.prepare('SELECT * FROM tags WHERE id = ?').get(Number(result.lastInsertRowid)));
  } catch {
    res.status(409).json({ error: 'Tag name already exists' });
  }
});

router.delete('/meta/tags/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
