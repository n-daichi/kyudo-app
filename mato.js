// ===========================
// KYUDO DOJO - 的の位置記録
// ===========================

// ──────────────────────────────
// データ
// ──────────────────────────────

// 現在選択中の矢の種類
let currentTab = 'haya'; // 'haya'=甲矢, 'otoya'=乙矢

// 今セッションの射の記録
// { tab, x, y, result, label }
let shots = [
  { tab: 'haya',  x: 0.62, y: 0.30, result: 'atari', label: '的中' },
  { tab: 'otoya', x: 0.55, y: 0.55, result: 'atari', label: '的中' },
  { tab: 'haya',  x: 0.45, y: 0.65, result: 'hazure', label: '失中' },
];

// 的に打たれた最後の着弾位置（クリックで更新）
let pendingX = null;
let pendingY = null;

// ヒートマップデータ（方向ごとの割合）
const heatmapData = [
  { zone: '名上 (Upper Right)', pct: 42 },
  { zone: '中心部 (Center)',     pct: 28 },
  { zone: '左下 (Lower Left)',   pct: 15 },
];

// ──────────────────────────────
// Canvas：的を描く
// ──────────────────────────────
const canvas = document.getElementById('mato-canvas');
const ctx    = canvas.getContext('2d');

// 的の中心・半径
const cx = canvas.width  / 2;
const cy = canvas.height / 2;
const R  = canvas.width  / 2 - 8; // 外周の余白

function drawMato() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 的の輪（外→内）
  const rings = [
    { r: R,        color: '#fff',     stroke: '#ccc' },
    { r: R * 0.75, color: '#f0f4f2',  stroke: '#bbb' },
    { r: R * 0.50, color: '#e0ede6',  stroke: '#aaa' },
    { r: R * 0.25, color: '#2d7a5f',  stroke: '#1a4a3a' }, // 中心（星）
  ];

  rings.forEach(ring => {
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.fillStyle   = ring.color;
    ctx.strokeStyle = ring.stroke;
    ctx.lineWidth   = 1.5;
    ctx.fill();
    ctx.stroke();
  });

  // 中心の黒点
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#1a2e3b';
  ctx.fill();

  // 着弾マーカーを描く
  shots.forEach((shot, i) => {
    const px = shot.x * canvas.width;
    const py = shot.y * canvas.height;
    const isLast = i === shots.length - 1;
    drawMarker(px, py, shot.result, isLast);
  });

  // クリック後・結果未確定の場合はプレビューマーカー
  if (pendingX !== null) {
    drawMarker(pendingX * canvas.width, pendingY * canvas.height, 'pending', true);
  }
}

function drawMarker(px, py, result, isHighlighted) {
  const color = result === 'atari'  ? '#2d7a5f'
              : result === 'hazure' ? '#9aaa9f'
              : '#f0a500'; // pending

  ctx.beginPath();
  ctx.arc(px, py, isHighlighted ? 8 : 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = isHighlighted ? 1 : 0.65;
  ctx.fill();
  ctx.globalAlpha = 1;

  if (isHighlighted) {
    ctx.beginPath();
    ctx.arc(px, py, 13, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ──────────────────────────────
// Canvasクリック：着弾位置を記録
// ──────────────────────────────
canvas.addEventListener('click', function(e) {
  const rect = canvas.getBoundingClientRect();
  // クリック座標を 0〜1 の比率に変換
  pendingX = (e.clientX - rect.left)  / rect.width;
  pendingY = (e.clientY - rect.top)   / rect.height;

  updateHint(pendingX, pendingY);
  drawMato();
});

// 中心からの距離・方向をヒントに表示
function updateHint(rx, ry) {
  const dx = (rx - 0.5) * 2; // -1〜1
  const dy = (ry - 0.5) * 2;
  const dist = Math.round(Math.sqrt(dx * dx + dy * dy) * 18); // 中心=0, 端=約18cm
  const angle = Math.round(Math.atan2(-dy, dx) * (180 / Math.PI));
  const clock  = angleToClock(angle);
  document.querySelector('.mato-hint').textContent =
    `● 中心から${dist}cm・${clock}方向`;
}

function angleToClock(deg) {
  // 数学角度（0=右）→ 時計方向に変換
  const h = ((90 - deg) / 30 + 12) % 12 || 12;
  return `${Math.round(h)}時`;
}

// ──────────────────────────────
// 的中・失中ボタン
// ──────────────────────────────
function recordResult(result) {
  const x = pendingX ?? 0.5 + (Math.random() - 0.5) * 0.3;
  const y = pendingY ?? 0.5 + (Math.random() - 0.5) * 0.3;

  shots.push({
    tab:    currentTab,
    x, y,
    result,
    label: result === 'atari' ? '的中' : '失中',
  });

  pendingX = null;
  pendingY = null;

  drawMato();
  renderShotHistory();

  // ここに後でSupabaseへの保存処理を書く
  console.log('記録:', { tab: currentTab, x, y, result });
}

// ──────────────────────────────
// 甲矢・乙矢タブ切替
// ──────────────────────────────
function switchTab(el, tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

// ──────────────────────────────
// 射の履歴チップを描画
// ──────────────────────────────
function renderShotHistory() {
  const container = document.getElementById('shot-history');
  const display   = shots.slice(-4); // 直近4射を表示

  // 「CURRENT」枠を追加
  const items = [...display, { tab: currentTab, result: 'pending', label: '…', current: true }];

  container.innerHTML = items.map((shot, i) => {
    const isCurrent = shot.current;
    const tabLabel  = shot.tab === 'haya' ? 'Haya' : 'Otoya';
    const shotNum   = isCurrent ? 'CURRENT' : `SHOT ${i + 1}`;
    const resultClass = shot.result === 'atari'  ? 'hit'
                      : shot.result === 'hazure' ? 'miss' : 'pending';

    return `
      <div class="shot-chip ${isCurrent ? 'current' : ''}">
        <span class="chip-shot-label">${shotNum}</span>
        <span class="chip-shot-result ${resultClass}">${shot.label}</span>
        <span class="chip-shot-sub">${tabLabel}</span>
      </div>
    `;
  }).join('');
}

// ──────────────────────────────
// ヒートマップを描画
// ──────────────────────────────
function renderHeatmap() {
  const list = document.getElementById('heatmap-list');
  list.innerHTML = heatmapData.map(item => `
    <div class="heatmap-item">
      <div class="heatmap-row">
        <span class="heatmap-zone">${item.zone}</span>
        <span class="heatmap-pct">${item.pct}%</span>
      </div>
      <div class="heatmap-bar-bg">
        <div class="heatmap-bar-fill" style="width: ${item.pct}%"></div>
      </div>
    </div>
  `).join('') + `
    <p class="heatmap-note">
      ⚠ 分析：名上への集中傾向があります。大弓での押し手を意識し、肩手の引き込みを確認してください。
    </p>
  `;
}

// ──────────────────────────────
// 初期描画
// ──────────────────────────────
drawMato();
renderShotHistory();
renderHeatmap();
