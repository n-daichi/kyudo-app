// ===========================
// KYUDO DOJO - 的の位置記録
// ===========================

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
let pendingX        = null; // 0〜1（clickAreaに対する比率）
let pendingY        = null;
let shots           = [];
let currentSession  = 1;
let currentArrowNum = 1;

let heatmapData = [
  { zone: '右上 (Upper Right)', pct: 0 },
  { zone: '中心部 (Center)',    pct: 0 },
  { zone: '左下 (Lower Left)',  pct: 0 },
];

// ──────────────────────────────
// ローカル日付文字列（タイムゾーン修正）
// ──────────────────────────────
function getLocalDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ──────────────────────────────
// 初期化
// ──────────────────────────────
async function init() {
  const user = await getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return; }

  const initial = user.email ? user.email[0].toUpperCase() : '弓';
  document.getElementById('sidebar-avatar').textContent = initial;
  document.getElementById('header-avatar').textContent  = initial;
  document.getElementById('sidebar-name').textContent   = user.email || 'Kyudojin';

  document.getElementById('daily-wisdom').textContent = wisdoms[new Date().getDate() % wisdoms.length];

  await loadTodayData();
  drawMato();
  renderShotHistory();
  renderHeatmap();
}

async function handleSignOut(e) {
  e.preventDefault();
  await signOut();
}

