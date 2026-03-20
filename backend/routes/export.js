const express = require('express');
const {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  HeadingLevel, WidthType, AlignmentType, ShadingType, VerticalAlign,
} = require('docx');
const db = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const PRIMARY = '4F46E5';
const LIGHT_BG = 'F1F5F9';

const LINK_SHORT = { related: 'R', depends_on: 'D', parent: 'P', child: 'C' };
const LINK_FILL  = { related: 'DBEAFE', depends_on: 'FEF3C7', parent: 'EDE9FE', child: 'DCFCE7' };

function hCell(text, options = {}) {
  return new TableCell({
    shading: { fill: PRIMARY, type: ShadingType.SOLID, color: 'auto' },
    verticalAlign: VerticalAlign.CENTER,
    ...options,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: String(text ?? ''), bold: true, color: 'FFFFFF', size: 18 })],
    })],
  });
}

function dCell(text, center = false, bold = false) {
  return new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text ?? ''), bold, size: 18 })],
    })],
  });
}

function mCell(linkType) {
  const fill = linkType ? LINK_FILL[linkType] || 'FFFFFF' : 'FFFFFF';
  const label = linkType ? (LINK_SHORT[linkType] || linkType[0].toUpperCase()) : '';
  return new TableCell({
    shading: { fill, type: ShadingType.SOLID, color: 'auto' },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: label, bold: !!label, size: 16 })],
    })],
  });
}

function diagCell() {
  return new TableCell({
    shading: { fill: 'E2E8F0', type: ShadingType.SOLID, color: 'auto' },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '—', color: '94A3B8', size: 14 })],
    })],
  });
}

router.get('/:id/export', async (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const modules = db.prepare(
      'SELECT * FROM modules WHERE project_id = ? ORDER BY name'
    ).all(req.params.id);

    const requirements = db.prepare(`
      SELECT r.*, m.name AS module_name, u.username AS created_by_name
      FROM requirements r
      JOIN modules m ON m.id = r.module_id
      LEFT JOIN users u ON u.id = r.created_by
      WHERE m.project_id = ?
      ORDER BY m.name, r.req_id
    `).all(req.params.id);

    const links = db.prepare(`
      SELECT rl.link_type,
             r1.id AS source_id, r1.req_id AS source_req_id, r1.title AS source_title,
             r2.id AS target_id, r2.req_id AS target_req_id, r2.title AS target_title
      FROM requirement_links rl
      JOIN requirements r1 ON r1.id = rl.source_id
      JOIN modules m1 ON m1.id = r1.module_id
      JOIN requirements r2 ON r2.id = rl.target_id
      JOIN modules m2 ON m2.id = r2.module_id
      WHERE m1.project_id = ? AND m2.project_id = ?
      ORDER BY r1.req_id, r2.req_id
    `).all(req.params.id, req.params.id);

    // Build matrix lookup: map[srcId][tgtId] = link_type
    const matrixMap = {};
    links.forEach(l => {
      if (!matrixMap[l.source_id]) matrixMap[l.source_id] = {};
      matrixMap[l.source_id][l.target_id] = l.link_type;
    });

    // ── Requirements table ──────────────────────────────────────────────
    const reqRows = [
      new TableRow({
        tableHeader: true,
        children: [hCell('ID'), hCell('Module'), hCell('Title'), hCell('Status'), hCell('Priority'), hCell('Description')],
      }),
      ...requirements.map(r => new TableRow({
        children: [
          dCell(r.req_id, false, true),
          dCell(r.module_name || '—'),
          dCell(r.title),
          dCell(r.status, true),
          dCell(r.priority, true),
          dCell(r.description || ''),
        ],
      })),
    ];

    // ── Traceability links list ─────────────────────────────────────────
    const linkRows = [
      new TableRow({
        tableHeader: true,
        children: [hCell('Source ID'), hCell('Source Title'), hCell('Link Type'), hCell('Target ID'), hCell('Target Title')],
      }),
      ...links.map(l => new TableRow({
        children: [
          dCell(l.source_req_id, false, true),
          dCell(l.source_title),
          dCell(l.link_type.replace('_', ' '), true),
          dCell(l.target_req_id, false, true),
          dCell(l.target_title),
        ],
      })),
    ];

    // ── Traceability matrix ─────────────────────────────────────────────
    const matrixRows = [
      new TableRow({
        tableHeader: true,
        children: [
          hCell('Source \\ Target'),
          ...requirements.map(r => hCell(r.req_id)),
        ],
      }),
      ...requirements.map(src => new TableRow({
        children: [
          new TableCell({
            shading: { fill: LIGHT_BG, type: ShadingType.SOLID, color: 'auto' },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({
              children: [new TextRun({ text: src.req_id, bold: true, size: 16 })],
            })],
          }),
          ...requirements.map(tgt =>
            src.id === tgt.id
              ? diagCell()
              : mCell(matrixMap[src.id]?.[tgt.id] || null)
          ),
        ],
      })),
    ];

    // ── Build document ──────────────────────────────────────────────────
    const body = [
      new Paragraph({ text: project.name, heading: HeadingLevel.TITLE }),
      ...(project.description ? [new Paragraph({ text: project.description })] : []),
      new Paragraph({ text: '' }),
      new Paragraph({
        children: [new TextRun({
          text: `Modules: ${modules.length}  |  Requirements: ${requirements.length}  |  Links: ${links.length}`,
          color: '64748B', italics: true,
        })],
      }),
      new Paragraph({ text: '' }),

      new Paragraph({ text: 'Requirements', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: '' }),
      ...(requirements.length > 0
        ? [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: reqRows })]
        : [new Paragraph({ text: 'No requirements found in this project.' })]),
      new Paragraph({ text: '' }),

      new Paragraph({ text: 'Traceability Links', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: '' }),
      ...(links.length > 0
        ? [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: linkRows })]
        : [new Paragraph({ text: 'No traceability links defined within this project.' })]),
      new Paragraph({ text: '' }),

      new Paragraph({ text: 'Traceability Matrix', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        children: [new TextRun({
          text: 'Legend: R = Related  |  D = Depends On  |  P = Parent  |  C = Child',
          italics: true, color: '64748B',
        })],
      }),
      new Paragraph({ text: '' }),
      ...(requirements.length > 0
        ? [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: matrixRows })]
        : [new Paragraph({ text: 'No requirements found.' })]),
    ];

    const doc = new Document({
      creator: 'ReqPlan',
      title: project.name,
      description: `Requirements export for project: ${project.name}`,
      sections: [{ children: body }],
    });

    const buffer = await Packer.toBuffer(doc);
    const safeName = project.name.replace(/[^a-z0-9 \-_]/gi, '').trim().replace(/\s+/g, '_') || 'export';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.docx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Export failed: ' + err.message });
  }
});

module.exports = router;
