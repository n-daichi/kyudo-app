// ===========================
// KYUDO DOJO - 統計・分析
// ===========================

// 全データを保持（日付フィルタ用）
let allShots30 = [];

function getLocalDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateLabel(dateStr) {
  // タイムゾーンずれ修正：文字列を直接パース
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

async function init() {
  const user = await getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return; }

  const initial = user.email ? user.email[0].toUpperCase() : '弓';
  document.getElementById('sidebar-avatar').textContent = initial;
  document.getElementById('header-avatar').textContent  = initial;
  document.getElementById('sidebar-name').textContent   = user.email || 'Kyudojin';

  const shots30 = await getRecentShots(30);
  const shots7  = await getRecentShots(7);
  const shots90 = await getRecentShots(90);
  allShots30    = shots30;

  const data30 = calcDailyAccuracy(shots30, 30);
  const data7  = calcDailyAccuracy(shots7,  7);
  const data90 = calcWeeklyAccuracy(shots90);

  renderChart(data30);

  document.getElementById('chart-period').addEventListener('change', function() {
    if      (this.value === '7')  renderChart(data7);
    else if (this.value === '90') renderChart(data90);
    else                          renderChart(data30);
  });

  renderSummary(shots30, shots7);
  buildArrowDateSelector(shots30);
  renderArrowBars(shots30); // 初期は全期間
  renderBottomStats(shots30);
  drawMiniMato(shots30);
}

async function handleSignOut(e) {
  e.preventDefault();
  await signOut();
}

// ──────────────────────────────
// 矢別分析の日付セレクタを構築
// ──────────────────────────────
function buildArrowDateSelector(shots) {
  const dates = [...new Set(shots.map(s => s.shot_date))].sort().reverse();
  const sel   = document.getElementById('arrow-date-select');

  // 既存のoption（all以外）を削除
  while (sel.options.length > 1) sel.remove(1);

  dates.forEach(date => {
    const opt = document.createElement('option');
    opt.value       = date;
    opt.textContent = formatDateLabel(date);
    sel.appendChild(opt);
  });
}

function onArrowDateChange(value) {
  if (value === 'all') {
    renderArrowBars(allShots30);
  } else {
    const filtered = allShots30.filter(s => s.shot_date === value);
    renderArrowBars(filtered);
  }
}

// ──────────────────────────────
// 日別的中率を計算
// ──────────────────────────────
function calcDailyAccuracy(shots, days) {
  const map = {};
  shots.forEach(shot => {
    if (!map[shot.shot_date]) map[shot.shot_date] = { hits: 0, total: 0 };
    map[shot.shot_date].total++;
    if (shot.result) map[shot.shot_date].hits++;
  });

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d   = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const data = map[key];
    if (data && data.total > 0) {
      result.push({ label: formatDateLabel(key), pct: Math.round(data.hits / data.total * 100) });
    }
  }
  return result.length > 0 ? result : [{ label: 'データなし', pct: 0 }];
}

// ──────────────────────────────
// 週別的中率（90日用）
// ──────────────────────────────
function calcWeeklyAccuracy(shots) {
  const map = {};
  shots.forEach(shot => {
    const d   = new Date(shot.shot_date + 'T00:00:00');
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    const key   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const label = `${d.getMonth()+1}/${d.getDate()}週`;
    if (!map[key]) map[key] = { label, hits: 0, total: 0 };
    map[key].total++;
    if (shot.result) map[key].hits++;
  });
  return Object.values(map).map(w => ({ label: w.label, pct: Math.round(w.hits / w.total * 100) }));
}

