const fs = require('fs/promises');
const path = require('path');

const PLAIN_TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.log', '.json']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

function isImageFile(originalName) {
  return IMAGE_EXTENSIONS.has(path.extname(originalName).toLowerCase());
}

async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (PLAIN_TEXT_EXTENSIONS.has(ext)) {
    const text = await fs.readFile(filePath, 'utf8');
    return { supported: true, text };
  }

  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    const buffer = await fs.readFile(filePath);
    const { text } = await pdfParse(buffer);
    return { supported: true, text };
  }

  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const { value: text } = await mammoth.extractRawText({ path: filePath });
    return { supported: true, text };
  }

  return {
    supported: false,
    reason: `File type "${ext || 'unknown'}" isn't AI-readable yet — supported types are PDF, DOCX, TXT, MD, CSV, LOG, JSON. The file is still stored and visible in your evidence list.`,
  };
}

module.exports = { extractText, isImageFile };
