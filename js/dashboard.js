/**
 * js/dashboard.js - ダッシュボード画面の処理
 *
 * 機能:
 *   - 今日の的中率・セッション表示
 *   - 矢ボタン（○/×）のクリックで入力
 *   - 「保存」ボタンで Supabase に記録を送信
 *   - 練習ログ（過去3日分）の表示
 *
 * 依存ファイル（HTML の script タグの順番）:
 *   1. supabase（CDN）
 *   2. js/supabase.js
 *   3. js/utils.js
 *   4. js/dashboard.js（このファイル）
 */

// ============================================================
// 状態管理（このページで使う変数）
// ============================================================

// 現在の立ち番号（1から始まる）
let currentSession = 1;

// 現在入力中の矢の状態
// null = 未入力、true = 的中、false = 失中
let arrows = [null, null, null, null];

// 今日のセッション一覧（画面上部のSESSION 1, 2...の表示に使う）
let sessions = [];

// ============================================================
// 初期化
// ============================================================

/**
 * ページ読み込み時に呼ばれる初期化関数
 */
async function init() {
  // 未ログインならログインページへ
  const user = await requireLogin(); // utils.js
  if (!user) return;

  // サイドバーのユーザー情報を更新
  updateSidebarUser(user); // utils.js

  // Supabase からデータを取得して画面を更新
  await loadTodayData();
  renderArrows();
  await renderLogs();
}

// ============================================================
// データ取得・画面更新
// ============================================================

/**
 * 今日のデータを Supabase から取得して画面を更新する
 */
async function loadTodayData() {
  try {
    const shots = await getTodayShots(); // supabase.js

    // 立ちごとに集計する
    // 例: { 1: { hits: 3, total: 4 }, 2: { hits: 2, total: 4 } }
    const sessionMap = {};
    shots.forEach(shot => {
      if (!sessionMap[shot.session_num]) {
        sessionMap[shot.session_num] = { hits: 0, total: 0 };
      }
      sessionMap[shot.session_num].total++;
      if (shot.result) sessionMap[shot.session_num].hits++;
    });

    // セッション番号の昇順で sessions 配列を作る
    sessions = Object.entries(sessionMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([num, data]) => ({
        label: `SESSION ${num}`,
        hits:  data.hits,
        total: data.total,
      }));

    // 次の立ち番号を計算（既存セッション数 + 1）
    currentSession = Object.keys(sessionMap).length + 1;

    renderSessions();
    renderAccuracy();
    updateRecordSub();
    updateFormStatus(shots);

  } catch (error) {
    console.error('データ取得エラー:', error);
    // エラー時は空状態で表示
    renderSessions();
    renderAccuracy();
  }
}

/**
 * 射形ステータスを更新する
 * 直近4射の的中率でコメントを変える
 *
 * @param {Array} shots - 今日の全射データ
 */
function updateFormStatus(shots) {
  const statusEl = document.getElementById('form-status');
  if (!statusEl) return;

  if (shots.length === 0) {
    statusEl.textContent = '記録なし';
    return;
  }

  // 直近4射で判定
  const recent = shots.slice(-4);
  const hits   = recent.filter(s => s.result).length;
  const rate   = hits / recent.length;

  // 的中率によってコメントを変える
  const status = rate >= 0.75 ? '安定した射位'
               : rate >= 0.5  ? '調整が必要'
               : '要集中';

  statusEl.textContent = status;
}

// ============================================================
// 画面描画（render）関数群
// ============================================================

/**
 * セッション行（SESSION 1, 2...の表示）を描画する
 */
function renderSessions() {
  const row = document.getElementById('session-row');
  if (!row) return;

  if (sessions.length === 0) {
    row.innerHTML = '<span style="font-size:12px;color:#999;">まだ記録がありません</span>';
    return;
  }

  row.innerHTML = sessions.map(s => {
    // 全的中（4/4など）のとき緑色で表示
    const isAll = s.hits === s.total;
    return `
      <div class="session-chip">
        <span class="chip-label">${s.label}</span>
        <span class="chip-val ${isAll ? 'hit' : ''}">${s.hits}/${s.total}</span>
      </div>
    `;
  }).join('');
}

/**
 * 今日の的中率（%）を計算して表示する
 */
function renderAccuracy() {
  const totalHits  = sessions.reduce((sum, s) => sum + s.hits,  0);
  const totalShots = sessions.reduce((sum, s) => sum + s.total, 0);
  const pct        = totalShots > 0 ? Math.round(totalHits / totalShots * 100) : 0;

  const el = document.getElementById('today-pct');
  if (el) el.textContent = pct;
}

/**
 * 「現在の立ち：第○局（○射目〜○射目）」を更新する
 */
function updateRecordSub() {
  const start = (currentSession - 1) * 4 + 1; // 例: 第2局 → 5射目
  const end   = currentSession * 4;            // 例: 第2局 → 8射目

  const el = document.getElementById('record-sub');
  if (el) el.textContent = `現在の立ち：第${currentSession}局（${start}射目〜${end}射目）`;
}

