// ===========================
// KYUDO DOJO - ダッシュボード
// ===========================

let currentSession = 1;
let arrows = [null, null, null, null];
let sessions = [];

// ──────────────────────────────
// ページ読み込み時の処理
// ──────────────────────────────
async function init() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  await loadTodayData();
  renderArrows();
  await renderLogs(); // ← 実データに変更
}

// ──────────────────────────────
// 今日のデータをSupabaseから取得
// ──────────────────────────────
async function loadTodayData() {
  try {
    const shots = await getTodayShots();

    const sessionMap = {};
    shots.forEach(shot => {
      if (!sessionMap[shot.session_num]) {
        sessionMap[shot.session_num] = { hits: 0, total: 0 };
      }
      sessionMap[shot.session_num].total++;
      if (shot.result) sessionMap[shot.session_num].hits++;
    });

    sessions = Object.entries(sessionMap).map(([num, data]) => ({
      label: `SESSION ${num}`,
      hits:  data.hits,
      total: data.total,
    }));

    currentSession = Object.keys(sessionMap).length + 1;

    renderSessions();
    renderAccuracy();
    updateRecordSub();

  } catch (error) {
    console.error('データ取得エラー:', error);
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

  const btn = document.querySelector('.btn-save');
  btn.textContent = '保存中...';
  btn.disabled    = true;

  try {
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < arrows.length; i++) {
      if (arrows[i] === null) continue;
      await saveShot({
        shot_date:   today,
        session_num: currentSession,
        arrow_num:   i + 1,
        arrow_type:  i % 2 === 0 ? 'haya' : 'otoya',
        result:      arrows[i],
        pos_x:       null,
        pos_y:       null,
      });
    }

    const hits = arrows.filter(a => a === true).length;
    alert(`保存しました！${hits}/${recorded.length}中`);

    arrows = [null, null, null, null];
    currentSession++;
    await loadTodayData();
    renderArrows();
    await renderLogs();

  } catch (error) {
    alert('保存に失敗しました：' + error.message);
    console.error(error);
  } finally {
    btn.textContent = '保存';
    btn.disabled    = false;
  }
}

// ──────────────────────────────
// 練習ログをSupabaseの実データで描画
// ──────────────────────────────
async function renderLogs() {
  const list = document.getElementById('log-list');

  try {
    // 過去30日のデータを取得して日別に集計
    const shots = await getRecentShots(30);

    if (shots.length === 0) {
      list.innerHTML = '<p style="font-size:13px;color:#999;padding:12px 0;">練習ログがまだありません</p>';
      return;
    }

    // 日付ごとにグループ化
    const dayMap = {};
    shots.forEach(shot => {
      const date = shot.shot_date;
      if (!dayMap[date]) dayMap[date] = { hits: 0, total: 0, results: [] };
      dayMap[date].total++;
      if (shot.result) dayMap[date].hits++;
      dayMap[date].results.push(shot.result);
    });

    // 日付の降順で最新3日を表示
    const days = Object.entries(dayMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 3);

    list.innerHTML = days.map(([date, data]) => {
      const d     = new Date(date);
      const month = d.toLocaleString('en', { month: 'short' }).toUpperCase();
      const day   = d.getDate();
      const pct   = Math.round(data.hits / data.total * 100);

      // 直近4射分のドットを表示
      const dots = data.results.slice(-4).map(hit =>
        `<div class="dot ${hit ? 'hit' : 'miss'}"></div>`
      ).join('');

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

// ──────────────────────────────
// 初期化
// ──────────────────────────────
init();
