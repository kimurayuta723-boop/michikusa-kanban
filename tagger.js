// 端末内AI(CLIP)によるタグ推測。写真は端末の外に出ない。
// モデルは初回だけHugging Faceから取得し、以降はブラウザのキャッシュから読む。
import { TAG_GROUPS } from './tags.js';

const LIB_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1';
const MODEL = 'Xenova/clip-vit-base-patch32';
const SETTING_KEY = 'michikusa.ai';

let classifierPromise = null;

export function aiSetting() {
  try {
    return localStorage.getItem(SETTING_KEY); // 'on' | 'off' | null(未選択)
  } catch {
    return null;
  }
}

export function setAiSetting(v) {
  try {
    localStorage.setItem(SETTING_KEY, v);
  } catch {
    /* 保存できなくても動作は続ける */
  }
}

function loadClassifier(onProgress) {
  if (classifierPromise) return classifierPromise;
  const files = new Map();
  classifierPromise = (async () => {
    const { pipeline, env } = await import(LIB_URL);
    env.allowLocalModels = false;
    return pipeline('zero-shot-image-classification', MODEL, {
      dtype: 'q8',
      progress_callback: (p) => {
        if (p.status === 'progress' && p.total) {
          files.set(p.file, { loaded: p.loaded, total: p.total });
          let loaded = 0, total = 0;
          for (const f of files.values()) { loaded += f.loaded; total += f.total; }
          onProgress?.({ phase: 'download', ratio: total ? loaded / total : 0 });
        }
      },
    });
  })().catch((e) => {
    classifierPromise = null; // 次回また試せるように
    throw e;
  });
  return classifierPromise;
}

// imageUrl: 切り抜き後の画像のURL(blob: でOK)
// 戻り値: { motif: ['food'], texture: ['handpainted'] }
export async function guessTags(imageUrl, onProgress) {
  const classifier = await loadClassifier(onProgress);
  onProgress?.({ phase: 'think' });
  const out = {};
  for (const group of TAG_GROUPS.filter((g) => g.source === 'ai')) {
    const prompts = group.tags.map((t) => t.prompt);
    const results = await classifier(imageUrl, prompts, { hypothesis_template: '{}' });
    const sorted = [...results].sort((a, b) => b.score - a.score);
    const pick = [];
    const [first, second] = sorted;
    if (first && first.score >= 0.28) pick.push(first.label);
    if (second && first && first.score < 0.55 && second.score >= 0.25) pick.push(second.label);
    out[group.key] = pick.map((label) => group.tags.find((t) => t.prompt === label)?.id).filter(Boolean);
  }
  return out;
}
