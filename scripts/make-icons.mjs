// PWA 아이콘 생성 (의존성 없이 순수 PNG 인코딩)
// 보라 배경 + 흰 포도알 무늬. 필요할 때만 다시 실행하면 된다.
import { deflateSync } from "zlib";
import { writeFileSync } from "fs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** 포도송이 모양: 역삼각형으로 쌓인 알들 (GrapeBunch와 같은 배치) */
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const bg = [124, 58, 237]; // violet-600
  const berry = [255, 255, 255];
  const leaf = [163, 230, 53]; // lime-400

  // 3-2-1 배치 + 잎
  const r = size * 0.115;
  const cx = size / 2;
  const rows = [
    { count: 3, y: size * 0.47 },
    { count: 2, y: size * 0.65 },
    { count: 1, y: size * 0.82 },
  ];
  const berries = [];
  for (const row of rows) {
    const spread = r * 2.15;
    const start = cx - ((row.count - 1) * spread) / 2;
    for (let i = 0; i < row.count; i++) berries.push([start + i * spread, row.y]);
  }
  const leafCenter = [cx, size * 0.26];
  const leafR = size * 0.13;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color = bg;
      // 잎 (타원)
      const lx = (x - leafCenter[0]) / (leafR * 1.6);
      const ly = (y - leafCenter[1]) / (leafR * 0.7);
      if (lx * lx + ly * ly <= 1) color = leaf;
      for (const [bxc, byc] of berries) {
        const dx = x - bxc;
        const dy = y - byc;
        if (dx * dx + dy * dy <= r * r) color = berry;
      }
      const o = (y * size + x) * 4;
      px[o] = color[0];
      px[o + 1] = color[1];
      px[o + 2] = color[2];
      px[o + 3] = 255;
    }
  }

  // 스캔라인 필터 바이트(0) 삽입
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["public/apple-touch-icon.png", 180],
]) {
  writeFileSync(name, drawIcon(size));
  console.log(`${name} (${size}x${size})`);
}
