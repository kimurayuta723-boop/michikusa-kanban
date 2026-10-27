import { allSigns, putSign, deleteSign, newId, requestPersist, exportBackup, importBackup } from './db.js';
import { loadImage, cropToCanvas, squareThumb, samplePixels, canvasToBlob } from './image.js';
import { dominantColors, guessTone } from './color.js';
import { TAG_GROUPS, tagLabel, emptyTags, allTagIds } from './tags.js';
import { guessTags, aiSetting, setAiSetting } from './tagger.js';
import { mascotSVG } from './mascot.js';

const DEFAULT_CENTER = [33.5902, 130.4017]; // 位置がまったくわからないときの初期表示
const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const flow = $('#flow');

let signs = [];
let zukanFilter = 'all';
const urls = new Map(); // id -> { thumb, photo }

// ---------- 小さな道具 ----------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(t) {
  const d = new Date(t);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
function daysSince(t) {
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}
function tilt(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % 9) - 4;
}
function thumbURL(s) {
  if (!urls.has(s.id)) urls.set(s.id, {});
  const u = urls.get(s.id);
  if (!u.thumb) u.thumb = URL.createObjectURL(s.thumb);
  return u.thumb;
}
function photoURL(s) {
  if (!urls.has(s.id)) urls.set(s.id, {});
  const u = urls.get(s.id);
  if (!u.photo) u.photo = URL.createObjectURL(s.photo);
  return u.photo;
}
function dropURLs(id) {
  const u = urls.get(id);
  if (u) Object.values(u).forEach((x) => URL.revokeObjectURL(x));
  urls.delete(id);
}
function signTitle(s) {
  if (s.title) return s.title;
  const motif = s.tags?.motif?.[0];
  return motif ? `${tagLabel(motif)}の看板` : '名前のない看板';
}
function signNo(s) {
  const asc = [...signs].sort((a, b) => a.createdAt - b.createdAt);
  return String(asc.findIndex((x) => x.id === s.id) + 1).padStart(3, '0');
}
const GEAR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const CLOSE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const PEN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
const PIN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const CAMERA = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const PHOTO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>';

// ---------- トースト・シート ----------
let toastTimer = null;
function toast(msg, ms = 2400) {
  const t = $('#toast');
  t.innerHTML = `${mascotSVG({ size: 34 })}<span>${esc(msg)}</span>`;
  t.hidden = false;
  t.style.animation = 'none';
  void t.offsetWidth;
  t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}

function openSheet(html, bind) {
  const sheet = $('#sheet');
  $('#toast').hidden = true;
  sheet.innerHTML = `<div class="grabber"></div>${html}`;
  sheet.hidden = false;
  $('#sheetBackdrop').hidden = false;
  bind?.(sheet);
  sheet.querySelector('button')?.focus({ preventScroll: true });
}
function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheetBackdrop').hidden = true;
}
$('#sheetBackdrop').addEventListener('click', closeSheet);

function confirmSheet({ title, text, ok, danger }) {
  return new Promise((resolve) => {
    openSheet(
      `<h2>${esc(title)}</h2><p>${esc(text)}</p>
       <div class="stack">
         <button class="sheet-item ${danger ? 'danger' : ''}" data-ok>${esc(ok)}</button>
         <button class="btn-ghost cancel" data-cancel>やめておく</button>
       </div>`,
      (s) => {
        s.querySelector('[data-ok]').onclick = () => { closeSheet(); resolve(true); };
        s.querySelector('[data-cancel]').onclick = () => { closeSheet(); resolve(false); };
      }
    );
  });
}

// ---------- ルーティング ----------
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, arg] = h.split('/');
  return { name: name || 'zukan', arg };
}

function render() {
  const r = route();
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === r.name));
  document.body.classList.toggle('hide-tabbar', r.name === 'sign');
  $('#mapView').hidden = r.name !== 'map';
  view.hidden = r.name === 'map';
  if (r.name === 'map') return renderMap(r.arg);
  if (r.name === 'sign') return renderDetail(r.arg);
  return renderZukan();
}
window.addEventListener('hashchange', () => {
  render();
  if (route().name !== 'map') window.scrollTo(0, 0);
});

