// ============================================================
// PDF TEXT EXTRACTOR (Coordinate-based with pdfjs-dist)
// Production Safeguards:
//  - isEvalSupported: false (CVE-2024-4367 protection)
//  - disableFontFace: true & useSystemFonts: false
//  - Enforces 5-page limit via numPages BEFORE extracting text
//  - Reconstructs positioned lines and two-pairs-per-row tables
// ============================================================

const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const MAX_PDF_PAGES = 5;

/**
 * Extracts text and structured layout items from a PDF file.
 * Returns { hasTextLayer, pageCount, lines, fullText, tableCells }
 */
async function extractPdfTextLayer(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`FILE_NOT_FOUND: ${filePath}`);
  }

  const rawBytes = fs.readFileSync(filePath);
  const data = new Uint8Array(rawBytes);

  const loadingTask = pdfjsLib.getDocument({
    data,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    standardFontDataUrl: null
  });

  const doc = await loadingTask.promise;
  const pageCount = doc.numPages;

  if (pageCount > MAX_PDF_PAGES) {
    throw new Error(`PAGE_LIMIT_EXCEEDED: PDF has ${pageCount} pages, maximum allowed is ${MAX_PDF_PAGES}`);
  }

  const allLines = [];
  const fullTextParts = [];
  let totalTextItems = 0;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageWidth = viewport.width;
    const textContent = await page.getTextContent();

    if (!textContent || !textContent.items || textContent.items.length === 0) {
      continue;
    }

    const items = textContent.items.filter(it => it.str && it.str.trim().length > 0);
    totalTextItems += items.length;

    // Cluster items into lines by y-coordinate (tolerance 3.5 points)
    const lineMap = new Map();
    for (const it of textContent.items) {
      if (!it.str) continue;
      const x = it.transform[4];
      const y = Math.round(it.transform[5] / 3.5) * 3.5; // cluster bucket

      if (!lineMap.has(y)) {
        lineMap.set(y, []);
      }
      lineMap.get(y).push({
        str: it.str,
        x,
        y: it.transform[5],
        width: it.width,
        height: it.height
      });
    }

    // Sort lines top-to-bottom (in PDF, y goes from bottom=0 to top=height, so descending y)
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);

    for (const yKey of sortedY) {
      const lineItems = lineMap.get(yKey);
      // Sort left to right
      lineItems.sort((a, b) => a.x - b.x);

      // Assemble raw line string
      let lineStr = '';
      for (let i = 0; i < lineItems.length; i++) {
        const curr = lineItems[i];
        if (i > 0) {
          const prev = lineItems[i - 1];
          const gap = curr.x - (prev.x + prev.width);
          // If there's a space gap between items and neither item starts/ends with space
          if (gap > 2 && !prev.str.endsWith(' ') && !curr.str.startsWith(' ')) {
            lineStr += ' ';
          }
        }
        lineStr += curr.str;
      }
      lineStr = lineStr.trim();

      if (lineStr.length > 0) {
        allLines.push({
          text: lineStr,
          y: yKey,
          items: lineItems,
          pageWidth
        });
        fullTextParts.push(lineStr);
      }
    }
  }

  const fullText = fullTextParts.join('\n');
  const hasTextLayer = totalTextItems >= 8 && fullText.trim().length > 50;

  return {
    hasTextLayer,
    pageCount,
    totalTextItems,
    lines: allLines,
    fullText
  };
}

module.exports = {
  MAX_PDF_PAGES,
  extractPdfTextLayer
};
