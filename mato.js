// ===========================
// KYUDO DOJO - 的の位置記録
// ===========================

// ──────────────────────────────
// 今日の知恵（日替わり）
// ──────────────────────────────
const wisdoms = [
  '「正射必中」－正しく射られた矢は、必ず的に当たる。',
  '「残心」－射終わった後も心を残し、気を抜かないこと。',
  '「弓は心の鏡」－射の乱れは心の乱れを映す。',
  '「会」－体と弓が一体となった瞬間を大切に。',
  '「離れ」－力を抜くのではなく、力が自然に放たれること。',
  '「的中よりも射形」－美しい射から的中は生まれる。',
  '「呼吸」－息を整えることが射を整える第一歩。',
];

// ──────────────────────────────
// 状態管理
// ──────────────────────────────
let currentTab      = 'haya';
let pendingX        = null;
let pendingY        = null;
let shots           = [];
let currentSession  = 1;
let currentArrowNum = 1;

let heatmapData = [
  { zone: '名上 (Upper Right)', pct: 0 },
  { zone: '中心部 (Center)',     pct: 0 },
  { zone: '左下 (Lower Left)',   pct: 0 },
];

// ──────────────────────────────
// 初期化
// ──────────────────────────────
async function init() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // 今日の知恵（日付で切り替え）
  const dayIndex = new Date().getDate() % wisdoms.length;
  document.getElementById('daily-wisdom').textContent = wisdoms[dayIndex];

  await loadTodayData();

  drawMato();
  renderShotHistory();
  renderHeatmap();
}

// ──────────────────────────────
// 今日のデータを取得して画面を更新
// ──────────────────────────────
async function loadTodayData() {
  try {
    const todayShots = await getTodayShots();

    // 統計グリッドを更新
    const hits     = todayShots.filter(s => s.result).length;
    const total    = todayShots.length;
    const hitRate  = total > 0 ? Math.round(hits / total * 100) : 0;
    const sessions = new Set(todayShots.map(s => s.session_num)).size;

    document.getElementById('stat-hitrate').innerHTML = `${hitRate}<span class="stat-unit">%</span>`;
    document.getElementById('stat-total').textContent  = total;
    document.getElementById('stat-hits').textContent   = hits;
    document.getElementById('stat-sessions').textContent = sessions;

    // 現在のセッション番号を更新
    currentSession  = sessions + 1;
    currentArrowNum = (todayShots.length % 4) + 1;

    // セッション名を更新
    document.getElementById('session-name').textContent =
      `第${currentSession}立・${currentArrowNum}射目`;

    // ヒートマップ計算
    const withPos = todayShots.filter(s => s.pos_x !== null && s.pos_y !== null);
    if (withPos.length > 0) {
      let upperRight = 0, center = 0, lowerLeft = 0;
      withPos.forEach(s => {
        const dx   = s.pos_x - 0.5;
        const dy   = s.pos_y - 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.15)           center++;
        else if (dx > 0 && dy < 0) upperRight++;
        else                        lowerLeft++;
      });
      const t = withPos.length;
      heatmapData = [
        { zone: '名上 (Upper Right)', pct: Math.round(upperRight / t * 100) },
        { zone: '中心部 (Center)',     pct: Math.round(center     / t * 100) },
        { zone: '左下 (Lower Left)',   pct: Math.round(lowerLeft  / t * 100) },
      ];

      // 直近4射をCanvas用に変換
      shots = withPos.slice(-4).map(s => ({
        tab:    s.arrow_type,
        x:      s.pos_x,
        y:      s.pos_y,
        result: s.result ? 'atari' : 'hazure',
        label:  s.result ? '的中' : '失中',
      }));
    }

  } catch (error) {
    console.error('データ取得エラー:', error);
  }
}

// ──────────────────────────────
// Canvas：的を描く
// ──────────────────────────────
const canvas = document.getElementById('mato-canvas');
const ctx    = canvas.getContext('2d');
const cx = canvas.width  / 2;
const cy = canvas.height / 2;
const R  = canvas.width  / 2 - 8;

