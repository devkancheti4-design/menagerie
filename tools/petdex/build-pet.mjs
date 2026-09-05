/* Build a Petdex pet package from a Menagerie animal.
   The sprite data, palettes, poses and moves are read straight out of
   index.html, so the pet is pixel-identical to the one in the app. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";

const APP = process.argv[2] || "/Users/kanchetidevieswar/menagerie/index.html";
const SPECIES_ID = process.argv[3] || "dragon";
const OUT_DIR = process.argv[4] || "./out";

/* ---- 1. lift sections 1-3 (sprites, drawing, animator) out of the page ---- */
const html = readFileSync(APP, "utf8");
const from = html.indexOf("const SPECIES = {");
const to = html.indexOf("/* --- the noises they make");
if (from < 0 || to < 0 || to < from) throw new Error("could not locate the sprite/animator sections");
const source = html.slice(from, to);

const sandbox = { window: { devicePixelRatio: 1 }, document: { createElement: () => ({ getContext: () => null }) } };
const load = new Function("window", "document", source + `
  return { SPECIES, PROPS, PROP_PAL, PROP_ORDER, GLYPHS, MOVES,
           paintMember, drawGlyph, frameFor, paletteFor, stamp };`);
const M = load(sandbox.window, sandbox.document);

/* ---- 2. a canvas context just big enough for solid rectangles ---- */
const FRAME_W = 192, FRAME_H = 208, COLS = 8, ROWS = 9;
const BOTTOM_PAD = 4;       // pixels of floor under the feet

