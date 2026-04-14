// ===========================
// KYUDO DOJO - ダッシュボード
// ===========================

// ──────────────────────────────
// 状態管理
// ──────────────────────────────

// 現在の立ち番号
let currentSession = 1;

// 現在の矢の状態（null=未入力, true=的中, false=失中）
let arrows = [null, null, null, null];

// 今日のセッションデータ（Supabaseから取得して更新）
let sessions = [];

// ──────────────────────────────
// ページ読み込み時の処理
// ──────────────────────────────
async function init() {
  // ログインチェック
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // 今日のデータをSupabaseから取得
  await loadTodayData();
  renderArrows();
  renderLogs();
}

// ──────────────────────────────
// 今日のデータをSupabaseから取得
// ──────────────────────────────
async function loadTodayData() {
  try {
    const shots = await getTodayShots();

    // セッションごとに集計
    const sessionMap = {};
    shots.forEach(shot => {
      if (!sessionMap[shot.session_num]) {
        sessionMap[shot.session_num] = { hits: 0, total: 0 };
      }
      sessionMap[shot.session_num].total++;
      if (shot.result) sessionMap[shot.session_num].hits++;
    });

    // sessionsを更新
    sessions = Object.entries(sessionMap).map(([num, data]) => ({
      label: `SESSION ${num}`,
      hits:  data.hits,
      total: data.total,
    }));

    // 現在の立ち番号を更新
    currentSession = Object.keys(sessionMap).length + 1;

    renderSessions();
    renderAccuracy();
    updateRecordSub();

  } catch (error) {
    console.error('データ取得エラー:', error);
    // エラー時はダミーデータで表示
    renderSessions();
    renderAccuracy();
  }
}

// ──────────────────────────────
// セッション行を描画
// ──────────────────────────────
function renderSessions() {
  const row = document.getElementById('session-row');
  if (sessions.length === 0) {
    row.innerHTML = '<span style="font-size:12px;color:#999;">まだ記録がありません</span>';
    return;
  }
  row.innerHTML = sessions.map(s => {
    const isAll = s.hits === s.total;
    return `
      <div class="session-chip">
        <span class="chip-label">${s.label}</span>
        <span class="chip-val ${isAll ? 'hit' : ''}">${s.hits}/${s.total}</span>
      </div>
    `;
  }).join('');
}

// ──────────────────────────────
// 的中率を計算して表示
// ──────────────────────────────
function renderAccuracy() {
  const totalHits  = sessions.reduce((sum, s) => sum + s.hits,  0);
  const totalShots = sessions.reduce((sum, s) => sum + s.total, 0);
  const pct = totalShots > 0 ? Math.round(totalHits / totalShots * 100) : 0;
  document.getElementById('today-pct').textContent = pct;
}

// ──────────────────────────────
// 立ちの表示を更新
// ──────────────────────────────
function updateRecordSub() {
  const start = (currentSession - 1) * 4 + 1;
  const end   = currentSession * 4;
  document.getElementById('record-sub').textContent =
    `現在の立ち：第${currentSession}局（${start}射目〜${end}射目）`;
}

// ──────────────────────────────
// 矢ボタンを描画
// ──────────────────────────────
function renderArrows() {
  const grid = document.getElementById('arrow-grid');
  grid.innerHTML = arrows.map((state, i) => {
    let label, className;
    if (state === true)       { label = '○'; className = 'arrow-btn state-hit'; }
    else if (state === false) { label = '×'; className = 'arrow-btn state-miss'; }
    else                      { label = i + 1; className = 'arrow-btn'; }

    return `
      <button class="${className}" onclick="toggleArrow(${i})">
        ${label}
        <span class="arrow-num">${i + 1}</span>
      </button>
    `;
  }).join('');
}

// ──────────────────────────────
// 矢ボタンをクリック
// null → true → false → null
// ──────────────────────────────
function toggleArrow(index) {
  if (arrows[index] === null)       arrows[index] = true;
  else if (arrows[index] === true)  arrows[index] = false;
  else                              arrows[index] = null;
  renderArrows();
}

// ──────────────────────────────
// 保存ボタン → Supabaseに保存
// ──────────────────────────────
async function saveRecord() {
  const recorded = arrows.filter(a => a !== null);
  if (recorded.length === 0) {
    alert('まだ記録がありません');
    return;
  }

  const btn  = document.querySelector('.btn-save');
  btn.textContent = '保存中...';
  btn.disabled    = true;

  try {
    const today = new Date().toISOString().split('T')[0];

    // 矢1本ずつSupabaseに保存
    for (let i = 0; i < arrows.length; i++) {
      if (arrows[i] === null) continue;

      await saveShot({
        shot_date:   today,
        session_num: currentSession,
        arrow_num:   i + 1,
        arrow_type:  i % 2 === 0 ? 'haya' : 'otoya', // 1,3本目=甲矢 / 2,4本目=乙矢
        result:      arrows[i],
        pos_x:       null,
        pos_y:       null,
      });
    }

    // 保存成功
    const hits = arrows.filter(a => a === true).length;
    alert(`保存しました！${hits}/${recorded.length}中`);

    // 矢をリセットして次の立ちへ
    arrows = [null, null, null, null];
    currentSession++;
    await loadTodayData();
    renderArrows();

  } catch (error) {
    alert('保存に失敗しました：' + error.message);
    console.error(error);
  } finally {
    btn.textContent = '保存';
    btn.disabled    = false;
  }
}

// ──────────────────────────────
// 練習ログを描画（ダミーデータ）
// 後でSupabaseから取得するように変更予定
// ──────────────────────────────
function renderLogs() {
  const logs = [
    { month: 'OCT', day: 24, title: '午後の稽古', detail: '20射 16中｜中率 80%', dots: [true, true, true, false] },
    { month: 'OCT', day: 22, title: '朝の稽古',   detail: '12射 9中｜中率 75%',  dots: [true, true, false, true] },
    { month: 'OCT', day: 20, title: '道場練習',   detail: '16射 10中｜中率 63%', dots: [true, false, true, false] },
  ];

  const list = document.getElementById('log-list');
  list.innerHTML = logs.map(log => {
    const dots = log.dots.map(hit =>
      `<div class="dot ${hit ? 'hit' : 'miss'}"></div>`
    ).join('');
    return `
      <div class="log-item">
        <div class="log-date">
          <span class="log-month">${log.month}</span>
          <span class="log-day">${log.day}</span>
        </div>
        <div class="log-bar"></div>
        <div class="log-info">
          <p class="log-title">${log.title}</p>
          <p class="log-detail">${log.detail}</p>
        </div>
        <div class="log-dots">${dots}</div>
      </div>
    `;
  }).join('');
}

// ──────────────────────────────
// 初期化
// ──────────────────────────────
init();
