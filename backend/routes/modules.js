const express = require('express');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// List all modules (used for dropdowns in the UI)
router.get('/', (req, res) => {
  const modules = db.prepare(`
    SELECT m.*, p.name as project_name
    FROM modules m
    JOIN projects p ON p.id = m.project_id
    ORDER BY p.name ASC, m.name ASC
  `).all();
  res.json(modules);
});

router.get('/:id', (req, res) => {
  const mod = db.prepare(`
    SELECT m.*, p.name as project_name, p.id as project_id, u.username as created_by_name
    FROM modules m
    JOIN projects p ON p.id = m.project_id
    LEFT JOIN users u ON u.id = m.created_by
    WHERE m.id = ?
  `).get(req.params.id);
  if (!mod) return res.status(404).json({ error: 'Module not found' });
  res.json(mod);
});

router.put('/:id', requireRole('admin', 'manager'), (req, res) => {
  const { name, description } = req.body;
  const info = db.prepare(`
    UPDATE modules
    SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = datetime('now')
    WHERE id = ?
  `).run(name, description, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Module not found' });
  const mod = db.prepare(`
    SELECT m.*, p.name as project_name, p.id as project_id
    FROM modules m JOIN projects p ON p.id = m.project_id
    WHERE m.id = ?
  `).get(req.params.id);
  res.json(mod);
});

router.delete('/:id', requireRole('admin', 'manager'), (req, res) => {
  const info = db.prepare('DELETE FROM modules WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Module not found' });
  res.status(204).end();
});

module.exports = router;
