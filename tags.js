// タグの定義。AIの候補文(prompt)は英語のほうが精度が出るので英語で持つ。
export const TAG_GROUPS = [
  {
    key: 'tone',
    label: '色調',
    source: 'color', // 色分析で推測
    tags: [
      { id: 'pastel', label: 'パステル' },
      { id: 'vivid', label: 'ビビッド' },
      { id: 'dull', label: 'くすみ' },
      { id: 'mono', label: 'モノトーン' },
    ],
  },
  {
    key: 'motif',
    label: 'モチーフ',
    source: 'ai', // 端末内AIで推測
    tags: [
      { id: 'animal', label: '動物', prompt: 'a sign with an animal drawing' },
      { id: 'character', label: 'キャラ', prompt: 'a sign with a cute cartoon character' },
      { id: 'food', label: '食べもの', prompt: 'a sign with food or drink' },
      { id: 'plant', label: '植物', prompt: 'a sign with flowers or plants' },
      { id: 'pictogram', label: 'ピクトグラム', prompt: 'a pictogram symbol sign' },
      { id: 'text', label: '文字だけ', prompt: 'a sign with only lettering and text' },
    ],
  },
  {
    key: 'texture',
    label: '質感',
    source: 'ai',
    tags: [
      { id: 'handpainted', label: '手描き', prompt: 'a hand-painted sign' },
      { id: 'neon', label: 'ネオン', prompt: 'a glowing neon sign' },
      { id: 'enamel', label: 'ホーロー', prompt: 'an old enamel metal sign' },
      { id: 'wood', label: '木', prompt: 'a wooden sign' },
      { id: 'tile', label: 'タイル', prompt: 'a tiled mosaic sign' },
      { id: 'relief', label: '立体', prompt: 'a three-dimensional sculpted sign' },
    ],
  },
  {
    key: 'era',
    label: '時代感',
    source: 'manual',
    tags: [
      { id: 'showa', label: '昭和' },
      { id: 'retro', label: 'レトロ' },
      { id: 'recent', label: '最近' },
    ],
  },
];

const LABELS = new Map();
for (const g of TAG_GROUPS) for (const t of g.tags) LABELS.set(t.id, t.label);

export function tagLabel(id) {
  return LABELS.get(id) || id;
}

export function emptyTags() {
  return Object.fromEntries(TAG_GROUPS.map((g) => [g.key, []]));
}

export function allTagIds(tags) {
  return TAG_GROUPS.flatMap((g) => tags?.[g.key] || []);
}