// ---------- 図鑑 ----------
function renderZukan() {
  const head = `
    <header class="screen-head">
      <div>
        <div class="brand">${mascotSVG({ size: 22 })}みちくさ看板</div>
        <h1 class="big-title">あつめた看板 <em>${signs.length}</em><small>枚</small></h1>
      </div>
      <button class="round-btn" id="settingsBtn" aria-label="設定">${GEAR}</button>
    </header>`;

  if (!signs.length) {
    view.innerHTML = `${head}
      <section class="empty">
        <div class="speech">まだ看板がないよ。<br>いっしょに散歩に出かけよう!</div>
        <div class="walk">${walkingSVG()}</div>
        <button class="btn-primary" id="emptyShoot">${CAMERA}看板を撮りにいく</button>
      </section>`;
    $('#emptyShoot').onclick = startAdd;
    $('#settingsBtn').onclick = openSettings;
    return;
  }

  // よく使われているタグをフィルターに
  const counts = new Map();
  signs.forEach((s) => allTagIds(s.tags).forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
  const topTags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);
  const hasGone = signs.some((s) => s.gone);
  if (zukanFilter !== 'all' && zukanFilter !== 'gone' && !counts.has(zukanFilter)) zukanFilter = 'all';
  if (zukanFilter === 'gone' && !hasGone) zukanFilter = 'all';

  const filters = [
    { id: 'all', label: 'ぜんぶ', cls: '' },
    ...topTags.map((id, i) => ({ id, label: tagLabel(id), cls: ['f-yellow', 'f-mint'][i % 2] })),
    ...(hasGone ? [{ id: 'gone', label: 'なくなった', cls: '' }] : []),
  ];
  const list = signs.filter((s) =>
    zukanFilter === 'all' ? true : zukanFilter === 'gone' ? s.gone : allTagIds(s.tags).includes(zukanFilter)
  );

  view.innerHTML = `${head}
    <div class="filters" role="group" aria-label="しぼりこみ">
      ${filters.map((f) => `<button class="chip small ${f.cls} ${zukanFilter === f.id ? 'on' : ''}" data-filter="${esc(f.id)}" aria-pressed="${zukanFilter === f.id}">${esc(f.label)}</button>`).join('')}
    </div>
    ${list.length ? `<div class="grid">
      ${list.map((s) => `
        <a class="card" href="#/sign/${s.id}">
          <div class="sticker ${s.gone ? 'gone' : ''}" style="transform: rotate(${tilt(s.id)}deg)">
            <img src="${thumbURL(s)}" alt="${esc(signTitle(s))}" loading="lazy">
          </div>
          <span>${esc(s.title || fmtDate(s.createdAt))}</span>
        </a>`).join('')}
    </div>` : '<div class="note">この条件の看板はまだないよ</div>'}`;

  view.querySelectorAll('[data-filter]').forEach((b) => (b.onclick = () => { zukanFilter = b.dataset.filter; renderZukan(); }));
  $('#settingsBtn').onclick = openSettings;
}

function walkingSVG() {
  return `<svg viewBox="0 0 100 86" role="img" aria-label="散歩道を歩く看板のキャラクター">
    <path d="M2 82 C 14 76, 16 70, 32 69" stroke="#2B2622" stroke-width="1.8" stroke-dasharray="1 4.5" stroke-linecap="round" fill="none"/>
    <ellipse cx="55" cy="70" rx="15" ry="2.6" fill="#2B2622" opacity="0.1"/>
    <path d="M48 54 L46.5 67 M62 54 L63.5 67" stroke="#2B2622" stroke-width="3" stroke-linecap="round"/>
    <path d="M42.5 67.5 H47 M63 67.5 H67.5" stroke="#2B2622" stroke-width="3.6" stroke-linecap="round"/>
    <g transform="rotate(-6 55 30)">
      <rect x="30" y="7" width="50" height="50" rx="14" fill="#2B2622" opacity="0.1"/>
      <rect x="30" y="5" width="50" height="50" rx="14" fill="#FFFFFF"/>
      <rect x="35.5" y="10.5" width="39" height="39" rx="10" fill="#F4A193"/>
      <g transform="translate(55 30)">
        <circle r="13" fill="#FFF8E8"/>
        <circle cx="-4.5" cy="-1.5" r="1.9" fill="#2B2622"/><circle cx="4.5" cy="-1.5" r="1.9" fill="#2B2622"/>
        <path d="M-2.6 2.8 Q 0 5.2 2.6 2.8" stroke="#2B2622" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <ellipse cx="-8" cy="2.8" rx="2.6" ry="1.7" fill="#F4A193"/><ellipse cx="8" cy="2.8" rx="2.6" ry="1.7" fill="#F4A193"/>
      </g>
    </g>
    <path d="M88 18 Q 88 22 92 22 Q 88 22 88 26 Q 88 22 84 22 Q 88 22 88 18 Z" fill="#F9E2A6"/>
    <path d="M20 30 Q 20 33 23 33 Q 20 33 20 36 Q 20 33 17 33 Q 20 33 20 30 Z" fill="#CDEBE0"/>
  </svg>`;
}