// ──────────────────────────────
// サマリーカードを更新（タイムゾーン修正）
// ──────────────────────────────
function renderSummary(shots30, shots7) {
  const weekHits  = shots7.filter(s => s.result).length;
  const weekTotal = shots7.length;
  const weekPct   = weekTotal > 0 ? (weekHits / weekTotal * 100).toFixed(1) : '-';

  document.getElementById('week-pct').innerHTML =
    `${weekPct} <span class="summary-unit">%</span>`;
  document.getElementById('week-detail').textContent =
    weekTotal > 0 ? `今週の記録：${weekTotal}射 / 的中：${weekHits}` : '今週の記録はまだありません';

  const monthHits  = shots30.filter(s => s.result).length;
  const monthTotal = shots30.length;
  const monthPct   = monthTotal > 0 ? (monthHits / monthTotal * 100).toFixed(1) : '-';

  document.getElementById('month-pct').innerHTML =
    `${monthPct} <span class="summary-unit">%</span>`;
  document.getElementById('month-detail').textContent =
    monthTotal > 0 ? `今月の記録：${monthTotal}射 / 的中：${monthHits}` : '今月の記録はまだありません';

  // ベスト連続的中（タイムゾーン修正：文字列をそのまま使う）
  let maxStreak = 0, currentStreak = 0, bestDate = null;
  shots30.forEach(shot => {
    if (shot.result) {
      currentStreak++;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
        bestDate  = shot.shot_date; // YYYY-MM-DD文字列をそのまま使用
      }
    } else {
      currentStreak = 0;
    }
  });

  document.getElementById('best-streak').innerHTML =
    `${maxStreak || '-'} <span class="best-unit">連射的中</span>`;
  document.getElementById('best-date').textContent =
    bestDate ? `記録日：${formatDateLabel(bestDate)}` : '記録なし';
}

// ──────────────────────────────
// 棒グラフを描画
// ──────────────────────────────
function renderChart(dataset) {
  if (!dataset || dataset.length === 0) return;
  
  const chartEl = document.getElementById('bar-chart');
  const xEl     = document.getElementById('chart-x');

  chartEl.innerHTML = dataset.map(d => {
    const h = d.pct; // 100%基準
    return `
      <div class="bar-wrap">
        <div class="bar-tooltip">${d.pct}%</div>
        <div class="bar" style="height: ${h}%"><div class="bar-dot"></div></div>
      </div>`;
  }).join('');

  const step = dataset.length > 8 ? 2 : 1;
  xEl.innerHTML = dataset.map((d, i) =>
    `<span class="x-label">${i % step === 0 ? d.label : ''}</span>`
  ).join('');
}

// ──────────────────────────────
// 矢別分析バーを描画（日付フィルタ対応）
// ──────────────────────────────
function renderArrowBars(shots) {
  const arrowMap = { 1: { hits:0,total:0 }, 2: { hits:0,total:0 }, 3: { hits:0,total:0 }, 4: { hits:0,total:0 } };
  shots.forEach(shot => {
    const num = shot.arrow_num;
    if (!arrowMap[num]) return;
    arrowMap[num].total++;
    if (shot.result) arrowMap[num].hits++;
  });

  const labels  = ['1本目（甲矢）', '2本目（乙矢）', '3本目（甲矢）', '4本目（乙矢）'];
  const classes = ['a1', 'a2', 'a3', 'a4'];
  const el      = document.getElementById('arrow-bars');

  if (shots.length === 0) {
    el.innerHTML = '<p style="font-size:12px;color:#999;">この日のデータはありません</p>';
    document.getElementById('arrow-note').style.display = 'none';
    return;
  }

  el.innerHTML = labels.map((label, i) => {
    const data = arrowMap[i + 1];
    const pct  = data.total > 0 ? Math.round(data.hits / data.total * 100) : 0;
    return `
      <div class="arrow-bar-item">
        <div class="arrow-bar-label-row">
          <span class="arrow-bar-label">${label}</span>
          <span class="arrow-bar-pct">${data.total > 0 ? pct + '%' : '-'}</span>
        </div>
        <div class="arrow-bar-bg">
          <div class="arrow-bar-fill ${classes[i]}" style="width:0%" data-pct="${pct}"></div>
        </div>
      </div>`;
  }).join('');

  setTimeout(() => {
    document.querySelectorAll('.arrow-bar-fill').forEach(b => { b.style.width = b.dataset.pct + '%'; });
  }, 100);

  // 最低的中率の矢を検出
  const minArrow = Object.entries(arrowMap)
    .filter(([, d]) => d.total > 0)
    .sort(([, a], [, b]) => (a.hits/a.total) - (b.hits/b.total))[0];

  if (minArrow) {
    const names = ['','1本目（甲矢）','2本目（乙矢）','3本目（甲矢）','4本目（乙矢）'];
    document.getElementById('arrow-note').style.display = 'flex';
    document.getElementById('arrow-note-text').textContent =
      `${names[minArrow[0]]}の的中率が低めです。集中力を保ちましょう。`;
  } else {
    document.getElementById('arrow-note').style.display = 'none';
  }
}

