const express = require('express');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function getProjectWithModules(id) {
  const project = db.prepare(`
    SELECT p.*, u.username as created_by_name
    FROM projects p
    LEFT JOIN users u ON u.id = p.created_by
    WHERE p.id = ?
  `).get(id);
  if (!project) return null;
  project.modules = db.prepare(`
    SELECT m.*, u.username as created_by_name,
           COUNT(r.id) as req_count
    FROM modules m
    LEFT JOIN users u ON u.id = m.created_by
    LEFT JOIN requirements r ON r.module_id = m.id
    WHERE m.project_id = ?
    GROUP BY m.id
    ORDER BY m.created_at ASC
  `).all(id);
  return project;
}

// Projects CRUD
router.get('/', (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, u.username as created_by_name,
           COUNT(DISTINCT m.id) as module_count,
           COUNT(DISTINCT r.id) as req_count
    FROM projects p
    LEFT JOIN users u ON u.id = p.created_by
    LEFT JOIN modules m ON m.project_id = p.id
    LEFT JOIN requirements r ON r.module_id = m.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();
  res.json(projects);
});

router.post('/', requireRole('admin', 'manager'), (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = db.prepare(`
    INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)
  `).run(name, description || '', req.user.id);
  res.status(201).json(getProjectWithModules(Number(result.lastInsertRowid)));
});

router.get('/:id', (req, res) => {
  const project = getProjectWithModules(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

router.put('/:id', requireRole('admin', 'manager'), (req, res) => {
  const { name, description } = req.body;
  const info = db.prepare(`
    UPDATE projects
    SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = datetime('now')
    WHERE id = ?
  `).run(name, description, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Project not found' });
  res.json(getProjectWithModules(req.params.id));
});

router.delete('/:id', requireRole('admin', 'manager'), (req, res) => {
  const info = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Project not found' });
  res.status(204).end();
});

// Modules under a project
router.post('/:id/modules', requireRole('admin', 'manager'), (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const result = db.prepare(`
    INSERT INTO modules (project_id, name, description, created_by) VALUES (?, ?, ?, ?)
  `).run(req.params.id, name, description || '', req.user.id);
  res.status(201).json(db.prepare('SELECT * FROM modules WHERE id = ?').get(Number(result.lastInsertRowid)));
});

module.exports = router;