// ---------- 詳細 ----------
function renderDetail(id) {
  const s = signs.find((x) => x.id === id);
  if (!s) {
    view.innerHTML = `<div class="note">この看板は見つからなかったよ。<br><a href="#/zukan">図鑑にもどる</a></div>`;
    return;
  }
  const checks = [...(s.checks || [])].sort((a, b) => b.date - a.date);
  const last = checks[0];
  const statusText = { found: '見つけた', there: 'まだあった', gone: 'なくなっていた' };
  const tagIds = allTagIds(s.tags);

  view.innerHTML = `
    <header class="detail-head">
      <a class="round-btn" href="#/zukan" aria-label="図鑑にもどる">${BACK}</a>
      <div class="no">No.${signNo(s)}</div>
      <button class="round-btn" id="editBtn" aria-label="編集">${PEN}</button>
    </header>
    <div class="detail-hero">
      <div class="sticker ${s.gone ? 'gone' : ''}"><img src="${photoURL(s)}" alt="${esc(signTitle(s))}"></div>
    </div>
    <div class="detail-body">
      <div>
        <h1>${esc(signTitle(s))}</h1>
        <div class="meta"><span>${fmtDate(s.createdAt)} 見つけた</span>${s.lat != null ? `<a href="#/map/${s.id}">${PIN} 地図で見る</a>` : '<span>場所の記録なし</span>'}</div>
      </div>
      ${tagIds.length ? `<div class="tags">${tagIds.map((t) => `<span class="tag">${esc(tagLabel(t))}</span>`).join('')}</div>` : ''}
      ${s.colors?.length ? `<div class="swatches">${s.colors.map((c) => `<span class="swatch"><i style="background:${c.hex}"></i>${esc(c.name)}</span>`).join('')}</div>` : ''}
      <section class="panel">
        <div class="panel-head">
          <h2>${mascotSVG({ size: 28 })}まだある?</h2>
          <span>${last ? `前回の確認から ${daysSince(last.date)}日` : ''}</span>
        </div>
        ${s.gone ? '<div class="gone-banner">この看板はなくなっていたみたい。思い出は図鑑に残しておくね。</div>' : ''}
        <div class="two">
          <button class="btn-there" id="thereBtn">${s.gone ? 'やっぱりあった!' : 'あった!'}</button>
          <button class="btn-gone" id="goneBtn" ${s.gone ? 'disabled' : ''}>なくなった…</button>
        </div>
        <ul class="history">${checks.map((c) => `<li><span>${fmtDate(c.date)}</span><span>${statusText[c.status] || ''}</span></li>`).join('')}</ul>
      </section>
      <div class="danger-zone"><button class="btn-text" id="delBtn">この看板を削除する</button></div>
    </div>`;

  $('#thereBtn').onclick = async () => {
    s.checks = [...(s.checks || []), { date: Date.now(), status: 'there' }];
    s.gone = false;
    await putSign(s);
    renderDetail(s.id);
    toast('まだあった!よかった');
  };
  $('#goneBtn').onclick = async () => {
    s.checks = [...(s.checks || []), { date: Date.now(), status: 'gone' }];
    s.gone = true;
    await putSign(s);
    renderDetail(s.id);
    toast('記録したよ。図鑑には残しておくね');
  };
  $('#editBtn').onclick = () => showTags(structuredCloneSign(s), { isNew: false });
  $('#delBtn').onclick = async () => {
    const ok = await confirmSheet({ title: 'この看板を削除する?', text: '写真も記録も消えて、元に戻せません。', ok: '削除する', danger: true });
    if (!ok) return;
    await deleteSign(s.id);
    dropURLs(s.id);
    signs = signs.filter((x) => x.id !== s.id);
    location.hash = '#/zukan';
    toast('削除したよ');
  };
}

function structuredCloneSign(s) {
  // Blobはそのまま共有し、ほかはコピーする
  return { ...s, tags: JSON.parse(JSON.stringify(s.tags || emptyTags())), checks: [...(s.checks || [])], colors: [...(s.colors || [])] };
}

// ---------- 地図 ----------
let map = null, markerLayer = null, hereMarker = null, mapFitted = false;

// 背景地図:「色あせる前に」と同じく OpenFreeMap(Positron)のベクター地図を使い、
// 読み込めないときは 国土地理院 → OpenStreetMap の順に切り替える。
const PROVIDERS = [
  {
    id: 'ofm', vector: true, style: 'https://tiles.openfreemap.org/styles/positron',
    attr: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  },
  {
    id: 'gsi', url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', opt: { maxNativeZoom: 18, maxZoom: 20 },
    attr: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>',
  },
  {
    id: 'osm', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', opt: { maxNativeZoom: 19, maxZoom: 20 },
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  },
];

// 淡い配色(アプリのクリーム・ミントに合わせる)。地図の色を変えるときはここを調整する。
const MAP_TONE = {
  background: '#F8F3EA', // 地面
  water: '#D7ECE5',      // 海・川
  green: '#E5EEDC',      // 公園・緑地
  building: '#EEE6D9',   // 建物
  landuse: '#F4EEE4',    // 住宅地など
  road: '#FFFFFF',       // 道路
  roadEdge: '#EBE2D4',   // 道路のふち・線路
  boundary: '#E3D8C6',   // 境界線
  label: '#8C8178',      // 地名の文字
  labelHalo: '#FBF6EC',  // 文字のふち
};

const vectorOK = (() => {
  if (typeof L === 'undefined' || typeof maplibregl === 'undefined' || typeof L.maplibreGL !== 'function') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
})();
let provIdx = vectorOK ? 0 : 1;
const baseLayers = [];

