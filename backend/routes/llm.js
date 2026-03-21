const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const _pdfParse = require('pdf-parse');
const pdfParse = _pdfParse.default || _pdfParse;
const OpenAI = require('openai');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('admin', 'manager'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .docx and .pdf files are supported'));
    }
  },
});

const SYSTEM_PROMPT = `You are a requirements engineering assistant. Your job is to help extract, refine, and structure software requirements from documents.

When the user provides document content, analyse it and identify requirements. For each requirement, determine:
- title: a concise, clear requirement title (start with a verb when possible)
- description: the full requirement description with context
- priority: one of low/medium/high/critical (infer from document context; default to medium)
- status: always "draft" for newly extracted requirements

Engage conversationally to help the user understand and refine the extracted requirements. Answer questions about specific requirements, suggest improvements, and help resolve ambiguities.

When the user is satisfied and asks you to finalise, confirm import, or says something like "import these", "looks good", "confirm", or "proceed" — respond with a summary followed by a JSON block in this exact format:

\`\`\`json
[
  {"title": "...", "description": "...", "priority": "medium", "status": "draft"},
  ...
]
\`\`\`

Only include the JSON block when the user explicitly wants to import. Always validate that titles are non-empty before including a requirement.`;

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.LLM_API_KEY || 'no-key',
    baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
  });
}

function generateReqId() {
  const count = db.prepare('SELECT COUNT(*) as c FROM requirements').get().c;
  return `REQ-${String(count + 1).padStart(4, '0')}`;
}

// POST /api/llm/upload — parse a .docx or .pdf into plain text
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let text = '';
    const mime = req.file.mimetype;

    if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value;
    } else if (mime === 'application/pdf') {
      const result = await pdfParse(req.file.buffer);
      text = result.text;
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    if (!text || text.trim().length === 0) {
      return res.status(422).json({ error: 'Could not extract any text from the document' });
    }

    res.json({ text: text.trim(), filename: req.file.originalname });
  } catch (err) {
    console.error('LLM upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to parse document' });
  }
});

// POST /api/llm/chat — send a message to the LLM
router.post('/chat', express.json(), async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const client = getOpenAIClient();
    const model = process.env.LLM_MODEL || 'gpt-4o';

    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    });

    const reply = completion.choices[0]?.message?.content || '';

    // Check if the reply contains a JSON block with requirements
    let requirements = null;
    const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
          requirements = parsed.map(r => ({
            title: String(r.title || '').trim(),
            description: String(r.description || '').trim(),
            priority: ['low', 'medium', 'high', 'critical'].includes(r.priority) ? r.priority : 'medium',
            status: ['draft', 'active', 'approved', 'deprecated'].includes(r.status) ? r.status : 'draft',
          })).filter(r => r.title.length > 0);
        }
      } catch {
        // JSON parse failed — ignore and return raw reply
      }
    }

    res.json({ reply, requirements });
  } catch (err) {
    console.error('LLM chat error:', err);
    res.status(500).json({ error: err.message || 'LLM request failed' });
  }
});

// POST /api/llm/import — bulk insert requirements into a module
router.post('/import', express.json(), (req, res) => {
  try {
  const { module_id, requirements } = req.body;
  if (!module_id) return res.status(400).json({ error: 'module_id is required' });
  if (!Array.isArray(requirements) || requirements.length === 0) {
    return res.status(400).json({ error: 'requirements array is required' });
  }

  const module = db.prepare('SELECT id FROM modules WHERE id = ?').get(module_id);
  if (!module) return res.status(404).json({ error: 'Module not found' });

  const insert = db.prepare(`
    INSERT INTO requirements (req_id, title, description, status, priority, created_by, module_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const imported = [];
  db.exec('BEGIN');
  try {
    for (const r of requirements) {
      const title = String(r.title || '').trim();
      if (!title) continue;
      const req_id = generateReqId();
      const result = insert.run(
        req_id,
        title,
        String(r.description || '').trim(),
        ['draft', 'active', 'approved', 'deprecated'].includes(r.status) ? r.status : 'draft',
        ['low', 'medium', 'high', 'critical'].includes(r.priority) ? r.priority : 'medium',
        req.user.id,
        Number(module_id)
      );
      imported.push({ id: Number(result.lastInsertRowid), req_id, title });
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.status(201).json({ imported: imported.length, requirements: imported });
  } catch (err) {
    console.error('LLM import error:', err);
    res.status(500).json({ error: err.message || 'Import failed' });
  }
});

module.exports = router;
