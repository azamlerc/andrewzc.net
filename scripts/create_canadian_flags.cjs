#!/usr/bin/env node
// Run with Node and sharp installed (or NODE_PATH pointing to bundled packages).
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'images/flags');
const sources = path.join(__dirname, 'canadian-flag-sources');
const masters = path.join(out, 'canadian-1024');
const flags = {
  on: 'Ontario', qc: 'Quebec', ns: 'Nova Scotia', nb: 'New Brunswick',
  mb: 'Manitoba', bc: 'British Columbia', pe: 'Prince Edward Island',
  sk: 'Saskatchewan', ab: 'Alberta', nl: 'Newfoundland and Labrador',
  nt: 'Northwest Territories', yt: 'Yukon', nu: 'Nunavut',
};
const N = 1024, FINAL = 240, scale = N / FINAL;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function interpolate(values, x) {
  x = clamp(x, 0, values.length - 1);
  const i = Math.floor(x), f = x - i;
  return values[i] * (1 - f) + values[Math.min(i + 1, values.length - 1)] * f;
}

function smooth(values, radius = 6, sigma = 2.3) {
  return values.map((_, x) => {
    let sum = 0, weight = 0;
    for (let dx = -radius; dx <= radius; dx++) {
      const w = Math.exp(-dx * dx / (2 * sigma * sigma));
      // Linear endpoint extension preserves the cloth's slope at its ends.
      const k = x + dx;
      const v = k < 0 ? values[0] + k * (values[1] - values[0])
        : k >= values.length ? values.at(-1) + (k-values.length+1)*(values.at(-1)-values.at(-2))
          : values[k];
      sum += v * w; weight += w;
    }
    return sum / weight;
  });
}

async function cloth() {
  const {data, info} = await sharp(path.join(out, 'wa.png')).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  if (info.width !== FINAL || info.height !== FINAL) throw new Error('Expected 240px reference');
  const rawTop = [], rawBottom = [], light = [], multiplier = [];
  // Integrate alpha to recover subpixel boundaries, then smooth the curves.
  // Avoid the vertical edge's half-coverage pixels when measuring the curve.
  for (let x = 9; x <= 230; x++) {
    let above = 0, below = 0;
    for (let y = 0; y < FINAL; y++) {
      const a = data[(y * FINAL + x) * 4 + 3] / 255;
      if (y < 100) above += a; else below += a;
    }
    rawTop.push(100 - above); rawBottom.push(100 + below);
  }
  const top = smooth(rawTop), bottom = smooth(rawBottom);
  // The lower green strip is clear of Washington's seal. Its R channel gives
  // the neutral reflection, and G-R gives the diffuse cloth lighting.
  for (let x = 0; x < FINAL; x++) {
    const sx = clamp(x, 8, 231);
    const by = interpolate(bottom, sx - 9);
    const offset = (Math.floor(by - 10) * FINAL + sx) * 4;
    const r = data[offset], g = data[offset + 1];
    light.push(r);
    multiplier.push((g - r) / 132);
  }
  // Remove 8-bit sampling bands from the reference when scaling to 1024px;
  // preserve the narrow dark vertical hems at both ends.
  const softLight = smooth(light), softMultiplier = smooth(multiplier);
  return {top, bottom,
    light: light.map((v,x)=>x>=12 && x<=228 ? softLight[x] : v),
    multiplier: multiplier.map((v,x)=>x>=12 && x<=228 ? softMultiplier[x] : v),
  };
}

function bound(curve, x) {
  // Samples are located at pixel centers x=9.5 ... 230.5.
  const i = x - 9.5;
  if (i < 0) return curve[0] + i * (curve[1] - curve[0]);
  if (i > curve.length - 1) return curve.at(-1) + (i-curve.length+1)*(curve.at(-1)-curve.at(-2));
  return interpolate(curve, i);
}

