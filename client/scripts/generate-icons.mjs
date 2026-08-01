// Generates the PWA app icons (public/pwa-192x192.png, public/pwa-512x512.png)
// from scratch so no binary assets need to live in the repo.
import { deflateSync } from "node:zlib";
import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

let crcTable;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makeIcon(size) {
  const bg = [15, 23, 42]; // slate-900
  const accent = [34, 197, 94]; // green-500
  const coin = [250, 250, 250];

  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.34;
  const innerR = size * 0.22;
  const barW = size * 0.1;

  let pos = 0;
  for (let y = 0; y < size; y++) {
    raw[pos++] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let [r, g, b] = bg;

      if (dist <= outerR && dist >= innerR) {
        [r, g, b] = accent;
      } else if (dist < innerR) {
        [r, g, b] = coin;
      }
      if (dist < innerR && Math.abs(dx) < barW * 0.18) {
        [r, g, b] = bg;
      }

      raw[pos++] = r;
      raw[pos++] = g;
      raw[pos++] = b;
      raw[pos++] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const outPath = path.join(publicDir, `pwa-${size}x${size}.png`);
  if (existsSync(outPath)) continue;
  writeFileSync(outPath, makeIcon(size));
  console.log(`generated ${outPath}`);
}
