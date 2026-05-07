/**
 * js/mato.js - 的の位置記録画面の処理
 *
 * 機能:
 *   - Canvas に弓道の的（星的）を描画する
 *   - クリックした位置を着弾点として記録する
 *   - 的の外側（外れ位置）もクリック可能
 *   - 着弾データを方向ごとに集計してヒートマップ表示
 *
 * 依存ファイル（HTML の script タグの順番）:
 *   1. supabase（CDN）
 *   2. js/supabase.js
 *   3. js/utils.js
 *   4. js/mato.js（このファイル）
 */

// ============================================================
// 今日の知恵（日替わり表示）
// ============================================================

// 7つの格言を用意し、日付の日（1〜31）の余りで選ぶ
const WISDOMS = [
  '「正射必中」－正しく射られた矢は、必ず的に当たる。',
  '「残心」－射終わった後も心を残し、気を抜かないこと。',
  '「弓は心の鏡」－射の乱れは心の乱れを映す。',
  '「会」－体と弓が一体となった瞬間を大切に。',
  '「離れ」－力を抜くのではなく、力が自然に放たれること。',
  '「的中よりも射形」－美しい射から的中は生まれる。',
  '「呼吸」－息を整えることが射を整える第一歩。',
];

// ============================================================
// 状態管理
// ============================================================

// 現在選択中の矢の種類（'haya'=甲矢 / 'otoya'=乙矢）
let currentTab = 'haya';

// クリック位置（Canvas上の比率 0〜1）
// ボタンを押すまでの仮確定位置。null = まだクリックしていない
let pendingX = null;
let pendingY = null;

// 今セッションで表示する着弾マーカーの配列
// { tab, x, y, result, label } の形式
let shots = [];

// 現在の立ち番号と矢番号
let currentSession  = 1;
let currentArrowNum = 1;

// ヒートマップ用データ（方向ごとの割合）
// calcHeatmap() で更新される
let heatmapData = [];

// ============================================================
// Canvas の定数
// ============================================================

const canvas    = document.getElementById('mato-canvas');
const ctx       = canvas.getContext('2d');
const CANVAS_W  = canvas.width;    // 320px
const CANVAS_H  = canvas.height;   // 320px
const CANVAS_CX = CANVAS_W / 2;    // 中心X（160px）
const CANVAS_CY = CANVAS_H / 2;    // 中心Y（160px）

// 実際の弓道星的のサイズ比率に合わせて半径を設定
// 星的：全体直径36cm、星（黒丸）直径12cm
const MATO_R  = CANVAS_W * 0.44;       // 的の外枠半径
const HOSHI_R = MATO_R * (12 / 36);    // 星（黒丸）の半径

// ============================================================
// 初期化
// ============================================================

async function init() {
  const user = await requireLogin(); // utils.js
  if (!user) return;

  updateSidebarUser(user); // utils.js

  // 今日の知恵を日付で選んで表示
  const wisdomEl = document.getElementById('daily-wisdom');
  if (wisdomEl) {
    wisdomEl.textContent = WISDOMS[new Date().getDate() % WISDOMS.length];
  }

  // Supabase から今日のデータを取得して状態を初期化
  await loadTodayData();

  // 初期描画
  drawMato();
  renderShotHistory();
  renderHeatmap();
}

// ============================================================
// データ取得・状態の更新
// ============================================================

/**
 * 今日の射データを Supabase から取得して各表示を更新する
 */
