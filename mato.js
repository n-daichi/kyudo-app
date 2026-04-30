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
let pendingX        = null;
let pendingY        = null;
let shots           = [];
let currentSession  = 1;
let currentArrowNum = 1;

let heatmapData = [
  { zone: '右上 (Upper Right)', pct: 0 },
  { zone: '中心部 (Center)',    pct: 0 },
  { zone: '左下 (Lower Left)',  pct: 0 },
];

function getLocalDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function init() {
  const user = await getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return; }

  const saved = JSON.parse(localStorage.getItem('kyudo-profile') || '{}');
  const displayName = saved.name || user.email || 'Kyudojin';
  const initial = displayName[0].toUpperCase();
  document.getElementById('sidebar-avatar').textContent = initial;
  document.getElementById('header-avatar').textContent  = initial;
  document.getElementById('sidebar-name').textContent   = displayName;
  const rankMap = { mudan:'無段', shodan:'初段', nidan:'二段', sandan:'三段', yondan:'四段', godan:'五段', rokudan:'六段' };
  document.getElementById('sidebar-rank').textContent = `Rank: ${rankMap[saved.rank] || '初段'}`;

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

async function loadTodayData() {
  try {
    const todayShots = await getTodayShots();

    const hits         = todayShots.filter(s => s.result).length;
    const total        = todayShots.length;
    const hitRate      = total > 0 ? Math.round(hits / total * 100) : 0;
    const sessionCount = new Set(todayShots.map(s => s.session_num)).size;

    document.getElementById('stat-hitrate').innerHTML   = `${hitRate}<span class="stat-unit">%</span>`;
    document.getElementById('stat-total').textContent   = total;
    document.getElementById('stat-hits').textContent    = hits;
    document.getElementById('stat-sessions').textContent = sessionCount;

    const maxSession = todayShots.length > 0
      ? Math.max(...todayShots.map(s => s.session_num)) : 0;
    const shotsInLastSession = todayShots.filter(s => s.session_num === maxSession).length;

    if (maxSession === 0) {
      currentSession = 1; currentArrowNum = 1;
    } else if (shotsInLastSession >= 4) {
      currentSession = maxSession + 1; currentArrowNum = 1;
    } else {
      currentSession = maxSession; currentArrowNum = shotsInLastSession + 1;
    }

    document.getElementById('session-name').textContent =
      `第${currentSession}立・${currentArrowNum}射目`;

    const withPos = todayShots.filter(s => s.pos_x !== null && s.pos_y !== null);
    if (withPos.length > 0) {
      calcHeatmap(withPos);
      shots = withPos.slice(-8).map(s => ({
        tab: s.arrow_type, x: s.pos_x, y: s.pos_y,
        result: s.result ? 'atari' : 'hazure',
        label:  s.result ? '的中' : '失中',
      }));
    }
  } catch (error) {
    console.error('データ取得エラー:', error);
  }
}

function calcHeatmap(withPos) {
  // Canvas座標：Y軸は下向き（dy > 0 が画面下 = 的では「下」）
  // dx > 0 → 右、dx < 0 → 左、dy > 0 → 下、dy < 0 → 上
  let counts = { upperRight:0, upperLeft:0, lowerRight:0, lowerLeft:0, center:0 };
  withPos.forEach(s => {
    const dx = s.pos_x - 0.5, dy = s.pos_y - 0.5;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.12) {
      counts.center++;
    } else if (dx >= 0 && dy < 0) {
      counts.upperRight++;
    } else if (dx < 0 && dy < 0) {
      counts.upperLeft++;
    } else if (dx >= 0 && dy >= 0) {
      counts.lowerRight++;
    } else {
      counts.lowerLeft++;
    }
  });
  const t = withPos.length;
  heatmapData = [
    { zone: '右上 (Upper Right)', pct: Math.round(counts.upperRight / t * 100) },
    { zone: '左上 (Upper Left)',  pct: Math.round(counts.upperLeft  / t * 100) },
    { zone: '右下 (Lower Right)', pct: Math.round(counts.lowerRight / t * 100) },
    { zone: '左下 (Lower Left)',  pct: Math.round(counts.lowerLeft  / t * 100) },
    { zone: '中心部 (Center)',    pct: Math.round(counts.center     / t * 100) },
  ].filter(d => d.pct > 0);
  if (heatmapData.length === 0) {
    heatmapData = [{ zone: '中心部 (Center)', pct: 0 }];
  }
}

// ──────────────────────────────
// Canvas定数
// 星的（ほしまと）：外枠白丸 + 中央に黒い星（直径12cm / 全体36cm）
// canvasはclickAreaと同サイズ（320x320）
// ──────────────────────────────
const canvas   = document.getElementById('mato-canvas');
const ctx      = canvas.getContext('2d');
const CANVAS_W = canvas.width;
const CANVAS_H = canvas.height;
const CANVAS_CX = CANVAS_W / 2;
const CANVAS_CY = CANVAS_H / 2;
const MATO_R  = CANVAS_W * 0.44;        // 外枠円半径（canvasいっぱいに）
const HOSHI_R = MATO_R * (12 / 36);     // 星の半径（実寸比率）

