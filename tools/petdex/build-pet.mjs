/* Build Petdex pet packages from Menagerie animals.

     node tools/petdex/build-pet.mjs index.html dragon ./out
     node tools/petdex/build-pet.mjs index.html all    ./out

   The sprite grids, palettes, poses and moves are read straight out of
   index.html, so a pet is pixel-identical to the animal in the app rather
   than a redrawn approximation. No dependencies: zlib writes both the PNG
   and the zip. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync, deflateRawSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = process.argv[2] || path.join(HERE, "../../index.html");
const WANTED = process.argv[3] || "all";
const OUT_DIR = process.argv[4] || path.join(HERE, "../../pets");
const META = JSON.parse(readFileSync(path.join(HERE, "pets.json"), "utf8"));

/* ---- 1. lift the sprite and animation sections out of the page ---- */
const html = readFileSync(APP, "utf8");
const from = html.indexOf("const SPECIES = {");
const to = html.indexOf("/* --- the noises they make");
if (from < 0 || to < 0 || to < from) throw new Error("could not locate the sprite/animator sections");
const load = new Function("window", "document", html.slice(from, to) + `
  return { SPECIES, GLYPHS, MOVES, paintMember, drawGlyph, frameFor };`);
const M = load({ devicePixelRatio: 1 }, { createElement: () => ({ getContext: () => null }) });

/* ---- 2. a canvas context just big enough for solid rectangles ---- */
const FRAME_W = 192, FRAME_H = 208, COLS = 8, ROWS = 9;
const BOTTOM_PAD = 4;

