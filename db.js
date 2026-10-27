// 端末内保存(IndexedDB)。写真はBlobのまま入れる。
const DB_NAME = 'michikusa-kanban';
const DB_VERSION = 1;
const STORE = 'signs';

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        let result;
        Promise.resolve(fn(store)).then((r) => (result = r));
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function allSigns() {
  const list = await tx('readonly', (s) => reqP(s.getAll()));
  return (list || []).sort((a, b) => b.createdAt - a.createdAt);
}

export function getSign(id) {
  return tx('readonly', (s) => reqP(s.get(id)));
}

export function putSign(sign) {
  return tx('readwrite', (s) => reqP(s.put(sign)));
}

export function deleteSign(id) {
  return tx('readwrite', (s) => reqP(s.delete(id)));
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Safariが使われていないサイトのデータを消すのを避けるため、永続化をお願いする
export async function requestPersist() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      return await navigator.storage.persist();
    }
    return true;
  } catch {
    return false;
  }
}

// ---- バックアップ ----
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataURLToBlob(url) {
  const res = await fetch(url);
  return res.blob();
}

export async function exportBackup() {
  const signs = await allSigns();
  const out = [];
  for (const s of signs) {
    out.push({ ...s, photo: await blobToDataURL(s.photo), thumb: await blobToDataURL(s.thumb) });
  }
  return new Blob([JSON.stringify({ app: 'michikusa-kanban', version: 1, exportedAt: Date.now(), signs: out })], {
    type: 'application/json',
  });
}

export async function importBackup(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'michikusa-kanban' || !Array.isArray(data.signs)) throw new Error('このアプリのバックアップではないみたい');
  const existing = new Set((await allSigns()).map((s) => s.id));
  let added = 0;
  for (const s of data.signs) {
    if (existing.has(s.id)) continue;
    await putSign({ ...s, photo: await dataURLToBlob(s.photo), thumb: await dataURLToBlob(s.thumb) });
    added++;
  }
  return added;
}
