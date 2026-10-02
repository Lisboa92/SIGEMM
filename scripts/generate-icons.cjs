const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// 1. Create SVG Icon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064e3b" />
      <stop offset="50%" stop-color="#065f46" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Background Shield -->
  <rect width="512" height="512" rx="96" fill="url(#bgGrad)" />

  <!-- Outer Ring Accent -->
  <rect x="24" y="24" width="464" height="464" rx="80" fill="none" stroke="url(#goldGrad)" stroke-width="8" opacity="0.85" />

  <!-- Shield Shape -->
  <path d="M 256 80 L 384 136 C 384 272 256 384 256 424 C 256 384 128 272 128 136 Z" 
        fill="#044d37" stroke="url(#goldGrad)" stroke-width="10" filter="url(#shadow)" />

  <!-- Scale of Justice / Municipal Emblem -->
  <!-- Central Beam -->
  <rect x="248" y="140" width="16" height="210" rx="6" fill="url(#goldGrad)" />
  <!-- Base Stand -->
  <path d="M 200 360 L 312 360 L 292 340 L 220 340 Z" fill="url(#goldGrad)" />
  <!-- Horizontal Balance Bar -->
  <rect x="176" y="176" width="160" height="12" rx="4" fill="url(#goldGrad)" />
  <circle cx="256" cy="182" r="14" fill="#fbbf24" />

  <!-- Left Scale Pan -->
  <line x1="184" y1="188" x2="160" y2="236" stroke="#fbbf24" stroke-width="4" />
  <line x1="184" y1="188" x2="208" y2="236" stroke="#fbbf24" stroke-width="4" />
  <path d="M 152 236 Q 184 256 216 236 Z" fill="#fbbf24" />

  <!-- Right Scale Pan -->
  <line x1="328" y1="188" x2="304" y2="236" stroke="#fbbf24" stroke-width="4" />
  <line x1="328" y1="188" x2="352" y2="236" stroke="#fbbf24" stroke-width="4" />
  <path d="M 296 236 Q 328 256 360 236 Z" fill="#fbbf24" />

  <!-- Top Star -->
  <path d="M 256 100 L 263 118 L 282 118 L 267 129 L 273 147 L 256 136 L 239 147 L 245 129 L 230 118 L 249 118 Z" fill="#fbbf24" />

  <!-- Label SIGEMM -->
  <text x="256" y="468" text-anchor="middle" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="44" fill="#ffffff" letter-spacing="4">SIGEMM</text>
</svg>`;

const publicDir = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon.trim());

// Helper function to generate clean RGBA PNG using node zlib
function generatePng(width, height, isMaskable = false) {
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const safeRadius = isMaskable ? width * 0.40 : width * 0.46;
  const cornerRadius = isMaskable ? 0 : width * 0.18;

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    rawData[rowStart] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pxStart = rowStart + 1 + x * 4;

      // Base background color: Deep Emerald
      let r = 6;
      let g = 95;
      let b = 70;
      let a = 255;

      // Subtle gradient from top-left to bottom-right
      const diag = (x + y) / (width + height);
      r = Math.floor(4 + (10 - 4) * diag);
      g = Math.floor(78 + (120 - 78) * diag);
      b = Math.floor(55 + (87 - 55) * diag);

      if (!isMaskable) {
        // Rounded corners
        const dx = Math.max(0, Math.max(cornerRadius - x, x - (width - cornerRadius)));
        const dy = Math.max(0, Math.max(cornerRadius - y, y - (height - cornerRadius)));
        const cornerDist = Math.sqrt(dx * dx + dy * dy);
        if (cornerDist > cornerRadius) {
          a = 0;
        }
      }

      // Draw emblem in the center
      const distFromCenter = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      
      // Gold Ring
      const ringR = width * 0.36;
      const ringThickness = Math.max(2, width * 0.02);
      if (Math.abs(distFromCenter - ringR) <= ringThickness && a > 0) {
        r = 245;
        g = 158;
        b = 11;
      }

      // Inner Star or Shield badge
      if (distFromCenter < width * 0.28 && a > 0) {
        // Inner badge fill
        r = Math.floor(r * 0.85);
        g = Math.floor(g * 0.85);
        b = Math.floor(b * 0.85);
      }

      // Central gold balance scale
      // Vertical beam: x within width*0.015 of cx, y between cy - width*0.18 and cy + width*0.14
      const beamHalfW = Math.max(2, width * 0.018);
      if (Math.abs(x - cx) <= beamHalfW && y >= cy - width * 0.16 && y <= cy + width * 0.16 && a > 0) {
        r = 251;
        g = 191;
        b = 36;
      }

      // Horizontal beam
      const hBarY = cy - width * 0.06;
      const hBarHalfW = width * 0.16;
      if (Math.abs(x - cx) <= hBarHalfW && Math.abs(y - hBarY) <= beamHalfW && a > 0) {
        r = 251;
        g = 191;
        b = 36;
      }

      // Center pivot circle
      if (distFromCenter <= width * 0.04 && a > 0) {
        r = 254;
        g = 240;
        b = 138;
      }

      // Left pan
      const leftPanX = cx - hBarHalfW;
      const panY = cy + width * 0.06;
      if (Math.abs(x - leftPanX) <= width * 0.05 && Math.abs(y - panY) <= Math.max(2, width * 0.012) && a > 0) {
        r = 251;
        g = 191;
        b = 36;
      }

      // Right pan
      const rightPanX = cx + hBarHalfW;
      if (Math.abs(x - rightPanX) <= width * 0.05 && Math.abs(y - panY) <= Math.max(2, width * 0.012) && a > 0) {
        r = 251;
        g = 191;
        b = 36;
      }

      // Base stand
      const baseY = cy + width * 0.16;
      if (Math.abs(x - cx) <= width * 0.10 && Math.abs(y - baseY) <= Math.max(2, width * 0.016) && a > 0) {
        r = 251;
        g = 191;
        b = 36;
      }

      rawData[pxStart] = r;
      rawData[pxStart + 1] = g;
      rawData[pxStart + 2] = b;
      rawData[pxStart + 3] = a;
    }
  }

  function crc32(buf) {
    let table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idatData = zlib.deflateSync(rawData);
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// Generate Icons
console.log('Generating PWA icons...');
const png192 = generatePng(192, 192, false);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);

const png512 = generatePng(512, 512, false);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);

const maskable512 = generatePng(512, 512, true);
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), maskable512);

const appleIcon = generatePng(180, 180, false);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);

console.log('Icons generated successfully in /public!');
