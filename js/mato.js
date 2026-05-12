// ============================================================
// mato.js  ―  的の位置記録画面の処理
// ============================================================

// ── 今日の知恵（日付で切り替わる格言） ──
const WISDOMS = [
  '「正射必中」－正しく射られた矢は、必ず的に当たる。',
  '「残心」－射終わった後も心を残し、気を抜かないこと。',
  '「弓は心の鏡」－射の乱れは心の乱れを映す。',
  '「会」－体と弓が一体となった瞬間を大切に。',
  '「離れ」－力を抜くのではなく、力が自然に放たれること。',
  '「的中よりも射形」－美しい射から的中は生まれる。',
  '「呼吸」－息を整えることが射を整える第一歩。',
];

// ── 状態変数 ──
let currentTab      = 'haya'; // 現在選択中の矢の種類
let pendingX        = null;   // クリック座標X（0〜1）、nullなら未クリック
let pendingY        = null;   // クリック座標Y（0〜1）
let shots           = [];     // 今日の着弾データ（Canvas描画用）
let currentSession  = 1;      // 現在の立ち番号
let currentArrowNum = 1;      // 現在の矢番号（1〜4）

// ヒートマップデータの初期値（データなし状態）
let heatmapData = [
  { zone: '右上 (Upper Right)', pct: 0 },
  { zone: '中心部 (Center)',    pct: 0 },
  { zone: '左下 (Lower Left)',  pct: 0 },
];


// ════════════════════════════════════════
//  初期化
// ════════════════════════════════════════

// ── ローディング中フラグ（true の間はボタン操作を無効にする） ──
let isLoading = true;

/**
 * ローディング状態を切り替える
 * データ取得中に矢を入力するとカウントがずれるため、完了まで入力を止める
 */
function setLoading(loading) {
  isLoading = loading;

  const btnAtari  = document.querySelector('.btn-atari');
  const btnHazure = document.querySelector('.btn-hazure');
  const area      = document.getElementById('mato-click-area');

  if (loading) {
    if (btnAtari)  { btnAtari.disabled  = true;  btnAtari.style.opacity  = '0.5'; }
    if (btnHazure) { btnHazure.disabled = true;  btnHazure.style.opacity = '0.5'; }
    if (area)      { area.style.pointerEvents = 'none'; area.style.cursor = 'wait'; }
    document.getElementById('session-name').textContent = '読み込み中...';
  } else {
    if (btnAtari)  { btnAtari.disabled  = false; btnAtari.style.opacity  = '1'; }
    if (btnHazure) { btnHazure.disabled = false; btnHazure.style.opacity = '1'; }
    if (area)      { area.style.pointerEvents = 'auto'; area.style.cursor = 'crosshair'; }
  }
}

async function init() {
  // まずセッションを確認（サーバー通信なし）
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '../index.html';
    return;
  }

  initSidebar(user); // utils.js

  document.getElementById('daily-wisdom').textContent =
    WISDOMS[new Date().getDate() % WISDOMS.length];

  setLoading(true); // 読み込み開始：ボタンを無効化
  try {
    await loadTodayData();
    drawMato();
    renderShotHistory();
    renderHeatmap();
  } catch (e) {
    console.error('初期化エラー:', e);
    // エラー内容をセッション名に表示してデバッグしやすくする
    const el = document.getElementById('session-name');
    if (el) el.textContent = 'データ取得に失敗しました';
  } finally {
    setLoading(false); // エラーが起きても必ず解除
  }
}


// ════════════════════════════════════════
//  今日のデータをSupabaseから取得
// ════════════════════════════════════════

