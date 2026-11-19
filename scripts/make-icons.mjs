// Иконки PWA из собственного логотипа AI High School (тот же рисунок, что apps/web/public/icon.svg
// и LogoMark в apps/web/src/app/brand.tsx). Без зависимостей: свой растеризатор с суперсэмплингом
// и PNG через node:zlib. Запуск: `node scripts/make-icons.mjs` — перезаписывает PNG в apps/web/public.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "web", "public");
const PRIMARY = [0x41, 0x43, 0xc7];
const WHITE = [0xfc, 0xfc, 0xfc];
const SS = 4; // суперсэмплинг SS×SS на пиксель

// ── геометрия в координатах viewBox 0..32 ──
const cubic = (p0, p1, p2, p3, n = 24) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [0, 1].map(
      (k) => u ** 3 * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t ** 3 * p3[k],
    );
  });
const book = [
  ...cubic([8, 10.5], [10.6, 9.3], [13.3, 9.3], [16, 10.5]),
  ...cubic([16, 10.5], [18.7, 9.3], [21.4, 9.3], [24, 10.5]),
  [24, 22],
  ...cubic([24, 22], [21.4, 20.8], [18.7, 20.8], [16, 22]),
  ...cubic([16, 22], [13.3, 20.8], [10.6, 20.8], [8, 22]),
  [8, 10.5],
];
const segs = (pts) => pts.slice(1).map((p, i) => [pts[i], p]);
const thick = [
  ...segs(book),
  [
    [16, 10.5],
    [16, 22],
  ],
]; // ширина 1.6
const thin = segs([
  [11.5, 14],
  [16, 16.2],
  [20.5, 14],
]).concat(
  segs([
    [11.5, 18.5],
    [16, 16.2],
    [20.5, 18.5],
  ]),
); // ширина 1, прозрачность 0.8
const dots = [
  [11.5, 14],
  [20.5, 14],
  [11.5, 18.5],
  [20.5, 18.5],
]; // r 1.4

const distToSeg = (x, y, [[ax, ay], [bx, by]]) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
};
const inRoundRect = (x, y, r) => {
  const cx = Math.min(Math.max(x, r), 32 - r);
  const cy = Math.min(Math.max(y, r), 32 - r);
  return x >= 0 && x <= 32 && y >= 0 && y <= 32 && Math.hypot(x - cx, y - cy) <= r;
};

/** RGBA-пиксели иконки `size`×`size`. `pad` — доля отступа; `square` — фон на весь квадрат. */
function render(size, { pad = 0, square = false } = {}) {
  const px = new Uint8Array(size * size * 4);
  const scale = 32 / (size * (1 - 2 * pad));
  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let bg = 0;
      let white = 0;
      let soft = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (pxi + (sx + 0.5) / SS - size * pad) * scale;
          const y = (py + (sy + 0.5) / SS - size * pad) * scale;
          if (square || inRoundRect(x, y, 9)) bg++;
          if (
            thick.some((s) => distToSeg(x, y, s) <= 0.8) ||
            dots.some(([cx, cy]) => Math.hypot(x - cx, y - cy) <= 1.4)
          )
            white++;
          else if (thin.some((s) => distToSeg(x, y, s) <= 0.5)) soft++;
        }
      }
      const n = SS * SS;
      // «over» с прямой альфой: фон, затем белые линии, затем полупрозрачные.
      let a = 0;
      let rgb = [0, 0, 0];
      const over = (c, alpha) => {
        const outA = alpha + a * (1 - alpha);
        if (outA > 0) rgb = rgb.map((v, i) => (c[i] * alpha + v * a * (1 - alpha)) / outA);
        a = outA;
      };
      over(PRIMARY, bg / n);
      over(WHITE, white / n);
      over(WHITE, (soft / n) * 0.8);
      const o = (py * size + pxi) * 4;
      px.set([...rgb.map(Math.round), Math.round(a * 255)], o);
    }
  }
  return px;
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // фильтр None
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8 бит, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const icons = {
  "pwa-192x192.png": [192, {}],
  "pwa-512x512.png": [512, {}],
  // Маскируемая: фон на весь квадрат, логотип в безопасной зоне (80%).
  "maskable-icon-512x512.png": [512, { pad: 0.1, square: true }],
  // iOS скругляет углы сам: квадратный фон и небольшой отступ.
  "apple-touch-icon-180x180.png": [180, { pad: 0.08, square: true }],
};
for (const [name, [size, opts]] of Object.entries(icons)) {
  writeFileSync(join(OUT, name), png(size, render(size, opts)));
  console.log(`${name} — ${size}×${size}`);
}