// ──────────────────────────────
// 下段統計を更新
// ──────────────────────────────
function renderBottomStats(shots) {
  const days     = new Set(shots.map(s => s.shot_date)).size;
  const avgShots = days > 0 ? Math.round(shots.length / days) : 0;

  document.getElementById('avg-shots').innerHTML =
    `${avgShots || '-'}<span class="mini-stat-unit">本</span>`;
  document.getElementById('avg-shots-sub').textContent = days > 0 ? '過去30日間の平均' : 'データなし';

  document.getElementById('practice-days').innerHTML =
    `${days || '-'}<span class="mini-stat-unit">日</span>`;
  document.getElementById('practice-days-sub').textContent = days > 0 ? '過去30日間' : 'データなし';

  const withPos    = shots.filter(s => s.pos_x !== null && s.pos_y !== null);
  const tendencyEl = document.getElementById('tendency-desc');
  if (withPos.length === 0) {
    tendencyEl.textContent = 'Mato画面で着弾位置を記録すると傾向が表示されます。';
  } else {
    let upperRight = 0, center = 0, lowerLeft = 0;
    withPos.forEach(s => {
      const dx = s.pos_x - 0.5, dy = s.pos_y - 0.5;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 0.12) center++;
      else if (dx > 0 && dy < 0) upperRight++;
      else lowerLeft++;
    });
    const dominant = upperRight > center && upperRight > lowerLeft ? '右上（名上）'
                   : center > lowerLeft ? '中心部' : '左下';
    tendencyEl.textContent = `着弾点は${dominant}に集中しています。${withPos.length}射のデータより算出。`;
  }
}

// ──────────────────────────────
// ミニ的（Canvas）
// ──────────────────────────────
function drawMiniMato(shots) {
  const canvas = document.getElementById('mini-mato');
  const ctx    = canvas.getContext('2d');
  const cx = canvas.width/2, cy = canvas.height/2, R = 36;

  [{ r:R,color:'#fff',stroke:'#ccc' }, { r:R*.72,color:'#f0f4f2',stroke:'#bbb' },
   { r:R*.45,color:'#e0ede6',stroke:'#aaa' }, { r:R*.22,color:'#2d7a5f',stroke:'#1a4a3a' }]
  .forEach(ring => {
    ctx.beginPath(); ctx.arc(cx, cy, ring.r, 0, Math.PI*2);
    ctx.fillStyle = ring.color; ctx.strokeStyle = ring.stroke; ctx.lineWidth = 1;
    ctx.fill(); ctx.stroke();
  });

  shots.filter(s => s.pos_x !== null && s.pos_y !== null).slice(-20).forEach(shot => {
    ctx.beginPath();
    ctx.arc(shot.pos_x * canvas.width, shot.pos_y * canvas.height, 3, 0, Math.PI*2);
    ctx.fillStyle = shot.result ? 'rgba(45,122,95,0.75)' : 'rgba(154,170,159,0.5)';
    ctx.fill();
  });
}

init();