async function loadTodayData() {
  try {
    const todayShots = await getTodayShots(); // supabase.js

    // 統計グリッドを更新
    const hits         = todayShots.filter(s => s.result).length;
    const total        = todayShots.length;
    const hitRate      = total > 0 ? Math.round(hits / total * 100) : 0;
    const sessionCount = new Set(todayShots.map(s => s.session_num)).size;

    document.getElementById('stat-hitrate').innerHTML   = `${hitRate}<span class="stat-unit">%</span>`;
    document.getElementById('stat-total').textContent   = total;
    document.getElementById('stat-hits').textContent    = hits;
    document.getElementById('stat-sessions').textContent = sessionCount;

    // 次の立ち・矢番号を計算
    const maxSession         = todayShots.length > 0 ? Math.max(...todayShots.map(s => s.session_num)) : 0;
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

    // 着弾データをCanvasとヒートマップに反映
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


// ════════════════════════════════════════
//  ヒートマップ計算
//  Canvas座標系：Y軸は下向き（dy > 0 = 画面下 = 的の下方向）
// ════════════════════════════════════════

function calcHeatmap(withPos) {
  const counts = { upperRight: 0, upperLeft: 0, lowerRight: 0, lowerLeft: 0, center: 0 };

  withPos.forEach(s => {
    const dx   = s.pos_x - 0.5; // + = 右
    const dy   = s.pos_y - 0.5; // + = 下
    const dist = Math.sqrt(dx * dx + dy * dy);

    if      (dist < 0.12)         counts.center++;
    else if (dx >= 0 && dy <  0)  counts.upperRight++;
    else if (dx <  0 && dy <  0)  counts.upperLeft++;
    else if (dx >= 0 && dy >= 0)  counts.lowerRight++;
    else                           counts.lowerLeft++;
  });

  const t = withPos.length;

  // 0%のゾーンは表示しない
  heatmapData = [
    { zone: '右上 (Upper Right)', pct: Math.round(counts.upperRight / t * 100) },
    { zone: '左上 (Upper Left)',  pct: Math.round(counts.upperLeft  / t * 100) },
    { zone: '右下 (Lower Right)', pct: Math.round(counts.lowerRight / t * 100) },
    { zone: '左下 (Lower Left)',  pct: Math.round(counts.lowerLeft  / t * 100) },
    { zone: '中心部 (Center)',    pct: Math.round(counts.center     / t * 100) },
  ].filter(d => d.pct > 0);

  if (heatmapData.length === 0) heatmapData = [{ zone: '中心部 (Center)', pct: 0 }];
}


// ════════════════════════════════════════
//  Canvas：的を描く
// ════════════════════════════════════════

const canvas   = document.getElementById('mato-canvas');
const ctx      = canvas.getContext('2d');
const CANVAS_W = canvas.width;
const CANVAS_H = canvas.height;
const CANVAS_CX = CANVAS_W / 2;
const CANVAS_CY = CANVAS_H / 2;

// 弓道の的（星的）：外枠=36cm、星（黒丸）=12cm
// canvasの幅を36cmとして比率を計算
const MATO_R  = CANVAS_W * 0.44;
const HOSHI_R = MATO_R * (12 / 36);

function drawMato() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // 背景（的の外エリア）
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

  // 星（黒丸）
  ctx.beginPath();
  ctx.arc(CANVAS_CX, CANVAS_CY, HOSHI_R, 0, Math.PI * 2);
  ctx.fillStyle   = '#1a1a1a';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth   = 1.5;
  ctx.fill();
  ctx.stroke();

  // 着弾マーカーを描画
  shots.forEach((shot, i) => {
    drawMarker(shot.x * CANVAS_W, shot.y * CANVAS_H, shot.result, i === shots.length - 1);
  });

  // ペンディングマーカー（クリック位置のプレビュー）
  if (pendingX !== null) {
    drawMarker(pendingX * CANVAS_W, pendingY * CANVAS_H, 'pending', true);
  }
}


// ════════════════════════════════════════
//  着弾マーカーを描く
//  atari(的中)  → 緑の丸●
//  hazure(失中) → 赤の×
//  pending      → オレンジの丸●（クリック後・確定前）
// ════════════════════════════════════════

function drawMarker(px, py, result, isHighlighted) {
  ctx.save();
  ctx.lineCap = 'round';

  if (result === 'atari') {
    // 緑の丸
    ctx.globalAlpha = isHighlighted ? 1 : 0.85;
    ctx.beginPath();
    ctx.arc(px, py, isHighlighted ? 8 : 6, 0, Math.PI * 2);
    ctx.fillStyle = '#2d7a5f';
    ctx.fill();

    // 強調リング
    if (isHighlighted) {
      ctx.beginPath();
      ctx.arc(px, py, 13, 0, Math.PI * 2);
      ctx.strokeStyle = '#2d7a5f';
      ctx.lineWidth   = 2;
      ctx.globalAlpha = 0.3;
      ctx.stroke();
    }

  } else if (result === 'hazure') {
    // 赤の×（白い影で視認性アップ）
    const s = isHighlighted ? 9 : 7;
    ctx.globalAlpha  = isHighlighted ? 1 : 0.9;
    ctx.strokeStyle  = '#c0392b';
    ctx.lineWidth    = isHighlighted ? 3 : 2.5;
    ctx.shadowColor  = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur   = 3;
    ctx.beginPath(); ctx.moveTo(px - s, py - s); ctx.lineTo(px + s, py + s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + s, py - s); ctx.lineTo(px - s, py + s); ctx.stroke();

  } else {
    // pending（オレンジ）
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


// ════════════════════════════════════════
//  クリックイベント（canvas全面でクリックを受け付ける）
// ════════════════════════════════════════

const clickArea = document.getElementById('mato-click-area');

clickArea.addEventListener('click', function(e) {
  // canvas の getBoundingClientRect で座標をcanvas比率に変換
  const rect = canvas.getBoundingClientRect();
  pendingX = (e.clientX - rect.left) / CANVAS_W;
  pendingY = (e.clientY - rect.top)  / CANVAS_H;
  updateHint(pendingX, pendingY);
  drawMato();
});

// マウス移動時にヒントテキストを更新
clickArea.addEventListener('mousemove', function(e) {
  const rect = canvas.getBoundingClientRect();
  updateHint((e.clientX - rect.left) / CANVAS_W, (e.clientY - rect.top) / CANVAS_H);
});


/**
 * 中心からの距離・方向をテキストで表示する
 * @param {number} rx - canvas比率のX（0〜1）
 * @param {number} ry - canvas比率のY（0〜1）
 */
function updateHint(rx, ry) {
  // 中心からの距離を実寸（cm）に換算
  // MATO_R = canvas上のピクセルが36cmに対応
  const dx       = (rx * CANVAS_W - CANVAS_CX) / MATO_R;
  const dy       = (ry * CANVAS_H - CANVAS_CY) / MATO_R;
  const distNorm = Math.sqrt(dx * dx + dy * dy);
  const distCm   = Math.round(distNorm * 18);
  const angle    = Math.round(Math.atan2(-dy, dx) * (180 / Math.PI));
  const clock    = angleToClock(angle);

  const hintEl = document.getElementById('mato-hint');
  if (distCm < 2) {
    hintEl.textContent = '● 的の中心付近';
  } else if (distNorm <= 1) {
    const inHoshi = distNorm < (12 / 36);
    hintEl.textContent = `● ${inHoshi ? '★ 星の中' : '的の中'}・中心から約${distCm}cm・${clock}方向`;
  } else {
    hintEl.textContent = `● 的の外側・中心から約${distCm}cm・${clock}方向`;
  }
}

/**
 * 数学的な角度（0=右、反時計回り）を時計の時刻に変換する
 * 例：90° → 12時、0° → 3時
 */
function angleToClock(deg) {
  let clock = ((90 - deg) / 30 + 12) % 12;
  if (clock <= 0) clock += 12;
  return `${Math.round(clock)}時`;
}


// ════════════════════════════════════════
//  的中・失中ボタン → Supabaseに保存
// ════════════════════════════════════════

async function recordResult(result) {
  // 読み込み中は入力を受け付けない（カウントずれ防止）
  if (isLoading) return;

  let storeX, storeY;

  if (pendingX !== null) {
    // クリックした位置を使う
    storeX = Math.max(0, Math.min(1, pendingX));
    storeY = Math.max(0, Math.min(1, pendingY));
  } else {
    // クリックなし：結果に応じてランダムな座標を生成
    if (result === 'atari') {
      storeX = 0.5 + (Math.random() - 0.5) * 0.15; // 中心付近
      storeY = 0.5 + (Math.random() - 0.5) * 0.15;
    } else {
      storeX = 0.5 + (Math.random() - 0.5) * 0.7; // 的の外
      storeY = 0.5 + (Math.random() - 0.5) * 0.7;
    }
  }

  setLoading(true); // 保存中も入力を止める

  try {
    await saveShot({ // supabase.js
      shot_date:   getLocalDateStr(), // utils.js
      session_num: currentSession,
      arrow_num:   currentArrowNum,
      arrow_type:  currentTab,
      result:      result === 'atari',
      pos_x:       storeX,
      pos_y:       storeY,
    });

    // ローカルの shots 配列にも追加（即座にCanvasに表示するため）
    shots.push({ tab: currentTab, x: storeX, y: storeY,
      result, label: result === 'atari' ? '的中' : '失中' });

    // 矢番号・立ちを進める
    currentArrowNum++;
    if (currentArrowNum > 4) { currentArrowNum = 1; currentSession++; }

    pendingX = null; pendingY = null;

    // 画面を再描画
    await loadTodayData();
    drawMato();
    renderShotHistory();
    renderHeatmap();

  } catch (error) {
    alert('保存に失敗しました：' + error.message);
    console.error(error);
  } finally {
    setLoading(false); // 成功・失敗どちらでも入力を再開
  }
}


// ════════════════════════════════════════
//  甲矢・乙矢タブ切替
// ════════════════════════════════════════

function switchTab(el, tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}


// ════════════════════════════════════════
//  射の履歴チップ（直近4射 + 次の矢）
// ════════════════════════════════════════

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


// ════════════════════════════════════════
//  ヒートマップ描画
// ════════════════════════════════════════

function renderHeatmap() {
  const list = document.getElementById('heatmap-list');

  if (heatmapData.every(d => d.pct === 0)) {
    list.innerHTML = '<p style="font-size:12px;color:#999;">クリックして着弾位置を記録してください。</p>';
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


// ── ページ読み込み時に初期化 ──
init();

// ════════════════════════════════════════
//  スマホ対応：Canvas を親要素に合わせてリサイズ
// ════════════════════════════════════════

/**
 * 画面幅に合わせて canvas のサイズを動的に変更する
 * スマホで的が画面からはみ出さないようにするため
 */
function resizeCanvas() {
  const area = document.getElementById('mato-click-area');
  if (!area) return;

  // 親要素の幅を取得（最大320pxに制限）
  const size = Math.min(area.clientWidth, 320);

  // canvas の実サイズを変更（描画内容はリセットされるので再描画が必要）
  canvas.width  = size;
  canvas.height = size;

  drawMato(); // リサイズ後に再描画
}

// ページ読み込み時とリサイズ時に実行
window.addEventListener('resize', resizeCanvas);
// DOMが完全に読み込まれてからサイズを取得する
window.addEventListener('load', resizeCanvas);
