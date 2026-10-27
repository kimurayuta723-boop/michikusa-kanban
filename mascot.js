// アプリのキャラクター「あるく看板」(アイコンB1と同じ形)
export function mascotSVG({ size = 40, legs = '#2B2622', shadow = true, label = '' } = {}) {
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="mascot" width="${size}" height="${Math.round(size * 64 / 60)}" viewBox="0 0 60 64" ${a11y}>
  <path d="M23 50 L22 59 M37 50 L38 59" stroke="${legs}" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M18.5 60 H23 M37 60 H41.5" stroke="${legs}" stroke-width="4" stroke-linecap="round"/>
  <g transform="rotate(-6 30 27)">
    ${shadow ? '<rect x="5" y="4" width="50" height="50" rx="14" fill="#2B2622" opacity="0.1"/>' : ''}
    <rect x="5" y="2" width="50" height="50" rx="14" fill="#FFFFFF"/>
    <rect x="10.5" y="7.5" width="39" height="39" rx="10" fill="#F4A193"/>
    <g transform="translate(30 27)">
      <circle r="13" fill="#FFF8E8"/>
      <circle class="eye" cx="-4.5" cy="-1.5" r="1.9" fill="#2B2622"/>
      <circle class="eye" cx="4.5" cy="-1.5" r="1.9" fill="#2B2622"/>
      <path d="M-2.6 2.8 Q 0 5.2 2.6 2.8" stroke="#2B2622" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <ellipse cx="-8" cy="2.8" rx="2.6" ry="1.7" fill="#F4A193"/>
      <ellipse cx="8" cy="2.8" rx="2.6" ry="1.7" fill="#F4A193"/>
    </g>
  </g>
</svg>`;
}