function paleStyle(gl) {
  const set = (id, prop, val) => { try { gl.setPaintProperty(id, prop, val); } catch { /* その層にない設定は無視 */ } };
  try {
    gl.getStyle().layers.forEach((l) => {
      const id = l.id.toLowerCase();
      // 情報量を減らす(お店・番地・駅などのラベルを隠す)
      if (/poi|housenum|aerodrome|airport|transit|rail.*label|oneway|shield/.test(id)) {
        gl.setLayoutProperty(l.id, 'visibility', 'none');
        return;
      }
      if (l.type === 'background') set(l.id, 'background-color', MAP_TONE.background);
      else if (l.type === 'fill') {
        if (/water|ocean|lake|river/.test(id)) set(l.id, 'fill-color', MAP_TONE.water);
        else if (/park|wood|forest|grass|green|landcover|cemetery|pitch/.test(id)) set(l.id, 'fill-color', MAP_TONE.green);
        else if (/building/.test(id)) { set(l.id, 'fill-color', MAP_TONE.building); set(l.id, 'fill-outline-color', MAP_TONE.roadEdge); }
        else if (/landuse|residential|industrial|commercial/.test(id)) set(l.id, 'fill-color', MAP_TONE.landuse);
      } else if (l.type === 'line') {
        if (/water|river|stream|canal/.test(id)) set(l.id, 'line-color', MAP_TONE.water);
        else if (/boundary|admin/.test(id)) set(l.id, 'line-color', MAP_TONE.boundary);
        else if (/casing|rail|railway|transit/.test(id)) set(l.id, 'line-color', MAP_TONE.roadEdge);
        else if (/highway|road|street|path|transport|bridge|tunnel/.test(id)) set(l.id, 'line-color', MAP_TONE.road);
      } else if (l.type === 'symbol' && l.layout && l.layout['text-field']) {
        gl.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:ja'], ['get', 'name']]);
        set(l.id, 'text-color', MAP_TONE.label);
        set(l.id, 'text-halo-color', MAP_TONE.labelHalo);
      }
    });
  } catch { /* スタイルが読めないときはそのまま */ }
}

function makeBase(targetMap, withAttr) {
  if (PROVIDERS[provIdx].vector && !vectorOK) provIdx++;
  const pv = PROVIDERS[provIdx];
  const rec = { map: targetMap, withAttr, pv, errs: 0, oks: 0 };
  if (pv.vector) {
    rec.layer = L.maplibreGL({ style: pv.style, attribution: withAttr ? pv.attr : '', interactive: false }).addTo(targetMap);
    const gl = rec.layer.getMaplibreMap();
    let loaded = false;
    gl.on('style.load', () => paleStyle(gl));
    gl.on('load', () => { loaded = true; });
    gl.on('error', () => { rec.errs++; if (!loaded && rec.errs >= 3 && rec.pv === PROVIDERS[provIdx]) nextProvider(); });
    setTimeout(() => { if (!loaded && rec.pv === PROVIDERS[provIdx] && baseLayers.includes(rec)) nextProvider(); }, 10000);
  } else {
    rec.layer = L.tileLayer(pv.url, { attribution: withAttr ? pv.attr : '', ...pv.opt }).addTo(targetMap);
    rec.layer.on('tileload', () => rec.oks++);
    rec.layer.on('tileerror', () => { rec.errs++; if (rec.oks === 0 && rec.errs >= 4 && rec.pv === PROVIDERS[provIdx]) nextProvider(); });
  }
  baseLayers.push(rec);
  applyTileTone();
  return rec.layer;
}

function nextProvider() {
  if (provIdx >= PROVIDERS.length - 1) {
    toast('地図を読み込めなかったよ。電波を確認してね');
    return;
  }
  provIdx++;
  const olds = baseLayers.splice(0);
  olds.forEach((r) => { r.map.removeLayer(r.layer); makeBase(r.map, r.withAttr); });
}

function dropBase(targetMap) {
  for (let i = baseLayers.length - 1; i >= 0; i--) if (baseLayers[i].map === targetMap) baseLayers.splice(i, 1);
}

// 画像タイル(予備の地図)のときだけ、CSSで淡いセピア寄りに整える
function applyTileTone() {
  document.documentElement.classList.toggle('tiles-soft', !PROVIDERS[provIdx].vector);
}

function ensureMap() {
  if (map || typeof L === 'undefined') return map;
  map = L.map('map', { zoomControl: false }).setView(DEFAULT_CENTER, 15);
  map.attributionControl.setPrefix(false);
  makeBase(map, true);
  markerLayer = L.layerGroup().addTo(map);
  map.on('moveend', updateMapCount);
  map.on('click', () => ($('#mapCard').hidden = true));
  $('#locateBtn').onclick = () => locate(true);
  return map;
}

function renderMap(focusId) {
  if (!ensureMap()) {
    $('#mapCount').textContent = '地図を読み込めませんでした(オフライン?)';
    return;
  }
  setTimeout(() => map.invalidateSize(), 0);
  markerLayer.clearLayers();
  const placed = signs.filter((s) => s.lat != null);
  for (const s of placed) {
    const icon = L.divIcon({
      className: `pin ${s.gone ? 'gone' : ''}`,
      html: `<img src="${thumbURL(s)}" alt="">`,
      iconSize: [54, 54],
      iconAnchor: [27, 27],
    });
    L.marker([s.lat, s.lng], { icon, title: signTitle(s), keyboard: true })
      .on('click', (e) => { L.DomEvent.stopPropagation(e); showMapCard(s); })
      .addTo(markerLayer);
  }
  const focus = focusId && placed.find((s) => s.id === focusId);
  if (focus) {
    map.setView([focus.lat, focus.lng], 17);
    showMapCard(focus);
  } else if (!mapFitted) {
    mapFitted = true;
    if (placed.length) map.fitBounds(L.latLngBounds(placed.map((s) => [s.lat, s.lng])).pad(0.2), { maxZoom: 16 });
    else locate(false);
  }
  updateMapCount();
}

function updateMapCount() {
  if (!map) return;
  const b = map.getBounds();
  const n = signs.filter((s) => s.lat != null && b.contains([s.lat, s.lng])).length;
  $('#mapCount').innerHTML = `この辺の看板 <b>${n}</b>`;
}