// ──────────────────────────────
// 今日のデータを取得して画面更新
// ──────────────────────────────
async function loadTodayData() {
  try {
    const todayShots = await getTodayShots();

    const hits     = todayShots.filter(s => s.result).length;
    const total    = todayShots.length;
    const hitRate  = total > 0 ? Math.round(hits / total * 100) : 0;
    const sessionCount = new Set(todayShots.map(s => s.session_num)).size;

    document.getElementById('stat-hitrate').innerHTML  = `${hitRate}<span class="stat-unit">%</span>`;
    document.getElementById('stat-total').textContent   = total;
    document.getElementById('stat-hits').textContent    = hits;
    document.getElementById('stat-sessions').textContent = sessionCount;

    // 次の立ち・矢番号を計算
    // dashboard経由で保存した場合も考慮してセッション番号を同期
    const maxSession = todayShots.length > 0
      ? Math.max(...todayShots.map(s => s.session_num))
      : 0;
    const shotsInLastSession = todayShots.filter(s => s.session_num === maxSession).length;

    if (maxSession === 0) {
      currentSession  = 1;
      currentArrowNum = 1;
    } else if (shotsInLastSession >= 4) {
      currentSession  = maxSession + 1;
      currentArrowNum = 1;
    } else {
      currentSession  = maxSession;
      currentArrowNum = shotsInLastSession + 1;
    }

    document.getElementById('session-name').textContent =
      `第${currentSession}立・${currentArrowNum}射目`;

    // ヒートマップ計算
    const withPos = todayShots.filter(s => s.pos_x !== null && s.pos_y !== null);
    if (withPos.length > 0) {
      calcHeatmap(withPos);
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
// ヒートマップ計算（方向修正）
// pos_x, pos_y は 0〜1（左上が原点）
// 弓道の的：上が的前（手前）、下が的後（奥）
// 右上 = x>0.5 かつ y<0.5
// ──────────────────────────────
function calcHeatmap(withPos) {
  let upperRight = 0, center = 0, lowerLeft = 0;
  withPos.forEach(s => {
    const dx   = s.pos_x - 0.5; // + = 右
    const dy   = s.pos_y - 0.5; // + = 下
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.12) {
      center++;
    } else if (dx > 0 && dy < 0) {
      // 右かつ上 → 右上
      upperRight++;
    } else {
      lowerLeft++;
    }
  });

  const t = withPos.length;
  heatmapData = [
    { zone: '右上 (Upper Right)', pct: Math.round(upperRight / t * 100) },
    { zone: '中心部 (Center)',    pct: Math.round(center     / t * 100) },
    { zone: '左下 (Lower Left)',  pct: Math.round(lowerLeft  / t * 100) },
  ];
}

// ──────────────────────────────
// Canvas設定
// ──────────────────────────────
const canvas   = document.getElementById('mato-canvas');
const ctx      = canvas.getContext('2d');
const CANVAS_W = canvas.width;
const CANVAS_H = canvas.height;
const cx = CANVAS_W / 2;
const cy = CANVAS_H / 2;
const R  = CANVAS_W / 2 - 4;

function drawMato() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // 的の輪
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

  // 中心黒点
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#1a2e3b';
  ctx.fill();

  // 着弾マーカー
  shots.forEach((shot, i) => {
    drawMarker(shot.x * CANVAS_W, shot.y * CANVAS_H, shot.result, i === shots.length - 1);
  });

  // ペンディングマーカー（クリック位置）
  if (pendingX !== null) {
    // clickAreaに対する比率をcanvas座標に変換
    const clickArea = document.getElementById('mato-click-area');
    const areaW = clickArea.offsetWidth;
    const areaH = clickArea.offsetHeight;
    const offsetX = (areaW - CANVAS_W) / 2;
    const offsetY = (areaH - CANVAS_H) / 2;
    const cx2 = pendingX * areaW - offsetX;
    const cy2 = pendingY * areaH - offsetY;
    drawMarker(cx2, cy2, 'pending', true);
  }
}

function drawMarker(px, py, result, isHighlighted) {
  const color = result === 'atari'  ? '#2d7a5f'
              : result === 'hazure' ? '#9aaa9f'
              : '#f0a500';

  ctx.beginPath();
  ctx.arc(px, py, isHighlighted ? 8 : 5, 0, Math.PI * 2);
  ctx.fillStyle   = color;
  ctx.globalAlpha = isHighlighted ? 1 : 0.7;
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
// クリックエリアのイベント（的の外もOK）
// ──────────────────────────────
const clickArea = document.getElementById('mato-click-area');

clickArea.addEventListener('click', function(e) {
  const rect = this.getBoundingClientRect();
  // clickAreaに対する比率（0〜1）で保存
  pendingX = (e.clientX - rect.left)  / rect.width;
  pendingY = (e.clientY - rect.top)   / rect.height;

  updateHint(pendingX, pendingY, rect.width, rect.height);
  drawMato();
});

// マウス移動でプレビュー表示
clickArea.addEventListener('mousemove', function(e) {
  const rect = this.getBoundingClientRect();
  const rx   = (e.clientX - rect.left)  / rect.width;
  const ry   = (e.clientY - rect.top)   / rect.height;
  updateHint(rx, ry, rect.width, rect.height);
});

function updateHint(rx, ry, areaW, areaH) {
  // clickAreaの中心からの距離（cm換算）
  const dx    = (rx - 0.5) * 2;
  const dy    = (ry - 0.5) * 2;
  const dist  = Math.round(Math.sqrt(dx * dx + dy * dy) * 18);
  const angle = Math.round(Math.atan2(-dy, dx) * (180 / Math.PI));
  const clock = angleToClock(angle);
  document.getElementById('mato-hint').textContent =
    dist < 2
      ? '● 中心付近'
      : `● 中心から約${dist}cm・${clock}方向`;
}

function angleToClock(deg) {
  // 数学角度（右=0°、反時計）→ 時計の時刻
  // 12時 = 上 = 90°
  let clock = ((90 - deg) / 30 + 12) % 12;
  if (clock <= 0) clock += 12;
  return `${Math.round(clock)}時`;
}

// ──────────────────────────────
// 的中・失中ボタン → Supabaseに保存
// ──────────────────────────────
async function recordResult(result) {
  // pendingがなければclickAreaの中心（的中心）を使う
  let storeX, storeY;
  if (pendingX !== null) {
    // clickAreaの比率をcanvasの比率に変換
    const clickAreaEl = document.getElementById('mato-click-area');
    const areaW = clickAreaEl.offsetWidth;
    const areaH = clickAreaEl.offsetHeight;
    const offsetX = (areaW - CANVAS_W) / 2;
    const offsetY = (areaH - CANVAS_H) / 2;
    // canvas上の座標
    const canvasX = pendingX * areaW - offsetX;
    const canvasY = pendingY * areaH - offsetY;
    // canvas比率に変換（0〜1）
    storeX = Math.max(0, Math.min(1, canvasX / CANVAS_W));
    storeY = Math.max(0, Math.min(1, canvasY / CANVAS_H));
  } else {
    // クリックなし：的中なら中心、外れはランダム
    if (result === 'atari') {
      storeX = 0.5 + (Math.random() - 0.5) * 0.1;
      storeY = 0.5 + (Math.random() - 0.5) * 0.1;
    } else {
      storeX = 0.5 + (Math.random() - 0.5) * 0.6;
      storeY = 0.5 + (Math.random() - 0.5) * 0.6;
    }
  }

  try {
    await saveShot({
      shot_date:   getLocalDateStr(),
      session_num: currentSession,
      arrow_num:   currentArrowNum,
      arrow_type:  currentTab,
      result:      result === 'atari',
      pos_x:       storeX,
      pos_y:       storeY,
    });

    shots.push({
      tab: currentTab, x: storeX, y: storeY,
      result, label: result === 'atari' ? '的中' : '失中',
    });

    // 矢番号・立ちを進める
    currentArrowNum++;
    if (currentArrowNum > 4) { currentArrowNum = 1; currentSession++; }

    pendingX = null;
    pendingY = null;

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
// タブ切替
// ──────────────────────────────
function switchTab(el, tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

// ──────────────────────────────
// 射の履歴チップ
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
// ヒートマップ描画
// ──────────────────────────────
function renderHeatmap() {
  const list = document.getElementById('heatmap-list');
  if (heatmapData.every(d => d.pct === 0)) {
    list.innerHTML = '<p style="font-size:12px;color:#999;">クリックエリアをタップして着弾位置を記録してください。</p>';
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
    <p class="heatmap-note">⚠ 押し手と引き込みを意識して練習しましょう。</p>
  `;
}

// ──────────────────────────────
// 初期化実行
// ──────────────────────────────
init();