function drawMato() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const rings = [
    { r: R,        color: '#fff',    stroke: '#ccc' },
    { r: R * 0.75, color: '#f0f4f2', stroke: '#bbb' },
    { r: R * 0.50, color: '#e0ede6', stroke: '#aaa' },
    { r: R * 0.25, color: '#2d7a5f', stroke: '#1a4a3a' },
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

  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#1a2e3b';
  ctx.fill();

  shots.forEach((shot, i) => {
    drawMarker(shot.x * canvas.width, shot.y * canvas.height, shot.result, i === shots.length - 1);
  });

  if (pendingX !== null) {
    drawMarker(pendingX * canvas.width, pendingY * canvas.height, 'pending', true);
  }
}

function drawMarker(px, py, result, isHighlighted) {
  const color = result === 'atari'  ? '#2d7a5f'
              : result === 'hazure' ? '#9aaa9f'
              : '#f0a500';

  ctx.beginPath();
  ctx.arc(px, py, isHighlighted ? 8 : 5, 0, Math.PI * 2);
  ctx.fillStyle   = color;
  ctx.globalAlpha = isHighlighted ? 1 : 0.65;
  ctx.fill();
  ctx.globalAlpha = 1;

  if (isHighlighted) {
    ctx.beginPath();
    ctx.arc(px, py, 13, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.globalAlpha = 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ──────────────────────────────
// Canvasクリック
// ──────────────────────────────
canvas.addEventListener('click', function(e) {
  const rect = canvas.getBoundingClientRect();
  pendingX = (e.clientX - rect.left) / rect.width;
  pendingY = (e.clientY - rect.top)  / rect.height;
  updateHint(pendingX, pendingY);
  drawMato();
});

function updateHint(rx, ry) {
  const dx    = (rx - 0.5) * 2;
  const dy    = (ry - 0.5) * 2;
  const dist  = Math.round(Math.sqrt(dx * dx + dy * dy) * 18);
  const angle = Math.round(Math.atan2(-dy, dx) * (180 / Math.PI));
  const clock = angleToClock(angle);
  document.querySelector('.mato-hint').textContent = `● 中心から${dist}cm・${clock}方向`;
}

function angleToClock(deg) {
  const h = ((90 - deg) / 30 + 12) % 12 || 12;
  return `${Math.round(h)}時`;
}

// ──────────────────────────────
// 的中・失中ボタン → Supabaseに保存
// ──────────────────────────────
async function recordResult(result) {
  const x = pendingX ?? 0.5 + (Math.random() - 0.5) * 0.3;
  const y = pendingY ?? 0.5 + (Math.random() - 0.5) * 0.3;

  try {
    const today = new Date().toISOString().split('T')[0];

    await saveShot({
      shot_date:   today,
      session_num: currentSession,
      arrow_num:   currentArrowNum,
      arrow_type:  currentTab,
      result:      result === 'atari',
      pos_x:       x,
      pos_y:       y,
    });

    shots.push({ tab: currentTab, x, y, result, label: result === 'atari' ? '的中' : '失中' });

    // 矢番号・立ちを進める
    currentArrowNum++;
    if (currentArrowNum > 4) {
      currentArrowNum = 1;
      currentSession++;
    }

    pendingX = null;
    pendingY = null;

    // 画面を再描画
    await loadTodayData();
    drawMato();
    renderShotHistory();
    renderHeatmap();

  } catch (error) {
    alert('保存に失敗しました：' + error.message);
    console.error(error);
  }
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
  const display   = shots.slice(-4);
  const items     = [...display, { tab: currentTab, result: 'pending', label: '…', current: true }];

  container.innerHTML = items.map((shot, i) => {
    const isCurrent   = shot.current;
    const tabLabel    = shot.tab === 'haya' ? 'Haya' : 'Otoya';
    const shotNum     = isCurrent ? 'CURRENT' : `SHOT ${i + 1}`;
    const resultClass = shot.result === 'atari' ? 'hit' : shot.result === 'hazure' ? 'miss' : 'pending';

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

  if (heatmapData.every(d => d.pct === 0)) {
    list.innerHTML = '<p style="font-size:12px;color:#999;">着弾データがまだありません。的をクリックして記録してください。</p>';
    return;
  }

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
      ⚠ 分析：着弾傾向を確認し、押し手と引き込みを意識して練習しましょう。
    </p>
  `;
}

// ──────────────────────────────
// 初期化実行
// ──────────────────────────────
init();