function showMapCard(s) {
  const card = $('#mapCard');
  const tagIds = allTagIds(s.tags).slice(0, 3);
  card.innerHTML = `
    <a href="#/sign/${s.id}">
      <div class="sticker ${s.gone ? 'gone' : ''}"><img src="${thumbURL(s)}" alt=""></div>
      <div style="flex:1;min-width:0">
        <h3>${esc(signTitle(s))}</h3>
        <p>${fmtDate(s.createdAt)}${s.gone ? ' ・ なくなった' : ''}</p>
        <div class="tags">${tagIds.map((t) => `<span class="tag">${esc(tagLabel(t))}</span>`).join('')}</div>
      </div>
    </a>`;
  card.hidden = false;
}

function locate(fly) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (p) => {
      const ll = [p.coords.latitude, p.coords.longitude];
      if (!hereMarker) hereMarker = L.marker(ll, { icon: L.divIcon({ className: 'here', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false }).addTo(map);
      else hereMarker.setLatLng(ll);
      map.setView(ll, fly ? Math.max(map.getZoom(), 16) : 16);
    },
    () => fly && toast('現在地がわからなかったよ'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

// ---------- 登録:撮る ----------
let geo = { status: 'idle' };

function startGeo() {
  if (!navigator.geolocation) { geo = { status: 'error' }; return; }
  geo = { status: 'pending' };
  navigator.geolocation.getCurrentPosition(
    (p) => { geo = { status: 'ok', lat: p.coords.latitude, lng: p.coords.longitude }; updateLocChip(); },
    () => { geo = { status: 'error' }; updateLocChip(); },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
  );
}

function locChipHTML() {
  const t = { pending: '現在地を取得中…', ok: '現在地を取得しました', error: '現在地が取れませんでした', idle: '' }[geo.status];
  return `${PIN}<span>${t}</span>`;
}
function updateLocChip() {
  const c = $('#locChip');
  if (c) c.innerHTML = locChipHTML();
}

function startAdd() {
  startGeo();
  openSheet(
    `<h2>看板を見つけた?</h2>
     <div class="stack">
       <button class="sheet-item" id="pickCam">${CAMERA}カメラで撮る</button>
       <button class="sheet-item" id="pickLib">${PHOTO}写真から選ぶ<span class="sub">撮った場所で登録しよう</span></button>
       <button class="btn-ghost cancel" id="pickCancel">やめておく</button>
     </div>`,
    (s) => {
      s.querySelector('#pickCam').onclick = () => { closeSheet(); $('#camInput').click(); };
      s.querySelector('#pickLib').onclick = () => { closeSheet(); $('#libInput').click(); };
      s.querySelector('#pickCancel').onclick = closeSheet;
    }
  );
}
$('#shootBtn').addEventListener('click', startAdd);

async function onPicked(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const loaded = await loadImage(file);
    showCrop(loaded);
  } catch (err) {
    toast(err.message || '写真を読み込めなかったよ');
  }
}
$('#camInput').addEventListener('change', onPicked);
$('#libInput').addEventListener('change', onPicked);

function openFlow(dark) {
  $('#toast').hidden = true;
  flow.classList.toggle('dark', !!dark);
  flow.hidden = false;
  flow.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}
function closeFlow() {
  flow.hidden = true;
  flow.innerHTML = '';
  document.body.style.overflow = '';
}

// ---------- 登録:切り抜き ----------
function showCrop(loaded) {
  const { img, url } = loaded;
  openFlow(true);
  flow.innerHTML = `
    <div class="flow-inner" style="height:100%">
      <div class="flow-head">
        <button class="round-btn" id="cropClose" aria-label="やめる">${CLOSE}</button>
        <div class="loc-chip" id="locChip">${locChipHTML()}</div>
        <div style="width:44px"></div>
      </div>
      <div class="crop-stage" id="stage">
        <img id="cropImg" src="${url}" alt="切り抜く写真">
        <div class="crop-box" id="cropBox">
          <div class="handle nw" data-h="nw"></div><div class="handle ne" data-h="ne"></div>
          <div class="handle sw" data-h="sw"></div><div class="handle se" data-h="se"></div>
        </div>
      </div>
      <div class="crop-foot">
        <div class="say">${mascotSVG({ size: 36, legs: '#FBF6EC', shadow: false })}<div class="bubble">看板だけを囲んでね。<br>角の丸をつまむと大きさを変えられるよ</div></div>
        <div class="crop-actions">
          <button class="btn-ghost" id="cropRetake">撮りなおす</button>
          <button class="btn-primary" id="cropOk">これでOK</button>
        </div>
      </div>
    </div>`;

  const stage = $('#stage'), box = $('#cropBox'), imEl = $('#cropImg');
  let fit = null, rect = null;

  function layout() {
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const scale = Math.min(sw / img.naturalWidth, sh / img.naturalHeight);
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    fit = { scale, x: (sw - w) / 2, y: (sh - h) / 2, w, h };
    Object.assign(imEl.style, { left: fit.x + 'px', top: fit.y + 'px', width: w + 'px', height: h + 'px' });
    const bw = w * 0.8, bh = h * 0.8;
    rect = { x: fit.x + (w - bw) / 2, y: fit.y + (h - bh) / 2, w: bw, h: bh };
    draw();
  }
  function draw() {
    Object.assign(box.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
  }
  const MIN = 48;
  let drag = null;
  box.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    box.setPointerCapture(e.pointerId);
    drag = { mode: e.target.dataset.h || 'move', sx: e.clientX, sy: e.clientY, start: { ...rect } };
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy, s = drag.start;
    const L0 = fit.x, T0 = fit.y, R0 = fit.x + fit.w, B0 = fit.y + fit.h;
    let { x, y, w, h } = s;
    if (drag.mode === 'move') {
      x = Math.min(Math.max(L0, s.x + dx), R0 - s.w);
      y = Math.min(Math.max(T0, s.y + dy), B0 - s.h);
    } else {
      let left = s.x, top = s.y, right = s.x + s.w, bottom = s.y + s.h;
      if (drag.mode.includes('w')) left = Math.min(Math.max(L0, s.x + dx), right - MIN);
      if (drag.mode.includes('e')) right = Math.max(Math.min(R0, s.x + s.w + dx), left + MIN);
      if (drag.mode.includes('n')) top = Math.min(Math.max(T0, s.y + dy), bottom - MIN);
      if (drag.mode.includes('s')) bottom = Math.max(Math.min(B0, s.y + s.h + dy), top + MIN);
      x = left; y = top; w = right - left; h = bottom - top;
    }
    rect = { x, y, w, h };
    draw();
  });
  const end = () => (drag = null);
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
  const onResize = () => layout();
  window.addEventListener('resize', onResize);
  requestAnimationFrame(layout);

  const cleanup = () => window.removeEventListener('resize', onResize);
  $('#cropClose').onclick = () => { cleanup(); URL.revokeObjectURL(url); closeFlow(); };
  $('#cropRetake').onclick = () => { cleanup(); URL.revokeObjectURL(url); closeFlow(); startAdd(); };
  $('#cropOk').onclick = async () => {
    const btn = $('#cropOk');
    btn.disabled = true;
    btn.textContent = 'じゅんび中…';
    try {
      const natural = {
        x: (rect.x - fit.x) / fit.scale,
        y: (rect.y - fit.y) / fit.scale,
        w: rect.w / fit.scale,
        h: rect.h / fit.scale,
      };
      const draft = await buildDraft(img, natural);
      cleanup();
      showTags(draft, { isNew: true, back: () => showCrop(loaded) });
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'これでOK';
      toast(err.message || 'うまく切り抜けなかったよ');
    }
  };
}

async function buildDraft(img, natural) {
  const photoC = cropToCanvas(img, natural, 1280);
  const thumbC = squareThumb(photoC, 400);
  const pixels = samplePixels(photoC, 96);
  const colors = dominantColors(pixels, 6, 3);
  const tone = guessTone(pixels);

  // AI用:正方形の余白をつけて看板全体が入るようにする
  const side = Math.max(photoC.width, photoC.height);
  const aiC = document.createElement('canvas');
  aiC.width = aiC.height = 336;
  const ctx = aiC.getContext('2d');
  ctx.fillStyle = '#EEEEEE';
  ctx.fillRect(0, 0, 336, 336);
  const s = 336 / side;
  ctx.drawImage(photoC, (336 - photoC.width * s) / 2, (336 - photoC.height * s) / 2, photoC.width * s, photoC.height * s);

  const [photo, thumb, aiBlob] = await Promise.all([canvasToBlob(photoC, 0.82), canvasToBlob(thumbC, 0.8), canvasToBlob(aiC, 0.9)]);
  const tags = emptyTags();
  tags.tone = [...tone];
  return {
    id: newId(),
    createdAt: Date.now(),
    photo,
    thumb,
    colors,
    tags,
    title: '',
    lat: geo.status === 'ok' ? geo.lat : null,
    lng: geo.status === 'ok' ? geo.lng : null,
    checks: [{ date: Date.now(), status: 'found' }],
    gone: false,
    _aiBlob: aiBlob,
    _suggested: new Set(tone),
  };
}

// ---------- 登録:タグ ----------
let flowToken = 0;

function showTags(draft, { isNew, back }) {
  const token = ++flowToken;
  openFlow(false);
  const suggested = draft._suggested || new Set();
  const touched = new Set();
  const thumbUrl = URL.createObjectURL(draft.thumb);
  const aiUrl = draft._aiBlob ? URL.createObjectURL(draft._aiBlob) : null;
  let aiState = !isNew || !aiUrl ? 'none' : aiSetting() === 'on' ? 'loading' : aiSetting() === 'off' ? 'off' : 'ask';

  flow.innerHTML = `
    <div class="flow-inner">
      <div class="flow-head">
        <button class="round-btn" id="tagsBack" aria-label="もどる">${BACK}</button>
        <h2>${isNew ? 'タグをえらぶ' : '看板をなおす'}</h2>
        <div style="width:44px"></div>
      </div>
      <div class="tags-top">
        <div class="sticker"><img src="${thumbUrl}" alt="切り抜いた看板"></div>
        <div class="colors">
          <div class="label">見つけた色</div>
          <div class="swatches">${(draft.colors || []).map((c) => `<span class="swatch"><i style="background:${c.hex}"></i>${esc(c.name)}</span>`).join('') || '<span class="hint">色を取り出せませんでした</span>'}</div>
        </div>
      </div>
      <div class="tag-groups">
        <div class="ai-box" id="aiBox"></div>
        <div id="groups"></div>
        <div class="field">
          <label for="titleInput">なまえ <span class="hint">(なくてもOK)</span></label>
          <input id="titleInput" type="text" maxlength="40" placeholder="例:喫茶の丸看板" value="${esc(draft.title)}" enterkeyhint="done">
        </div>
        <div class="field">
          <label>見つけた場所</label>
          <div class="mini-map" id="miniMap"></div>
          <div class="hint" id="placeHint"></div>
        </div>
        <div class="spacer"></div>
      </div>
      <div class="flow-foot"><button class="btn-primary" id="saveBtn">${isNew ? '図鑑にのせる' : '保存する'}</button></div>
    </div>`;

  function chipClass(id, groupKey) {
    const on = draft.tags[groupKey]?.includes(id);
    if (!on) return '';
    return suggested.has(id) ? 'ai' : 'on';
  }
  function renderGroups() {
    $('#groups').innerHTML = TAG_GROUPS.map((g) => `
      <div class="tag-group">
        <h3>${esc(g.label)}${g.source === 'manual' ? ' <small>(自分でえらぶ)</small>' : ''}</h3>
        <div class="chips">
          ${g.tags.map((t) => {
            const cls = chipClass(t.id, g.key);
            return `<button class="chip ${cls}" data-g="${g.key}" data-t="${t.id}" aria-pressed="${!!cls}">${esc(t.label)}${cls === 'ai' ? '?' : ''}</button>`;
          }).join('')}
        </div>
      </div>`).join('<div style="height:20px"></div>');
    $('#groups').querySelectorAll('.chip').forEach((b) => (b.onclick = () => {
      const g = b.dataset.g, t = b.dataset.t;
      const arr = draft.tags[g] || (draft.tags[g] = []);
      const i = arr.indexOf(t);
      if (i >= 0) { arr.splice(i, 1); suggested.delete(t); }
      else arr.push(t);
      touched.add(g);
      renderGroups();
    }));
  }

  function renderAI(progress) {
    const box = $('#aiBox');
    if (!box) return;
    const say = (text, cls = '') => `<div class="say ${cls}">${mascotSVG({ size: 40 })}<div class="bubble">${text}</div></div>`;
    const anySuggest = [...suggested].length > 0;
    if (aiState === 'ask') {
      box.innerHTML = `
        ${anySuggest ? say('ミントの点線は、ぼくの推測だよ。<br>タップで付けたり外したりしてね') : ''}
        <div class="ai-ask">
          <div>モチーフや質感も、ぼくが推測してみようか?<br><span class="hint">初回だけAIのデータ(百数十MB)をダウンロードするので、Wi-Fiがおすすめ。写真は端末の外に出ないよ。</span></div>
          <div class="row">
            <button class="btn-ghost go" id="aiYes">推測してみて</button>
            <button class="btn-ghost" id="aiNo">自分でえらぶ</button>
          </div>
        </div>`;
      $('#aiYes').onclick = () => { setAiSetting('on'); aiState = 'loading'; runAI(); };
      $('#aiNo').onclick = () => { setAiSetting('off'); aiState = 'off'; renderAI(); };
    } else if (aiState === 'loading') {
      const pct = progress?.phase === 'download' ? Math.round(progress.ratio * 100) : null;
      box.innerHTML = `
        ${say(pct != null ? `AIのデータを準備中…(${pct}%)<br>はじめの1回だけだよ` : 'うーん、なんの看板かな…<br>考え中だよ', 'thinking')}
        ${pct != null ? `<div class="progress"><i style="width:${pct}%"></i></div>` : ''}`;
    } else if (aiState === 'error') {
      box.innerHTML = say('うまく推測できなかったよ。<br>自分でえらんでね(電波のいい所でまた試せるよ)');
    } else if (aiState === 'off') {
      box.innerHTML = `${anySuggest ? say('ミントの点線は、ぼくの推測だよ。<br>タップで付けたり外したりしてね') : ''}
        <button class="btn-text" id="aiOnce" style="align-self:flex-start;padding-left:0">AIでモチーフと質感を推測する</button>`;
      $('#aiOnce').onclick = () => { aiState = 'loading'; runAI(); };
    } else if (anySuggest) {
      box.innerHTML = say('ミントの点線は、ぼくの推測だよ。<br>タップで付けたり外したりしてね');
    } else {
      box.innerHTML = '';
    }
  }

  async function runAI() {
    renderAI();
    try {
      const result = await guessTags(aiUrl, (p) => { if (token === flowToken) renderAI(p); });
      if (token !== flowToken) return;
      for (const [g, ids] of Object.entries(result)) {
        if (touched.has(g)) continue;
        draft.tags[g] = [...new Set([...(draft.tags[g] || []), ...ids])];
        ids.forEach((id) => suggested.add(id));
      }
      aiState = 'done';
      renderGroups();
      renderAI();
    } catch (err) {
      console.warn('AI tagging failed', err);
      if (token !== flowToken) return;
      aiState = 'error';
      renderAI();
    }
  }

  // ミニ地図(ピンはドラッグで調整)
  let mini = null, pin = null;
  function setupMiniMap() {
    const hint = $('#placeHint');
    if (typeof L === 'undefined') { hint.textContent = '地図を読み込めませんでした。場所は今の位置で保存します。'; return; }
    const has = draft.lat != null;
    const lastPlaced = signs.find((s) => s.lat != null);
    const center = has ? [draft.lat, draft.lng] : lastPlaced ? [lastPlaced.lat, lastPlaced.lng] : DEFAULT_CENTER;
    mini = L.map('miniMap', { zoomControl: false, attributionControl: false }).setView(center, has ? 17 : 14);
    makeBase(mini, false);
    const icon = L.divIcon({ className: 'pin', html: `<img src="${thumbUrl}" alt="">`, iconSize: [44, 44], iconAnchor: [22, 22] });
    const place = (ll) => {
      draft.lat = ll.lat; draft.lng = ll.lng;
      if (!pin) {
        pin = L.marker(ll, { icon, draggable: true }).addTo(mini);
        pin.on('dragend', () => place(pin.getLatLng()));
      } else pin.setLatLng(ll);
      hint.textContent = 'ピンをドラッグすると場所を直せるよ';
    };
    if (has) place(L.latLng(draft.lat, draft.lng));
    else hint.textContent = geo.status === 'pending' ? '現在地を取得中…地図をタップしても置けるよ' : '位置が取れなかったよ。地図をタップすると置けるよ';
    mini.on('click', (e) => place(e.latlng));
    // 撮影中に現在地が取れたら反映
    if (!has && isNew && geo.status === 'pending') {
      const wait = setInterval(() => {
        if (token !== flowToken) return clearInterval(wait);
        if (geo.status === 'ok' && draft.lat == null) { place(L.latLng(geo.lat, geo.lng)); mini.setView([geo.lat, geo.lng], 17); }
        if (geo.status !== 'pending') clearInterval(wait);
      }, 500);
    }
    setTimeout(() => mini.invalidateSize(), 50);
  }

  function finish() {
    flowToken++;
    if (mini) { dropBase(mini); mini.remove(); }
    URL.revokeObjectURL(thumbUrl);
    if (aiUrl) URL.revokeObjectURL(aiUrl);
    closeFlow();
  }

  $('#tagsBack').onclick = () => {
    if (isNew && back) { flowToken++; if (mini) { dropBase(mini); mini.remove(); } URL.revokeObjectURL(thumbUrl); if (aiUrl) URL.revokeObjectURL(aiUrl); back(); }
    else finish();
  };
  $('#saveBtn').onclick = async () => {
    const btn = $('#saveBtn');
    btn.disabled = true;
    draft.title = $('#titleInput').value.trim();
    const { _aiBlob, _suggested, ...record } = draft;
    try {
      await putSign(record);
    } catch (err) {
      btn.disabled = false;
      toast('保存できなかったよ。空き容量を確認してね');
      return;
    }
    if (isNew) requestPersist();
    else dropURLs(record.id);
    signs = await allSigns();
    finish();
    if (isNew) {
      zukanFilter = 'all';
      if (location.hash !== '#/zukan') location.hash = '#/zukan';
      else render();
      toast('図鑑にのせたよ!');
    } else {
      render();
      toast('なおしたよ');
    }
  };

  renderGroups();
  renderAI();
  setupMiniMap();
  if (aiState === 'loading') runAI();
}

// ---------- 設定 ----------
function openSettings() {
  const on = aiSetting() === 'on';
  openSheet(
    `<h2>設定</h2>
     <div class="stack">
       <button class="sheet-item" id="setAi" role="switch" aria-checked="${on}">AIでタグを推測する<span class="switch ${on ? 'on' : ''}"></span></button>
       <button class="sheet-item" id="setExport">バックアップを書き出す<span class="sub">${signs.length}枚</span></button>
       <button class="sheet-item" id="setImport">バックアップから読み込む</button>
     </div>
     <p style="margin-top:16px">写真と記録はこのiPhoneの中だけに保存されます。消えてしまわないよう、Safariの共有ボタンから「ホーム画面に追加」して使い、ときどきバックアップを書き出しておくと安心です。</p>
     <button class="btn-ghost cancel" id="setClose" style="width:100%">とじる</button>`,
    (s) => {
      s.querySelector('#setAi').onclick = () => { setAiSetting(aiSetting() === 'on' ? 'off' : 'on'); openSettings(); };
      s.querySelector('#setExport').onclick = doExport;
      s.querySelector('#setImport').onclick = () => { closeSheet(); $('#importInput').click(); };
      s.querySelector('#setClose').onclick = closeSheet;
    }
  );
}

async function doExport() {
  if (!signs.length) return toast('まだ書き出す看板がないよ');
  try {
    const blob = await exportBackup();
    const d = new Date();
    const name = `michikusa-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'みちくさ看板のバックアップ' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    closeSheet();
  } catch (err) {
    if (err?.name !== 'AbortError') toast('書き出せなかったよ');
  }
}

$('#importInput').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const n = await importBackup(file);
    signs = await allSigns();
    render();
    toast(n ? `${n}枚読み込んだよ` : '新しい看板はなかったよ');
  } catch (err) {
    toast(err.message || '読み込めなかったよ');
  }
});

// ---------- 起動 ----------
async function boot() {
  try {
    signs = await allSigns();
  } catch (err) {
    view.innerHTML = '<div class="note">保存領域を開けませんでした。プライベートブラウズを解除して開き直してね。</div>';
    return;
  }
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();
