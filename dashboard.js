// ===========================
// KYUDO DOJO - ダッシュボード
// ===========================

// ──────────────────────────────
// データ（後でSupabaseから取得する）
// ──────────────────────────────

// 今日のセッションデータ（例）
const sessions = [
  { label: 'SESSION 1', hits: 4, total: 4 },
  { label: 'SESSION 2', hits: 3, total: 4 },
  { label: 'SESSION 3', hits: 4, total: 4 },
  { label: 'SESSION 4', hits: 1, total: 4 },
];

// 現在の立ち：5矢ぶん入力できる
// null=未入力, true=的中, false=失中
let arrows = [true, true, null, null, null];

// 練習ログ（例）
const logs = [
  { month: 'OCT', day: 24, title: '午後の稽古', detail: '20射 16中｜中率 80%', dots: [true, true, true, false] },
  { month: 'OCT', day: 22, title: '朝の稽古',   detail: '12射 9中｜中率 75%',  dots: [true, true, false, true] },
  { month: 'OCT', day: 20, title: '道場練習',   detail: '16射 10中｜中率 63%', dots: [true, false, true, false] },
];

// ──────────────────────────────
// セッション行を描画する
// ──────────────────────────────
function renderSessions() {
  const row = document.getElementById('session-row');
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
// 今日の的中率を計算して表示
// ──────────────────────────────
function renderAccuracy() {
  const totalHits  = sessions.reduce((sum, s) => sum + s.hits,  0);
  const totalShots = sessions.reduce((sum, s) => sum + s.total, 0);
  const pct = totalShots > 0 ? Math.round(totalHits / totalShots * 100) : 0;
  document.getElementById('today-pct').textContent = pct;
}

// ──────────────────────────────
// 矢ボタンを描画する
// ──────────────────────────────
function renderArrows() {
  const grid = document.getElementById('arrow-grid');
  grid.innerHTML = arrows.map((state, i) => {
    let label, className;
    if (state === true)  { label = '○'; className = 'arrow-btn state-hit'; }
    else if (state === false) { label = '×'; className = 'arrow-btn state-miss'; }
    else                 { label = i + 1; className = 'arrow-btn'; }

    return `
      <button class="${className}" onclick="toggleArrow(${i})">
        ${label}
        <span class="arrow-num">${i + 1}</span>
      </button>
    `;
  }).join('');
}

// ──────────────────────────────
// 矢ボタンをクリックしたとき
// null → true → false → null と切り替える
// ──────────────────────────────
function toggleArrow(index) {
  if (arrows[index] === null)       arrows[index] = true;
  else if (arrows[index] === true)  arrows[index] = false;
  else                              arrows[index] = null;

  renderArrows();  // 再描画
}

// ──────────────────────────────
// 保存ボタンを押したとき
// ──────────────────────────────
function saveRecord() {
  const hits   = arrows.filter(a => a === true).length;
  const total  = arrows.filter(a => a !== null).length;

  if (total === 0) {
    alert('まだ記録がありません');
    return;
  }

  // ここに後でSupabaseへの保存処理を書く
  console.log('保存データ:', { hits, total, arrows });
  alert(`保存しました！${hits}/${total}中`);
}

// ──────────────────────────────
// 練習ログを描画する
// ──────────────────────────────
function renderLogs() {
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
// ページ読み込み時に全部描画
// ──────────────────────────────
renderSessions();
renderAccuracy();
renderArrows();
renderLogs();
