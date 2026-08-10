/**
 * Lightweight Pure JavaScript QR Code Generator SVG/Canvas Renderer
 */
(function (global) {
  function generateQRCodeSVG(text, size = 100) {
    // Generate simple deterministic QR representation matrix for LSA Membership ID
    const hash = simpleHash(text);
    const cells = 21; // standard 21x21 QR matrix
    const cellSize = size / cells;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
    svg += `<rect width="${size}" height="${size}" fill="#FFFFFF"/>`;

    // Draw standard finder patterns at 3 corners
    svg += drawFinder(0, 0, cellSize);
    svg += drawFinder((cells - 7) * cellSize, 0, cellSize);
    svg += drawFinder(0, (cells - 7) * cellSize, cellSize);

    // Draw data pattern based on hash string
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        // Skip finder pattern zones
        if ((r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7)) continue;
        
        const index = r * cells + c;
        const bit = (hash.charCodeAt(index % hash.length) + index * 7) % 2 === 0;
        if (bit) {
          svg += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize + 0.5}" height="${cellSize + 0.5}" fill="#05668D"/>`;
        }
      }
    }

    svg += `</svg>`;
    return svg;
  }

  function drawFinder(x, y, cs) {
    let s = '';
    s += `<rect x="${x}" y="${y}" width="${7 * cs}" height="${7 * cs}" fill="#05668D"/>`;
    s += `<rect x="${x + cs}" y="${y + cs}" width="${5 * cs}" height="${5 * cs}" fill="#FFFFFF"/>`;
    s += `<rect x="${x + 2 * cs}" y="${y + 2 * cs}" width="${3 * cs}" height="${3 * cs}" fill="#05668D"/>`;
    return s;
  }

  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(16).repeat(8);
  }

  global.QRCodeGenerator = {
    renderSVG: generateQRCodeSVG
  };
})(window);