function parseColor(css){
  if (css[0] === "#"){
    const h = css.slice(1);
    const n = h.length === 3
      ? [...h].map(c => parseInt(c + c, 16))
      : [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
    return n;
  }
  const m = css.match(/hsl\(\s*([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/);
  if (!m) throw new Error("unparsed colour: " + css);
  let [h, s, l] = [parseFloat(m[1]) / 360, parseFloat(m[2]) / 100, parseFloat(m[3]) / 100];
  if (s === 0){ const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const hue = t => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [hue(h + 1/3), hue(h), hue(h - 1/3)].map(v => Math.round(v * 255));
}

function makeCtx(w, h){
  const px = new Uint8ClampedArray(w * h * 4);
  return {
    px, w, h, fillStyle: "#000", globalAlpha: 1, tx: 0, ty: 0,
    fillRect(rx, ry, rw, rh){
      const x = rx + this.tx, y = ry + this.ty;
      const [r, g, b] = parseColor(this.fillStyle);
      const a = this.globalAlpha;
      const x0 = Math.round(x), y0 = Math.round(y);
      const x1 = Math.round(x + rw), y1 = Math.round(y + rh);
      for (let yy = Math.max(0, y0); yy < Math.min(h, y1); yy++){
        for (let xx = Math.max(0, x0); xx < Math.min(w, x1); xx++){
          const i = (yy * w + xx) * 4;
          if (a >= 1){ px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = 255; }
          else {
            const dst = px[i+3] / 255, out = a + dst * (1 - a);
            px[i]   = (r * a + px[i]   * dst * (1 - a)) / out;
            px[i+1] = (g * a + px[i+1] * dst * (1 - a)) / out;
            px[i+2] = (b * a + px[i+2] * dst * (1 - a)) / out;
            px[i+3] = Math.round(out * 255);
          }
        }
      }
    },
    clearRect(){}, drawImage(){}, setTransform(){}, translate(){}
  };
}

/* ---- 3. the two states Menagerie has no equivalent for ---- */
const R = Math.round, S = Math.sin, PI = Math.PI;
function runPose(u, dir){
  const bob = Math.abs(S(u * PI * 2));
  return { hy: -R(bob * 2), by: -R(bob), shear: dir * 2, hx: dir + R(S(u * PI * 2)) * dir };
}
const JUMP = [                       // anticipation, lift, peak, descent, settle
  { hy: 1, by: 1 }, { hy: -2, by: -2 }, { hy: -5, by: -5, shear: 1 },
  { hy: -2, by: -2 }, { hy: 1, by: 0 }
];

/* ---- 4. the nine rows Petdex expects ---- */
const STATES = [
  { id:"idle",          frames:6, ms:1100, laptop:true  },
  { id:"running-right", frames:8, ms:1060, laptop:false },
  { id:"running-left",  frames:8, ms:1060, laptop:false },
  { id:"waving",        frames:4, ms:700,  laptop:false },
  { id:"jumping",       frames:5, ms:840,  laptop:false },
  { id:"failed",        frames:8, ms:1220, laptop:false },
  { id:"waiting",       frames:6, ms:1010, laptop:true  },
  { id:"running",       frames:6, ms:820,  laptop:false },
  { id:"review",        frames:6, ms:1030, laptop:true  }
];

function frameContent(stateId, i, n, sp){
  switch (stateId){
    case "idle":          return M.frameFor("idle",  (i / n) * 1.1, sp);
    case "review":        return M.frameFor("work",  (i / n) * 1.03, sp);
    case "failed":        return M.frameFor("fight", (i / n) * 1.22, sp);
    case "waiting":       return M.frameFor("sleep", (i / n) * (1 / 0.42), sp);
    case "waving":        return M.frameFor(sp.move, ((i + 0.5) / n) * M.MOVES[sp.move].d, sp);
    case "jumping":       return { pose: JUMP[i] || {}, marks: i === 2 ? [{ g:"star", x:13, y:-2, a:0.8 }] : [] };
    case "running-right": return { pose: runPose(i / n,  1), marks:[{ g:"dash", x:-1, y:6, a:0.6 }, { g:"dash", x:-2, y:9, a:0.4 }] };
    case "running-left":  return { pose: runPose(i / n, -1), marks:[{ g:"dash", x:17, y:6, a:0.6 }, { g:"dash", x:18, y:9, a:0.4 }] };
    case "running":       return { pose: runPose(i / n,  0), marks:[] };
    default:              return M.frameFor("idle", 0, sp);
  }
}

/* ---- 5. render the sheet ---- */
const sp = M.SPECIES[SPECIES_ID];
if (!sp) throw new Error("unknown species: " + SPECIES_ID);
const sheetW = FRAME_W * COLS, sheetH = FRAME_H * ROWS;

/* Glyphs are positioned for the app's roomier 22-cell field. Nudge any that
   would hang off a 192x208 frame back inside, rather than slicing them. */
function placeGlyph(ctx, name, scale, x, y, alpha, frameX, frameY){
  const g = M.GLYPHS[name];
  if (!g) return;
  const w = g.px[0].length * scale, h = g.px.length * scale;
  const left = Math.min(Math.max(x * scale + ctx.tx, frameX), frameX + FRAME_W - w);
  const top  = Math.min(Math.max(y * scale + ctx.ty, frameY), frameY + FRAME_H - h);
  M.drawGlyph(ctx, name, scale, (left - ctx.tx) / scale, (top - ctx.ty) / scale, alpha);
}

/* Paint one whole sheet at a given scale. `bodyOnly` skips the decoration,
   which is what the fit search measures - a star touching the edge is fine,
   a clipped snout is not. */
function renderSheet(scale, bodyOnly){
  const ctx = makeCtx(sheetW, sheetH);
  STATES.forEach((state, row) => {
    for (let i = 0; i < state.frames; i++){
      const f = frameContent(state.id, i, state.frames, sp);
      const frameX = i * FRAME_W, frameY = row * FRAME_H;
      ctx.tx = frameX + Math.round((FRAME_W - 16 * scale) / 2);
      ctx.ty = frameY + (FRAME_H - 16 * scale - BOTTOM_PAD);
      const member = { species: SPECIES_ID, hue: 0, acc: state.laptop ? ["laptop"] : [] };
      M.paintMember(ctx, member, scale, 0, 0, f.pose);
      if (!bodyOnly) (f.marks || []).forEach(m => placeGlyph(ctx, m.g, scale, m.x, m.y, m.a, frameX, frameY));
    }
  });
  return ctx;
}

/* Anything painted on a frame's outer edge means the pose ran out of room. */
function clippedFrames(ctx){
  let bad = 0;
  STATES.forEach((state, row) => {
    for (let i = 0; i < state.frames; i++){
      const fx = i * FRAME_W, fy = row * FRAME_H;
      let touched = false;
      for (let x = 0; x < FRAME_W && !touched; x++)
        if (ctx.px[((fy) * sheetW + fx + x) * 4 + 3] || ctx.px[((fy + FRAME_H - 1) * sheetW + fx + x) * 4 + 3]) touched = true;
      for (let y = 0; y < FRAME_H && !touched; y++)
        if (ctx.px[((fy + y) * sheetW + fx) * 4 + 3] || ctx.px[((fy + y) * sheetW + fx + FRAME_W - 1) * 4 + 3]) touched = true;
      if (touched) bad++;
    }
  });
  return bad;
}

let ctx = null, SCALE = 0;
for (let s = 12; s >= 5; s--){
  const bad = clippedFrames(renderSheet(s, true));
  console.log(`  scale ${String(s).padStart(2)}: ${bad === 0 ? "fits" : bad + " frame(s) would clip the body"}`);
  if (bad === 0){ SCALE = s; ctx = renderSheet(s, false); break; }
}
if (!ctx) throw new Error("no scale fits the frame");
console.log(`chosen scale ${SCALE} (character ${16 * SCALE}px in a ${FRAME_W}x${FRAME_H} frame)\n`);

/* ---- 6. write it out as a PNG ---- */
function crc32(buf){
  let c, table = crc32.t || (crc32.t = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++){ c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
    return t;
  })());
  c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(w, h, rgba){
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++){
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(path.join(OUT_DIR, "spritesheet.png"), png(sheetW, sheetH, ctx.px));

/* how much of each frame is actually painted, as a sanity check */
const report = STATES.map((state, row) => {
  let filled = 0;
  for (let i = 0; i < state.frames; i++){
    let n = 0;
    for (let y = 0; y < FRAME_H; y++)
      for (let x = 0; x < FRAME_W; x++)
        if (ctx.px[(((row * FRAME_H + y) * sheetW) + (i * FRAME_W + x)) * 4 + 3] > 0) n++;
    if (n > 200) filled++;
  }
  return `${state.id.padEnd(14)} ${filled}/${state.frames} frames painted`;
});
console.log(`sheet ${sheetW}x${sheetH}  (${COLS}x${ROWS} frames of ${FRAME_W}x${FRAME_H})`);
console.log(report.join("\n"));