async function loadTodayData() {
  try {
    const todayShots = await getTodayShots(); // supabase.js

    // ── 統計グリッドの更新 ──
    const hits         = todayShots.filter(s => s.result).length;
    const total        = todayShots.length;
    const hitRate      = total > 0 ? Math.round(hits / total * 100) : 0;
    const sessionCount = new Set(todayShots.map(s => s.session_num)).size;

    const el = id => document.getElementById(id);
    if (el('stat-hitrate'))  el('stat-hitrate').innerHTML  = `${hitRate}<span class="stat-unit">%</span>`;
    if (el('stat-total'))    el('stat-total').textContent   = total;
    if (el('stat-hits'))     el('stat-hits').textContent    = hits;
    if (el('stat-sessions')) el('stat-sessions').textContent = sessionCount;

    // ── 現在の立ち・矢番号を計算 ──
    // 最大のセッション番号と、そのセッションの射数から次の矢番号を求める
    const maxSession         = todayShots.length > 0
      ? Math.max(...todayShots.map(s => s.session_num))
      : 0;
    const shotsInLastSession = todayShots.filter(s => s.session_num === maxSession).length;

    if (maxSession === 0) {
      // まだ1射も記録していない
      currentSession  = 1;
      currentArrowNum = 1;
    } else if (shotsInLastSession >= 4) {
      // 最後の立ちが4本終わっている → 次の立ちへ
      currentSession  = maxSession + 1;
      currentArrowNum = 1;
    } else {
      // 途中の立ち
      currentSession  = maxSession;
      currentArrowNum = shotsInLastSession + 1;
    }

    const sessionNameEl = document.getElementById('session-name');
    if (sessionNameEl) {
      sessionNameEl.textContent = `第${currentSession}立・${currentArrowNum}射目`;
    }

    // ── 着弾データの整理 ──
    const withPos = todayShots.filter(s => s.pos_x !== null && s.pos_y !== null);
    if (withPos.length > 0) {
      calcHeatmap(withPos); // ヒートマップ計算
      // Canvas に描くマーカーは最新8射分まで表示
      shots = withPos.slice(-8).map(s => ({
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

/**
 * 着弾位置のデータから各方向の割合を計算する
 *
 * Canvas の座標系:
 *   - pos_x: 左=0.0、右=1.0
 *   - pos_y: 上=0.0、下=1.0（Y軸は下向き）
 *   - 中心:  (0.5, 0.5)
 *
 * 方向の定義（Canvas座標基準）:
 *   - 右上: dx > 0 かつ dy < 0
 *   - 左上: dx < 0 かつ dy < 0
 *   - 右下: dx > 0 かつ dy > 0
 *   - 左下: dx < 0 かつ dy > 0
 *   - 中心: 中心からの距離 < 0.12（全体の約12%以内）
 *
 * @param {Array} withPos - pos_x と pos_y が記録されている射データ
 */
function calcHeatmap(withPos) {
  const counts = { upperRight: 0, upperLeft: 0, lowerRight: 0, lowerLeft: 0, center: 0 };

  withPos.forEach(s => {
    const dx   = s.pos_x - 0.5; // 中心からの水平距離（+ = 右）
    const dy   = s.pos_y - 0.5; // 中心からの垂直距離（+ = 下）
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.12) {
      counts.center++;
    } else if (dx >= 0 && dy < 0) {
      counts.upperRight++;
    } else if (dx < 0  && dy < 0) {
      counts.upperLeft++;
    } else if (dx >= 0 && dy >= 0) {
      counts.lowerRight++;
    } else {
      counts.lowerLeft++;
    }
  });

  const t = withPos.length;

  // 割合が 0% の方向は表示しない
  heatmapData = [
    { zone: '右上 (Upper Right)', pct: Math.round(counts.upperRight / t * 100) },
    { zone: '左上 (Upper Left)',  pct: Math.round(counts.upperLeft  / t * 100) },
    { zone: '右下 (Lower Right)', pct: Math.round(counts.lowerRight / t * 100) },
    { zone: '左下 (Lower Left)',  pct: Math.round(counts.lowerLeft  / t * 100) },
    { zone: '中心部 (Center)',    pct: Math.round(counts.center     / t * 100) },
  ].filter(d => d.pct > 0);
}

// ============================================================
// Canvas：的の描画
// ============================================================

/**
 * Canvas に弓道の的（星的）と着弾マーカーを描く
 * 状態が変わるたびに呼び出す
 */
function drawMato() {
  // Canvas をクリア
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // グレーの背景（的の外エリア）
  ctx.fillStyle = '#f0f2f1';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // ── 的の本体を描く ──

  // 外枠の白い大円
  ctx.beginPath();
  ctx.arc(CANVAS_CX, CANVAS_CY, MATO_R, 0, Math.PI * 2);
  ctx.fillStyle   = '#ffffff';
  ctx.strokeStyle = '#444444';
  ctx.lineWidth   = 3;
  ctx.fill();
  ctx.stroke();

  // 星（中央の黒丸）
  ctx.beginPath();
  ctx.arc(CANVAS_CX, CANVAS_CY, HOSHI_R, 0, Math.PI * 2);
  ctx.fillStyle   = '#1a1a1a';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth   = 1.5;
  ctx.fill();
  ctx.stroke();

  // ── 着弾マーカーを描く ──

  // 保存済みの射（古いものは薄く表示）
  shots.forEach((shot, i) => {
    const px = shot.x * CANVAS_W;
    const py = shot.y * CANVAS_H;
    const isLatest = (i === shots.length - 1); // 一番新しい射
    drawMarker(px, py, shot.result, isLatest);
  });

  // クリック済みだが結果ボタン未押しの仮確定マーカー（オレンジ）
  if (pendingX !== null) {
    drawMarker(pendingX * CANVAS_W, pendingY * CANVAS_H, 'pending', true);
  }
}

/**
 * 着弾マーカーを Canvas に描く
 *
 * マーカーの種類:
 *   'atari'  → 緑の●（的中）
 *   'hazure' → 赤の×（失中）
 *   'pending'→ オレンジの●（クリック位置の仮確定）
 *
 * @param {number}  px            - X座標（px）
 * @param {number}  py            - Y座標（px）
 * @param {string}  result        - 'atari' / 'hazure' / 'pending'
 * @param {boolean} isHighlighted - true のとき大きく・濃く表示する
 */
function drawMarker(px, py, result, isHighlighted) {
  ctx.save(); // 描画状態を保存（restore で元に戻す）

  if (result === 'atari') {
    // ── 的中：緑の● ──
    const r       = isHighlighted ? 8 : 6;
    ctx.globalAlpha = isHighlighted ? 1.0 : 0.85;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = '#2d7a5f';
    ctx.fill();

    // 強調時は外側にリングを追加
    if (isHighlighted) {
      ctx.beginPath();
      ctx.arc(px, py, r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#2d7a5f';
      ctx.lineWidth   = 2;
      ctx.globalAlpha = 0.3;
      ctx.stroke();
    }

  } else if (result === 'hazure') {
    // ── 失中：赤の× ──
    const s         = isHighlighted ? 9 : 7; // × の大きさ
    ctx.globalAlpha = isHighlighted ? 1.0 : 0.9;
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth   = isHighlighted ? 3 : 2.5;
    ctx.lineCap     = 'round';
    // 白い発光で × を際立たせる
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur  = 3;
    ctx.beginPath();
    ctx.moveTo(px - s, py - s); ctx.lineTo(px + s, py + s); // ＼
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + s, py - s); ctx.lineTo(px - s, py + s); // ／
    ctx.stroke();

  } else {
    // ── 仮確定（pending）：オレンジの● ──
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fillStyle   = '#f0a500';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2;
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore(); // 描画状態を元に戻す
}

// ============================================================
// クリックイベント
// ============================================================

// canvas と同じサイズのクリックエリア（的の外もクリック可能）
const clickArea = document.getElementById('mato-click-area');

/**
 * クリックで着弾位置を仮確定する
 * 実際の保存は「的中」「失中」ボタンを押したときに行う
 */
clickArea.addEventListener('click', function(e) {
  const rect = canvas.getBoundingClientRect(); // Canvas の画面上の位置

  // クリック座標を 0〜1 の比率に変換（Canvas サイズ基準）
  pendingX = (e.clientX - rect.left)  / CANVAS_W;
  pendingY = (e.clientY - rect.top)   / CANVAS_H;

  updateHint(pendingX, pendingY);
  drawMato(); // マーカーを更新
});

/**
 * マウス移動でヒントテキストをリアルタイム更新する
 */
clickArea.addEventListener('mousemove', function(e) {
  const rect = canvas.getBoundingClientRect();
  updateHint(
    (e.clientX - rect.left)  / CANVAS_W,
    (e.clientY - rect.top)   / CANVAS_H
  );
});

/**
 * 着弾位置のヒントテキストを更新する
 * 「中心から何cm、何時方向」を表示する
 *
 * @param {number} rx - Canvas 上の X 比率（0〜1）
 * @param {number} ry - Canvas 上の Y 比率（0〜1）
 */
function updateHint(rx, ry) {
  const px = rx * CANVAS_W;
  const py = ry * CANVAS_H;

  // 的の中心（CANVAS_CX, CANVAS_CY）からの距離を計算
  const dx       = (px - CANVAS_CX) / MATO_R; // 的の半径を1とした比率
  const dy       = (py - CANVAS_CY) / MATO_R;
  const distNorm = Math.sqrt(dx * dx + dy * dy); // 0〜1（的の外なら1超える）
  const distCm   = Math.round(distNorm * 18);    // 的の半径=18cmで換算

  // 時計方向を計算（Y軸が下向きなので -dy で反転）
  const angle = Math.round(Math.atan2(-dy, dx) * (180 / Math.PI));
  const clock = angleToClock(angle); // utils.js

  const hintEl = document.getElementById('mato-hint');
  if (!hintEl) return;

  if (distCm < 2) {
    hintEl.textContent = '● 的の中心付近';
  } else if (distNorm <= 1) {
    const inHoshi = distNorm < (12 / 36); // 星（黒丸）の内側かどうか
    hintEl.textContent = `● ${inHoshi ? '★ 星の中' : '的の中'}・中心から約${distCm}cm・${clock}方向`;
  } else {
    hintEl.textContent = `● 的の外側・中心から約${distCm}cm・${clock}方向`;
  }
}

// ============================================================
// 的中・失中ボタン → Supabase に保存
// ============================================================

/**
 * 「的中」「失中」ボタンのクリックハンドラ
 * HTML の onclick="recordResult('atari')" / onclick="recordResult('hazure')" から呼ばれる
 *
 * @param {string} result - 'atari'（的中）または 'hazure'（失中）
 */
async function recordResult(result) {
  let storeX, storeY;

  if (pendingX !== null) {
    // クリックした位置をそのまま使う（0〜1 の比率）
    storeX = Math.max(0, Math.min(1, pendingX));
    storeY = Math.max(0, Math.min(1, pendingY));
  } else {
    // クリックなしでボタンだけ押した場合はランダム位置
    // 的中 → 中心付近、失中 → 的の外寄り
    if (result === 'atari') {
      storeX = 0.5 + (Math.random() - 0.5) * 0.15;
      storeY = 0.5 + (Math.random() - 0.5) * 0.15;
    } else {
      storeX = 0.5 + (Math.random() - 0.5) * 0.7;
      storeY = 0.5 + (Math.random() - 0.5) * 0.7;
    }
  }

  try {
    await saveShot({ // supabase.js
      shot_date:   getLocalDateStr(), // utils.js
      session_num: currentSession,
      arrow_num:   currentArrowNum,
      arrow_type:  currentTab,        // 'haya' or 'otoya'
      result:      result === 'atari', // true or false
      pos_x:       storeX,
      pos_y:       storeY,
    });

    // 画面用の配列に追加
    shots.push({
      tab:    currentTab,
      x:      storeX,
      y:      storeY,
      result: result,
      label:  result === 'atari' ? '的中' : '失中',
    });

    // 矢番号を進める（4本射ったら次の立ちへ）
    currentArrowNum++;
    if (currentArrowNum > 4) {
      currentArrowNum = 1;
      currentSession++;
    }

    // クリック位置をリセット
    pendingX = null;
    pendingY = null;

    // 画面をすべて更新
    await loadTodayData();
    drawMato();
    renderShotHistory();
    renderHeatmap();

  } catch (error) {
    alert('保存に失敗しました：' + error.message);
    console.error(error);
  }
}

// ============================================================
// タブ切り替え（甲矢 / 乙矢）
// ============================================================

/**
 * 甲矢・乙矢タブの切り替えハンドラ
 * HTML の onclick="switchTab(this, 'haya')" から呼ばれる
 *
 * @param {HTMLElement} el  - クリックされたタブ要素
 * @param {string}      tab - 'haya'（甲矢）または 'otoya'（乙矢）
 */
function switchTab(el, tab) {
  currentTab = tab;
  // 全タブから active を外して、クリックされたタブに付ける
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

// ============================================================
// 射の履歴チップ（直近の射を横並びで表示）
// ============================================================

/**
 * 射の履歴チップを描画する
 * 直近4射 + 現在入力中（CURRENT）を表示する
 */
function renderShotHistory() {
  const container = document.getElementById('shot-history');
  if (!container) return;

  const display = shots.slice(-4); // 直近4射

  // CURRENT（次に打つ矢）を末尾に追加
  const items = [
    ...display,
    { tab: currentTab, result: 'pending', label: '…', current: true },
  ];

  container.innerHTML = items.map((shot, i) => {
    const isCurrent   = shot.current;
    const tabLabel    = shot.tab === 'haya' ? 'Haya' : 'Otoya';
    const shotNum     = isCurrent ? 'CURRENT' : `SHOT ${i + 1}`;
    // 色分け：的中=緑、失中=グレー、未入力=薄いテキスト
    const resultClass = shot.result === 'atari'  ? 'hit'
                      : shot.result === 'hazure' ? 'miss'
                      : 'pending';

    return `
      <div class="shot-chip ${isCurrent ? 'current' : ''}">
        <span class="chip-shot-label">${shotNum}</span>
        <span class="chip-shot-result ${resultClass}">${shot.label}</span>
        <span class="chip-shot-sub">${tabLabel}</span>
      </div>
    `;
  }).join('');
}

// ============================================================
// ヒートマップ表示
// ============================================================

/**
 * 着弾分析（ヒートマップ）を描画する
 * データがない場合はメッセージを表示する
 */
function renderHeatmap() {
  const list = document.getElementById('heatmap-list');
  if (!list) return;

  if (heatmapData.length === 0) {
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
  `).join('') + `
    <p class="heatmap-note">⚠ 押し手と引き込みを意識して練習しましょう。</p>
  `;
}

// ページ読み込み時に初期化を実行
init();
