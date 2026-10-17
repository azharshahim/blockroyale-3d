import zlib from 'node:zlib';
import fs from 'node:fs';

// Minimal dependency-free PNG writer
const CRC_T = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function writePng(path, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.mkdirSync(path.replace(/\/[^/]+$/, ''), { recursive: true });
  fs.writeFileSync(path, png);
  console.log('->', path, w + 'x' + h, png.length, 'bytes');
}

function pixel(u, v) {
  // Dark indigo background with radial glow (brand: #0f172a -> #4338ca)
  const d = Math.hypot(u - 0.5, v - 0.5);
  const glow = Math.max(0, 1 - d * 1.75);
  let r = 9 + 58 * glow;
  let g = 17 + 46 * glow;
  let b = 38 + 120 * glow;

  // Voxel grass block (kept inside the 80% maskable safe zone)
  if (u > 0.19 && u < 0.81 && v > 0.28 && v < 0.82) {
    if (v < 0.40) {
      r = 76; g = 175; b = 80;
    } else if (v < 0.455) {
      r = 58; g = 142; b = 66;
    } else {
      r = 124; g = 79; b = 40;
    }
    const px = Math.floor(u * 24);
    const py = Math.floor(v * 24);
    const n = ((px * 7 + py * 13) % 5) - 2;
    r += n * 7;
    g += n * 7;
    b += n * 7;
    // diamond sparkle inside the block
    if (u > 0.585 && u < 0.69 && v > 0.60 && v < 0.705) {
      const cx = Math.abs(u - 0.637) * 24;
      const cy = Math.abs(v - 0.652) * 24;
      if (cx + cy < 1.1) { r = 56; g = 235; b = 245; }
    }
  }
  // subtle outer frame
  if (u < 0.035 || u > 0.965 || v < 0.035 || v > 0.965) {
    r *= 0.55; g *= 0.55; b *= 0.7;
  }
  return [Math.max(0, Math.min(255, r | 0)), Math.max(0, Math.min(255, g | 0)), Math.max(0, Math.min(255, b | 0)), 255];
}

function make(size, out) {
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = pixel((x + 0.5) / size, (y + 0.5) / size);
      const i = (y * size + x) * 4;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
      buf[i + 3] = c[3];
    }
  }
  writePng(out, size, size, buf);
}

make(192, 'public/icon-192.png');
make(512, 'public/icon-512.png');
make(180, 'public/apple-touch-icon.png');
make(32, 'public/favicon.png');