/**
 * 矢ボタン（1〜4）を描画する
 * 状態に応じて見た目を変える：
 *   null  → 番号のみ（未入力）
 *   true  → ○（的中）
 *   false → ×（失中）
 */
function renderArrows() {
  const grid = document.getElementById('arrow-grid');
  if (!grid) return;

  grid.innerHTML = arrows.map((state, i) => {
    let label, className;

    if (state === true) {
      label     = '○';
      className = 'arrow-btn state-hit';
    } else if (state === false) {
      label     = '×';
      className = 'arrow-btn state-miss';
    } else {
      label     = i + 1; // 未入力は番号を表示
      className = 'arrow-btn';
    }

    return `
      <button class="${className}" onclick="toggleArrow(${i})">
        ${label}
        <span class="arrow-num">${i + 1}</span>
      </button>
    `;
  }).join('');
}

/**
 * 矢ボタンをクリックしたときの状態切り替え
 * null → true（的中）→ false（失中）→ null（リセット）の順に切り替わる
 *
 * @param {number} index - クリックした矢のインデックス（0〜3）
 */
function toggleArrow(index) {
  if      (arrows[index] === null)  arrows[index] = true;
  else if (arrows[index] === true)  arrows[index] = false;
  else                              arrows[index] = null;

  renderArrows(); // ボタンの見た目を更新
}

/**
 * 練習ログ（過去3日分）を Supabase から取得して表示する
 */
async function renderLogs() {
  const list = document.getElementById('log-list');
  if (!list) return;

  try {
    const shots = await getRecentShots(30); // supabase.js

    if (shots.length === 0) {
      list.innerHTML = '<p style="font-size:13px;color:#999;padding:12px 0;">練習ログがまだありません</p>';
      return;
    }

    // 日付ごとにデータを集計する
    const dayMap = {};
    shots.forEach(shot => {
      const date = shot.shot_date;
      if (!dayMap[date]) dayMap[date] = { hits: 0, total: 0, results: [] };
      dayMap[date].total++;
      if (shot.result) dayMap[date].hits++;
      dayMap[date].results.push(shot.result);
    });

    // 最新3日分を降順で取得
    const days = Object.entries(dayMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 3);

    list.innerHTML = days.map(([date, data]) => {
      const { month, day } = parseDateStr(date); // utils.js
      const pct  = Math.round(data.hits / data.total * 100);

      // 直近4射分のドットを表示（緑=的中、グレー=失中）
      const dots = data.results.slice(-4)
        .map(hit => `<div class="dot ${hit ? 'hit' : 'miss'}"></div>`)
        .join('');

      return `
        <div class="log-item">
          <div class="log-date">
            <span class="log-month">${month}</span>
            <span class="log-day">${day}</span>
          </div>
          <div class="log-bar"></div>
          <div class="log-info">
            <p class="log-title">練習記録</p>
            <p class="log-detail">${data.total}射 ${data.hits}中｜中率 ${pct}%</p>
          </div>
          <div class="log-dots">${dots}</div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('ログ取得エラー:', error);
    list.innerHTML = '<p style="font-size:13px;color:#999;padding:12px 0;">ログの取得に失敗しました</p>';
  }
}

// ============================================================
// 保存処理
// ============================================================

/**
 * 「保存」ボタンのクリックハンドラ
 * 入力された矢の記録を Supabase に送信する
 */
async function saveRecord() {
  // 1本も入力されていない場合はスキップ
  const recorded = arrows.filter(a => a !== null);
  if (recorded.length === 0) {
    alert('まだ記録がありません');
    return;
  }

  // ボタンをローディング状態にして二重送信を防ぐ
  const btn       = document.querySelector('.btn-save');
  btn.textContent = '保存中...';
  btn.disabled    = true;

  try {
    const today = getLocalDateStr(); // utils.js

    // 入力された矢を1本ずつ Supabase に保存する
    for (let i = 0; i < arrows.length; i++) {
      if (arrows[i] === null) continue; // 未入力の矢はスキップ

      await saveShot({ // supabase.js
        shot_date:   today,
        session_num: currentSession,
        arrow_num:   i + 1,
        // 1・3本目=甲矢（haya）、2・4本目=乙矢（otoya）
        arrow_type:  i % 2 === 0 ? 'haya' : 'otoya',
        result:      arrows[i],
        pos_x:       null, // 位置はMato画面で記録するため null
        pos_y:       null,
      });
    }

    const hits = arrows.filter(a => a === true).length;
    alert(`保存しました！${hits}/${recorded.length}中`);

    // 保存後：矢をリセットして次の立ちへ進む
    arrows         = [null, null, null, null];
    currentSession++;

    // 画面を更新
    await loadTodayData();
    renderArrows();
    await renderLogs();

  } catch (error) {
    alert('保存に失敗しました：' + error.message);
    console.error(error);
  } finally {
    // 成功・失敗どちらでもボタンを元に戻す
    btn.textContent = '保存';
    btn.disabled    = false;
  }
}

// ページ読み込み時に初期化を実行
init();
