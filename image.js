// 写真の読み込み・切り抜き・縮小
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('写真を読み込めませんでした'));
    };
    img.src = url;
  });
}

// rect は元画像のピクセル座標 {x, y, w, h}
export function cropToCanvas(img, rect, maxEdge = 1280) {
  const scale = Math.min(1, maxEdge / Math.max(rect.w, rect.h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(rect.w * scale));
  c.height = Math.max(1, Math.round(rect.h * scale));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, c.width, c.height);
  return c;
}

// 正方形サムネイル(はみ出しは切る)
export function squareThumb(source, size = 400) {
  const sw = source.width, sh = source.height;
  const side = Math.min(sw, sh);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, (sw - side) / 2, (sh - side) / 2, side, side, 0, 0, size, size);
  return c;
}

// 分析用の小さな画素データ
export function samplePixels(source, max = 96) {
  const s = Math.min(1, max / Math.max(source.width, source.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(source.width * s));
  c.height = Math.max(1, Math.round(source.height * s));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return ctx.getImageData(0, 0, c.width, c.height).data;
}

export function canvasToBlob(canvas, quality = 0.82) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像の保存に失敗しました'))), 'image/jpeg', quality);
  });
}