async function render(code, template) {
  // Rasterize the vector at 2048px for clean bilinear texture sampling while
  // generating the actual 1024px master. Fit=fill normalizes flag proportions.
  const T = 2048;
  const {data: tex} = await sharp(path.join(sources, code + '.svg'), {density: 300})
    .resize(T, T, {fit: 'fill'}).flatten({background: '#fff'}).removeAlpha()
    .raw().toBuffer({resolveWithObject: true});
  const result = Buffer.alloc(N * N * 4);
  const left = 7.5, right = 232.5;
  for (let px = 0; px < N; px++) {
    const x = (px + 0.5) / scale;
    if (x <= left || x >= right) continue;
    const top = bound(template.top, x), bottom = bound(template.bottom, x);
    const u = (x - left) / (right - left);
    const sx = clamp(u * T - 0.5, 0, T - 1), ix = Math.floor(sx), fx = sx - ix;
    const add = interpolate(template.light, x - 0.5);
    const mul = interpolate(template.multiplier, x - 0.5);
    for (let py = Math.max(0, Math.floor(top*scale)); py <= Math.min(N-1, Math.ceil(bottom*scale)); py++) {
      const y = (py + 0.5) / scale;
      const v = (y - top) / (bottom - top);
      if (v < 0 || v > 1) continue;
      const sy = clamp(v * T - 0.5, 0, T - 1), iy = Math.floor(sy), fy = sy - iy;
      const p00 = (iy*T + ix)*3, p10 = (iy*T + Math.min(ix+1,T-1))*3;
      const p01 = (Math.min(iy+1,T-1)*T + ix)*3, p11 = (Math.min(iy+1,T-1)*T + Math.min(ix+1,T-1))*3;
      // Subtle hem shadows and a narrow light rim, in final-size coordinates.
      const dt = y-top, db = bottom-y;
      const edgeShade = (1-0.24*Math.exp(-dt/0.7))*(1-0.29*Math.exp(-db/0.75));
      const highlight = 9*Math.exp(-(((dt-1.15)/0.6)**2));
      const p = (py*N + px)*4;
      for (let c = 0; c < 3; c++) {
        const color = (tex[p00+c]*(1-fx)+tex[p10+c]*fx)*(1-fy)
          + (tex[p01+c]*(1-fx)+tex[p11+c]*fx)*fy;
        result[p+c] = clamp(Math.round((color*mul+add)*edgeShade+highlight),0,255);
      }
      result[p+3] = 255;
    }
  }
  const raw = {width: N, height: N, channels: 4};
  await sharp(result, {raw}).png().toFile(path.join(masters, code+'.png'));
  await sharp(result, {raw}).resize(FINAL, FINAL, {kernel: 'lanczos3'})
    .png().toFile(path.join(out, code+'.png'));
  console.log(code, flags[code], '1024 → 240 RGBA');
}

async function preview() {
  const entries = [...Object.entries(flags), ['ca','California (existing)'], ['md','Maryland (existing)'], ['wa','Washington (existing)']];
  const layers = [];
  const width = 1120, height = 1080;
  let labels = '';
  for (let i = 0; i < entries.length; i++) {
    const [code, name] = entries[i], x = (i%4)*280, y = Math.floor(i/4)*270;
    layers.push({input: await fs.readFile(path.join(out, code+'.png')), left: x+20, top: y+5});
    labels += `<text x="${x+140}" y="${y+235}" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#333">${code.toUpperCase()} · ${name}</text>`;
    const small = await sharp(path.join(out, code+'.png')).resize(24,24).toBuffer();
    layers.push({input: small, left: x+128, top: y+241});
  }
  layers.push({input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${labels}</svg>`)});
  await sharp({create:{width,height,channels:4,background:'#f4f4f4'}}).composite(layers)
    .png().toFile(path.join(masters,'preview.png'));
}

(async()=>{
  await fs.mkdir(masters,{recursive:true});
  const template = await cloth();
  for (const code of Object.keys(flags)) await render(code,template);
  await preview();
})().catch(error=>{console.error(error);process.exitCode=1;});