function parseColor(css){
  if (css[0] === "#"){
    const h = css.slice(1);
    return h.length === 3
      ? [...h].map(c => parseInt(c + c, 16))
      : [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  const m = css.match(/hsl\(\s*([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/);
  if (!m) throw new Error("unparsed colour: " + css);
  const h = parseFloat(m[1]) / 360, s = parseFloat(m[2]) / 100, l = parseFloat(m[3]) / 100;
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

/* ---- 3. the states Menagerie has no equivalent for ---- */
const R = Math.round, S = Math.sin, PI = Math.PI;
const runPose = (u, dir) => {
  const bob = Math.abs(S(u * PI * 2));
  return { hy: -R(bob * 2), by: -R(bob), shear: dir * 2, hx: dir + R(S(u * PI * 2)) * dir };
};
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

/* ---- 5. render ---- */
const sheetW = FRAME_W * COLS, sheetH = FRAME_H * ROWS;

/* Glyphs are placed for the app's roomier field. Nudge any that would hang
   off a 192x208 frame back inside, rather than slicing them. */
function placeGlyph(ctx, name, scale, x, y, alpha, frameX, frameY){
  const g = M.GLYPHS[name];
  if (!g) return;
  const w = g.px[0].length * scale, h = g.px.length * scale;
  const left = Math.min(Math.max(x * scale + ctx.tx, frameX), frameX + FRAME_W - w);
  const top  = Math.min(Math.max(y * scale + ctx.ty, frameY), frameY + FRAME_H - h);
  M.drawGlyph(ctx, name, scale, (left - ctx.tx) / scale, (top - ctx.ty) / scale, alpha);
}

function renderSheet(speciesId, scale, bodyOnly){
  const sp = M.SPECIES[speciesId];
  const ctx = makeCtx(sheetW, sheetH);
  STATES.forEach((state, row) => {
    for (let i = 0; i < state.frames; i++){
      const f = frameContent(state.id, i, state.frames, sp);
      const frameX = i * FRAME_W, frameY = row * FRAME_H;
      ctx.tx = frameX + Math.round((FRAME_W - 16 * scale) / 2);
      ctx.ty = frameY + (FRAME_H - 16 * scale - BOTTOM_PAD);
      const member = { species: speciesId, hue: 0, acc: state.laptop ? ["laptop"] : [] };
      M.paintMember(ctx, member, scale, 0, 0, f.pose);
      if (!bodyOnly) (f.marks || []).forEach(m => placeGlyph(ctx, m.g, scale, m.x, m.y, m.a, frameX, frameY));
    }
  });
  return ctx;
}

/* Anything painted on a frame's outer edge means the pose ran out of room.
   Only the body is measured: a star touching the edge is fine, a sliced
   snout is not. */
function clippedFrames(ctx){
  let bad = 0;
  STATES.forEach((state, row) => {
    for (let i = 0; i < state.frames; i++){
      const fx = i * FRAME_W, fy = row * FRAME_H;
      let touched = false;
      for (let x = 0; x < FRAME_W && !touched; x++)
        if (ctx.px[(fy * sheetW + fx + x) * 4 + 3] || ctx.px[((fy + FRAME_H - 1) * sheetW + fx + x) * 4 + 3]) touched = true;
      for (let y = 0; y < FRAME_H && !touched; y++)
        if (ctx.px[((fy + y) * sheetW + fx) * 4 + 3] || ctx.px[((fy + y) * sheetW + fx + FRAME_W - 1) * 4 + 3]) touched = true;
      if (touched) bad++;
    }
  });
  return bad;
}

function paintedFrames(ctx){
  let ok = 0, total = 0;
  STATES.forEach((state, row) => {
    for (let i = 0; i < state.frames; i++){
      total++;
      let n = 0;
      for (let y = 0; y < FRAME_H; y++)
        for (let x = 0; x < FRAME_W; x++)
          if (ctx.px[(((row * FRAME_H + y) * sheetW) + (i * FRAME_W + x)) * 4 + 3] > 0) n++;
      if (n > 200) ok++;
    }
  });
  return { ok, total };
}

/* ---- 6. PNG ---- */
function crc32(buf){
  const table = crc32.t || (crc32.t = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
    return t;
  })());
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function pngChunk(type, data){
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
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

/* ---- 7. zip, so the whole tool stays dependency free ---- */
function zip(files){
  const parts = [], central = [];
  let offset = 0;
  for (const f of files){
    const comp = deflateRawSync(f.data, { level: 9 });
    const crc = crc32(f.data), name = Buffer.from(f.name, "utf8");
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(f.data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    parts.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(f.data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += lh.length + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, eocd]);
}

/* ---- 8. build ---- */
function buildOne(speciesId){
  const meta = META[speciesId];
  if (!meta) throw new Error("no metadata for " + speciesId + " in pets.json");
  let ctx = null, scale = 0;
  for (let s = 12; s >= 5; s--){
    if (clippedFrames(renderSheet(speciesId, s, true)) === 0){ scale = s; ctx = renderSheet(speciesId, s, false); break; }
  }
  if (!ctx) throw new Error("no scale fits the frame for " + speciesId);

  const sheet = png(sheetW, sheetH, ctx.px);
  const manifest = {
    id: meta.id, displayName: meta.name, description: meta.desc,
    kind: speciesId, tags: meta.tags, vibes: ["cozy"],
    author: "devkancheti4-design", license: "Apache-2.0",
    spriteVersionNumber: 1, spritesheet: "spritesheet.png",
    frame: { width: FRAME_W, height: FRAME_H },
    grid: { columns: COLS, rows: ROWS },
    states: STATES.map((s, row) => ({ id: s.id, row, frames: s.frames, durationMs: s.ms }))
  };
  const petJson = Buffer.from(JSON.stringify(manifest, null, 2) + "\n", "utf8");

  const dir = path.join(OUT_DIR, meta.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "spritesheet.png"), sheet);
  writeFileSync(path.join(dir, "pet.json"), petJson);
  const archive = zip([{ name: "pet.json", data: petJson }, { name: "spritesheet.png", data: sheet }]);
  writeFileSync(path.join(dir, meta.id + ".zip"), archive);

  const { ok, total } = paintedFrames(ctx);
  return { id: meta.id, name: meta.name, species: speciesId, scale, ok, total,
           bytes: sheet.length, manifest, zipBytes: archive.length };
}

mkdirSync(OUT_DIR, { recursive: true });
const list = WANTED === "all" ? Object.keys(META) : [WANTED];
const rows = list.map(buildOne);

/* Building the whole roster also refreshes the index that makes this
   directory readable as an API. Paths are relative to the index itself, so
   the same file works from any host it is served from. */
if (WANTED === "all"){
  const index = {
    version: 1,
    name: "Menagerie pets",
    description: "Pixel companions exported from the Menagerie chat UI, in the Petdex sprite format.",
    license: "Apache-2.0",
    author: "devkancheti4-design",
    source: "https://github.com/devkancheti4-design/shiv1",
    spriteFormat: {
      frame: { width: FRAME_W, height: FRAME_H },
      grid: { columns: COLS, rows: ROWS },
      states: STATES.map((s, row) => ({ id: s.id, row, frames: s.frames, durationMs: s.ms }))
    },
    count: rows.length,
    pets: rows.map(r => ({
      id: r.id, name: r.name, kind: r.species,
      description: r.manifest.description, tags: r.manifest.tags,
      scale: r.scale,
      petJson: `${r.id}/pet.json`,
      spritesheet: `${r.id}/spritesheet.png`,
      zip: `${r.id}/${r.id}.zip`,
      bytes: { spritesheet: r.bytes, zip: r.zipBytes }
    })).sort((a, b) => a.id.localeCompare(b.id))
  };
  writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2) + "\n");
  console.log(`wrote index.json describing ${index.count} pets\n`);
}
console.log(`${rows.length} pet package(s) in ${OUT_DIR}\n`);
console.log("id         name      species   scale  frames  sheet");
for (const r of rows){
  console.log(`${r.id.padEnd(10)} ${r.name.padEnd(9)} ${r.species.padEnd(9)} ${String(r.scale).padStart(2)}     ${r.ok}/${r.total}   ${(r.bytes/1024).toFixed(1)}kb`
    + (r.ok === r.total ? "" : "   <-- BLANK FRAMES"));
}
