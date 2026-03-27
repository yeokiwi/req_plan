const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const uploadsDir = path.join(__dirname, '../data/uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomUUID() + ext);
  },
});

const allowedMimes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/ogg',
];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Accepted: images (jpeg, png, gif, webp, svg) and videos (mp4, webm, ogg).'));
    }
  },
});

router.use(authenticate);

// List wiki pages with optional filters
router.get('/', (req, res) => {
  const { module_id, project_id, parent_page_id } = req.query;
  let sql = 'SELECT id, title, module_id, project_id, parent_page_id, slug, created_by, updated_by, created_at, updated_at FROM wiki_pages WHERE 1=1';
  const params = [];

  if (module_id) { sql += ' AND module_id = ?'; params.push(module_id); }
  if (project_id) { sql += ' AND project_id = ?'; params.push(project_id); }
  if (parent_page_id !== undefined) {
    if (parent_page_id === 'null' || parent_page_id === '') {
      sql += ' AND parent_page_id IS NULL';
    } else {
      sql += ' AND parent_page_id = ?'; params.push(parent_page_id);
    }
  }

  sql += ' ORDER BY title ASC';
  const pages = db.prepare(sql).all(...params);
  res.json(pages);
});

// Get page tree for a project (standalone pages only, no module pages)
router.get('/tree/:projectId', (req, res) => {
  const pages = db.prepare(
    'SELECT id, title, parent_page_id, slug, created_at, updated_at FROM wiki_pages WHERE project_id = ? AND module_id IS NULL ORDER BY title ASC'
  ).all(req.params.projectId);
  res.json(pages);
});

// Get or create wiki page for a specific module
router.get('/by-module/:moduleId', (req, res) => {
  const moduleId = req.params.moduleId;
  const mod = db.prepare('SELECT id, name, project_id FROM modules WHERE id = ?').get(moduleId);
  if (!mod) return res.status(404).json({ error: 'Module not found' });

  let page = db.prepare('SELECT * FROM wiki_pages WHERE module_id = ?').get(moduleId);
  if (!page) {
    // Auto-create wiki page for this module
    const slug = mod.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    db.prepare(
      'INSERT INTO wiki_pages (title, content, module_id, project_id, slug, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(mod.name, '{}', moduleId, mod.project_id, slug, req.user.id);
    page = db.prepare('SELECT * FROM wiki_pages WHERE module_id = ?').get(moduleId);
  }
  res.json(page);
});

// Upload image or video file
router.post('/upload', requireRole('admin', 'manager'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/api/wiki-pages/uploads/${req.file.filename}` });
});

// Serve uploaded files
router.get('/uploads/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

// Get single page
router.get('/:id', (req, res) => {
  const page = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(req.params.id);
  if (!page) return res.status(404).json({ error: 'Page not found' });
  res.json(page);
});

// Create page
router.post('/', requireRole('admin', 'manager'), (req, res) => {
  const { title, content, module_id, project_id, parent_page_id } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const result = db.prepare(
    'INSERT INTO wiki_pages (title, content, module_id, project_id, parent_page_id, slug, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(title, content || '{}', module_id || null, project_id || null, parent_page_id || null, slug, req.user.id);

  const page = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(page);
});

// Update page
router.put('/:id', requireRole('admin', 'manager'), (req, res) => {
  const { title, content } = req.body;
  const page = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(req.params.id);
  if (!page) return res.status(404).json({ error: 'Page not found' });

  const newTitle = title !== undefined ? title : page.title;
  const newContent = content !== undefined ? content : page.content;
  const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  db.prepare(
    "UPDATE wiki_pages SET title = ?, content = ?, slug = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(newTitle, newContent, slug, req.user.id, req.params.id);

  const updated = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete page
router.delete('/:id', requireRole('admin', 'manager'), (req, res) => {
  const page = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(req.params.id);
  if (!page) return res.status(404).json({ error: 'Page not found' });

  db.prepare('DELETE FROM wiki_pages WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
