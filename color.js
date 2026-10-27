// 色の抽出(k-means)、伝統色の名前づけ、色調タグの推測
export const TRADITIONAL_COLORS = [
  ['桜色', '#FEF4F4'], ['鴇色', '#F4B3C2'], ['撫子色', '#EEBBCB'], ['桃色', '#F09199'], ['薄紅', '#F0908D'],
  ['珊瑚色', '#F5B1AA'], ['牡丹色', '#E7609E'], ['紅', '#D7003A'], ['茜色', '#B7282E'], ['臙脂', '#B94047'],
  ['朱色', '#EB6101'], ['柿色', '#ED6D3D'], ['煉瓦色', '#B55233'], ['弁柄色', '#8F2E14'], ['鳶色', '#95483F'],
  ['小豆色', '#96514D'], ['栗色', '#762F07'], ['焦茶', '#6F4B3E'], ['橙色', '#EE7800'], ['蜜柑色', '#F08300'],
  ['杏色', '#F7B977'], ['狐色', '#C38743'], ['黄土色', '#C39143'], ['亜麻色', '#D6C6AF'], ['山吹色', '#F8B500'],
  ['卵色', '#FCD575'], ['黄色', '#FFD900'], ['菜の花色', '#FFEC47'], ['芥子色', '#D0AF4C'], ['鶸色', '#D7CF3A'],
  ['若草色', '#C3D825'], ['萌黄', '#AACF53'], ['抹茶色', '#C5C56A'], ['鶯色', '#928C36'], ['若竹色', '#68BE8D'],
  ['緑', '#3EB370'], ['常磐色', '#007B43'], ['深緑', '#00552E'], ['青磁色', '#7EBEAB'], ['浅葱色', '#00A3AF'],
  ['水色', '#BCE2E8'], ['空色', '#A0D8EF'], ['勿忘草色', '#89C3EB'], ['露草色', '#38A1DB'], ['群青色', '#4C6CB3'],
  ['瑠璃色', '#1E50A2'], ['藍色', '#165E83'], ['紺色', '#223A70'], ['藤色', '#BBBCDE'], ['桔梗色', '#5654A2'],
  ['菫色', '#7058A3'], ['江戸紫', '#745399'], ['紫', '#884898'], ['利休鼠', '#888E7E'], ['銀鼠', '#AFAFB0'],
  ['鼠色', '#949495'], ['鈍色', '#727171'], ['墨', '#595857'], ['黒', '#2B2B2B'], ['漆黒', '#0D0015'],
  ['象牙色', '#F8F4E6'], ['生成色', '#FBFAF5'], ['白練', '#F3F3F3'], ['胡粉色', '#FFFFFC'],
];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function rgbToLab([r, g, b]) {
  const lin = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

const TRAD_LAB = TRADITIONAL_COLORS.map(([name, hex]) => ({ name, hex, lab: rgbToLab(hexToRgb(hex)) }));

export function nearestTraditional(rgb) {
  const lab = rgbToLab(rgb);
  let best = TRAD_LAB[0], bd = Infinity;
  for (const t of TRAD_LAB) {
    const d = dist2(lab, t.lab);
    if (d < bd) { bd = d; best = t; }
  }
  return { name: best.name, hex: best.hex };
}

// data: RGBA の Uint8ClampedArray
export function dominantColors(data, k = 6, maxOut = 3) {
  const pts = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const rgb = [data[i], data[i + 1], data[i + 2]];
    pts.push({ rgb, lab: rgbToLab(rgb) });
  }
  if (!pts.length) return [];
  k = Math.min(k, pts.length);

  // k-means++ を決定的に(最も遠い点を順に選ぶ)
  const centers = [pts[Math.floor(pts.length / 2)].lab.slice()];
  while (centers.length < k) {
    let far = pts[0], fd = -1;
    for (const p of pts) {
      let m = Infinity;
      for (const c of centers) m = Math.min(m, dist2(p.lab, c));
      if (m > fd) { fd = m; far = p; }
    }
    centers.push(far.lab.slice());
  }

  const assign = new Array(pts.length).fill(0);
  for (let iter = 0; iter < 12; iter++) {
    for (let i = 0; i < pts.length; i++) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = dist2(pts[i].lab, centers[c]);
        if (d < bd) { bd = d; bi = c; }
      }
      assign[i] = bi;
    }
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pts.length; i++) {
      const s = sums[assign[i]], l = pts[i].lab;
      s[0] += l[0]; s[1] += l[1]; s[2] += l[2]; s[3]++;
    }
    sums.forEach((s, c) => { if (s[3]) centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }

  const clusters = centers.map(() => ({ n: 0, rgb: [0, 0, 0], lab: [0, 0, 0] }));
  for (let i = 0; i < pts.length; i++) {
    const cl = clusters[assign[i]], p = pts[i];
    cl.n++;
    for (let j = 0; j < 3; j++) { cl.rgb[j] += p.rgb[j]; cl.lab[j] += p.lab[j]; }
  }
  const list = clusters
    .filter((c) => c.n)
    .map((c) => ({ n: c.n, rgb: c.rgb.map((v) => v / c.n), lab: c.lab.map((v) => v / c.n) }))
    .sort((a, b) => b.n - a.n);

  // 近すぎる色はまとめる
  const picked = [];
  for (const c of list) {
    if (picked.every((p) => dist2(p.lab, c.lab) > 15 * 15)) picked.push(c);
    if (picked.length >= maxOut) break;
  }
  return picked.map((c) => {
    const trad = nearestTraditional(c.rgb);
    return { hex: rgbToHex(c.rgb), name: trad.name, swatch: trad.hex, share: c.n / pts.length };
  });
}

// 色調タグ: pastel / vivid / dull / mono
export function guessTone(data) {
  let gray = 0, vivid = 0, pastel = 0, dull = 0, total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const chroma = max - min, light = (max + min) / 2;
    total++;
    if (chroma < 0.1) gray++;
    else if (chroma >= 0.38) vivid++;
    else if (light > 0.68) pastel++;
    else dull++;
  }
  if (!total) return [];
  if (gray / total > 0.78) return ['mono'];
  const scores = { vivid: vivid * 1.6, pastel: pastel * 1.1, dull };
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  return [best];
}
