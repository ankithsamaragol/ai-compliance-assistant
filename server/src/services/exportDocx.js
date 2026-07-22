const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
} = require('docx');

// Minimal markdown -> docx converter. Handles the subset our generated
// documents actually use: headings, paragraphs, bullet lists, bold/italic,
// blockquotes, and pipe tables. Not a general-purpose markdown parser.

function parseInline(text, { forceBold = false } = {}) {
  const runs = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), bold: forceBold }));
    if (m[1] !== undefined) runs.push(new TextRun({ text: m[1], bold: true }));
    else runs.push(new TextRun({ text: m[2], italics: true, bold: forceBold }));
    last = re.lastIndex;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), bold: forceBold }));
  return runs.length ? runs : [new TextRun({ text, bold: forceBold })];
}

function isTableRow(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isTableSeparator(line) {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
}

function buildTable(lines) {
  const rows = lines
    .filter((l) => !isTableSeparator(l))
    .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((cells, rowIdx) => new TableRow({
      children: cells.map((cell) => new TableCell({
        width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
          left: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
          right: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
        },
        children: [new Paragraph({
          children: parseInline(cell, { forceBold: rowIdx === 0 }),
        })],
      })),
    })),
  });
}

function markdownToDocxChildren(markdown) {
  const lines = markdown.split('\n');
  const children = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') { i++; continue; }

    if (isTableRow(line)) {
      const tableLines = [];
      while (i < lines.length && isTableRow(lines[i])) { tableLines.push(lines[i]); i++; }
      children.push(buildTable(tableLines));
      children.push(new Paragraph({ text: '' }));
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingLevel = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][level - 1];
      children.push(new Paragraph({ heading: headingLevel, children: parseInline(headingMatch[2]) }));
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteText = line.replace(/^>\s?/, '');
      children.push(new Paragraph({
        children: [new TextRun({ text: quoteText, italics: true })],
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: '999999', space: 8 } },
      }));
      i++;
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (bulletMatch) {
      children.push(new Paragraph({ text: '', bullet: { level: 0 }, children: parseInline(bulletMatch[1]) }));
      i++;
      continue;
    }

    const numberedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (numberedMatch) {
      children.push(new Paragraph({ children: parseInline(numberedMatch[1]), numbering: { reference: 'doc-numbering', level: 0 } }));
      i++;
      continue;
    }

    children.push(new Paragraph({ children: parseInline(line) }));
    i++;
  }

  return children;
}

async function exportToDocx({ title, contentMd }) {
  const doc = new Document({
    numbering: {
      config: [{ reference: 'doc-numbering', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: 'left' }] }],
    },
    sections: [{
      properties: {},
      children: markdownToDocxChildren(contentMd),
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { exportToDocx };