function drawMato() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // グレー背景（的の外エリア）
  ctx.fillStyle = '#f0f2f1';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // 外枠の白い大円
  ctx.beginPath();
  ctx.arc(CANVAS_CX, CANVAS_CY, MATO_R, 0, Math.PI * 2);
  ctx.fillStyle   = '#ffffff';
  ctx.strokeStyle = '#444444';
  ctx.lineWidth   = 3;
  ctx.fill();
  ctx.stroke();

  // 星（黒丸）- 的の中央
  ctx.beginPath();
  ctx.arc(CANVAS_CX, CANVAS_CY, HOSHI_R, 0, Math.PI * 2);
  ctx.fillStyle   = '#1a1a1a';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth   = 1.5;
  ctx.fill();
  ctx.stroke();

  // 着弾マーカー
  shots.forEach((shot, i) => {
    drawMarker(shot.x * CANVAS_W, shot.y * CANVAS_H, shot.result, i === shots.length - 1);
  });

  // ペンディングマーカー（クリック位置プレビュー）
  if (pendingX !== null) {
    drawMarker(pendingX * CANVAS_W, pendingY * CANVAS_H, 'pending', true);
  }
}

// ──────────────────────────────
// マーカー描画
// 的中(atari)  → 緑●
// 失中(hazure) → 赤×
// pending      → オレンジ●
// ──────────────────────────────
function drawMarker(px, py, result, isHighlighted) {
  ctx.save();
  ctx.lineCap = 'round';

  if (result === 'atari') {
    const r = isHighlighted ? 8 : 6;
    ctx.globalAlpha = isHighlighted ? 1 : 0.85;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = '#2d7a5f';
    ctx.fill();
    if (isHighlighted) {
      ctx.beginPath();
      ctx.arc(px, py, r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#2d7a5f';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.3;
      ctx.stroke();
    }

  } else if (result === 'hazure') {
    const s = isHighlighted ? 9 : 7;
    ctx.globalAlpha = isHighlighted ? 1 : 0.9;
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth   = isHighlighted ? 3 : 2.5;
    // 白い背景でXを際立たせる
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur  = 3;
    ctx.beginPath();
    ctx.moveTo(px - s, py - s); ctx.lineTo(px + s, py + s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + s, py - s); ctx.lineTo(px - s, py + s);
    ctx.stroke();

  } else {
    // pending
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fillStyle   = '#f0a500';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// ──────────────────────────────
// クリックイベント（canvas全面がクリック可能）
// ──────────────────────────────
const clickArea = document.getElementById('mato-click-area');

clickArea.addEventListener('click', function(e) {
  const rect = canvas.getBoundingClientRect();
  pendingX = (e.clientX - rect.left) / CANVAS_W;
  pendingY = (e.clientY - rect.top)  / CANVAS_H;
  updateHint(pendingX, pendingY);
  drawMato();
});

clickArea.addEventListener('mousemove', function(e) {
  const rect = canvas.getBoundingClientRect();
  updateHint((e.clientX - rect.left) / CANVAS_W, (e.clientY - rect.top) / CANVAS_H);
});

function updateHint(rx, ry) {
  const px = rx * CANVAS_W;
  const py = ry * CANVAS_H;
  const dx = (px - CANVAS_CX) / MATO_R;
  const dy = (py - CANVAS_CY) / MATO_R;
  const distNorm = Math.sqrt(dx * dx + dy * dy);
  const distCm   = Math.round(distNorm * 18);
  const angle    = Math.round(Math.atan2(-dy, dx) * (180 / Math.PI));
  const clock    = angleToClock(angle);

  if (distCm < 2) {
    document.getElementById('mato-hint').textContent = '● 的の中心付近';
  } else if (distNorm <= 1) {
    const inHoshi = distNorm < (12 / 36);
    document.getElementById('mato-hint').textContent =
      `● ${inHoshi ? '★ 星の中' : '的の中'}・中心から約${distCm}cm・${clock}方向`;
  } else {
    document.getElementById('mato-hint').textContent =
      `● 的の外側・中心から約${distCm}cm・${clock}方向`;
  }
}

function angleToClock(deg) {
  let clock = ((90 - deg) / 30 + 12) % 12;
  if (clock <= 0) clock += 12;
  return `${Math.round(clock)}時`;
}

// ──────────────────────────────
// 的中・失中ボタン → Supabaseに保存
// ──────────────────────────────
async function recordResult(result) {
  let storeX, storeY;
  if (pendingX !== null) {
    // pendingX/Y はすでにcanvas比率（0〜1）
    storeX = Math.max(0, Math.min(1, pendingX));
    storeY = Math.max(0, Math.min(1, pendingY));
  } else {
    if (result === 'atari') {
      storeX = 0.5 + (Math.random() - 0.5) * 0.15;
      storeY = 0.5 + (Math.random() - 0.5) * 0.15;
    } else {
      storeX = 0.5 + (Math.random() - 0.5) * 0.7;
      storeY = 0.5 + (Math.random() - 0.5) * 0.7;
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

    shots.push({ tab: currentTab, x: storeX, y: storeY,
      result, label: result === 'atari' ? '的中' : '失中' });

    currentArrowNum++;
    if (currentArrowNum > 4) { currentArrowNum = 1; currentSession++; }

    pendingX = null; pendingY = null;

    await loadTodayData();
    drawMato();
    renderShotHistory();
    renderHeatmap();

  } catch (error) {
    alert('保存に失敗しました：' + error.message);
    console.error(error);
  }
}

function switchTab(el, tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

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
  `).join('') + `<p class="heatmap-note">⚠ 押し手と引き込みを意識して練習しましょう。</p>`;
}

init();
