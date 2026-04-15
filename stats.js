// ===========================
// KYUDO DOJO - 統計・分析
// ===========================

// ──────────────────────────────
// 初期化
// ──────────────────────────────
async function init() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // Supabaseから実データを取得
  const shots30 = await getRecentShots(30);
  const shots7  = await getRecentShots(7);
  const shots90 = await getRecentShots(90);

  // グラフ用データを計算
  const data30 = calcDailyAccuracy(shots30, 30);
  const data7  = calcDailyAccuracy(shots7,  7);
  const data90 = calcWeeklyAccuracy(shots90);

  // グラフを描画
  renderChart(data30);

  // セレクト変更時の処理
  document.querySelector('.chart-select').addEventListener('change', function() {
    if (this.value === '7')       renderChart(data7);
    else if (this.value === '90') renderChart(data90);
    else                          renderChart(data30);
  });

  // サマリーカードを更新
  renderSummary(shots30, shots7);

  // 矢別分析を更新
  renderArrowBars(shots30);

  // ミニ的を描画
  drawMiniMato(shots30);
}

// ──────────────────────────────
// 日別的中率を計算する
// ──────────────────────────────
function calcDailyAccuracy(shots, days) {
  // 日付ごとにグループ化
  const map = {};
  shots.forEach(shot => {
    const date = shot.shot_date;
    if (!map[date]) map[date] = { hits: 0, total: 0 };
    map[date].total++;
    if (shot.result) map[date].hits++;
  });

  // 過去N日分の配列を作る（データがない日は0）
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key   = d.toISOString().split('T')[0];
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const data  = map[key];
    if (data && data.total > 0) {
      result.push({ label, pct: Math.round(data.hits / data.total * 100) });
    }
  }

  // データがない場合はダミーを返す
  return result.length > 0 ? result : [{ label: 'データなし', pct: 0 }];
}

// ──────────────────────────────
// 週別的中率を計算する（90日用）
// ──────────────────────────────
function calcWeeklyAccuracy(shots) {
  const map = {};
  shots.forEach(shot => {
    const d    = new Date(shot.shot_date);
    // 週の開始日（月曜日）を計算
    const day  = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    const key  = d.toISOString().split('T')[0];
    const label = `${d.getMonth() + 1}/${d.getDate()}週`;
    if (!map[key]) map[key] = { label, hits: 0, total: 0 };
    map[key].total++;
    if (shot.result) map[key].hits++;
  });

  return Object.values(map).map(w => ({
    label: w.label,
    pct:   Math.round(w.hits / w.total * 100),
  }));
}

// ──────────────────────────────
// サマリーカードを更新
// ──────────────────────────────
function renderSummary(shots30, shots7) {
  // 今週の的中率
  const weekHits  = shots7.filter(s => s.result).length;
  const weekTotal = shots7.length;
  const weekPct   = weekTotal > 0 ? (weekHits / weekTotal * 100).toFixed(1) : 0;

  // 今月の的中率
  const monthHits  = shots30.filter(s => s.result).length;
  const monthTotal = shots30.length;
  const monthPct   = monthTotal > 0 ? (monthHits / monthTotal * 100).toFixed(1) : 0;

  // HTML更新
  document.querySelector('.summary-card:nth-child(1) .summary-big').innerHTML =
    `${weekPct} <span class="summary-unit">%</span>`;
  document.querySelector('.summary-card:nth-child(1) .summary-detail').textContent =
    `今週の記録：${weekTotal}射 / 的中：${weekHits}`;

  document.querySelector('.summary-card:nth-child(2) .summary-big').innerHTML =
    `${monthPct} <span class="summary-unit">%</span>`;
  document.querySelector('.summary-card:nth-child(2) .summary-detail').textContent =
    `今月の記録：${monthTotal}射 / 的中：${monthHits}`;
}

// ──────────────────────────────
// 棒グラフを描画
// ──────────────────────────────
function renderChart(dataset) {
  if (!dataset || dataset.length === 0) return;

  const maxPct  = Math.max(...dataset.map(d => d.pct), 1);
  const chartEl = document.getElementById('bar-chart');
  const xEl     = document.getElementById('chart-x');

  chartEl.innerHTML = dataset.map(d => {
    const heightPct = (d.pct / maxPct) * 100;
    return `
      <div class="bar-wrap">
        <div class="bar-tooltip">${d.pct}%</div>
        <div class="bar" style="height: ${heightPct}%">
          <div class="bar-dot"></div>
        </div>
      </div>
    `;
  }).join('');

  const step = dataset.length > 8 ? 2 : 1;
  xEl.innerHTML = dataset.map((d, i) => `
    <span class="x-label">${i % step === 0 ? d.label : ''}</span>
  `).join('');
}

// ──────────────────────────────
// 矢別分析バーを描画
// ──────────────────────────────
function renderArrowBars(shots) {
  // 矢番号ごとに集計
  const arrowMap = { 1: { hits: 0, total: 0 }, 2: { hits: 0, total: 0 },
                     3: { hits: 0, total: 0 }, 4: { hits: 0, total: 0 } };

  shots.forEach(shot => {
    const num = shot.arrow_num;
    if (!arrowMap[num]) return;
    arrowMap[num].total++;
    if (shot.result) arrowMap[num].hits++;
  });

  const labels = ['1本目（甲矢）', '2本目（乙矢）', '3本目（甲矢）', '4本目（乙矢）'];
  const classes = ['a1', 'a2', 'a3', 'a4'];

  const el = document.getElementById('arrow-bars');
  el.innerHTML = labels.map((label, i) => {
    const data = arrowMap[i + 1];
    const pct  = data.total > 0 ? Math.round(data.hits / data.total * 100) : 0;
    return `
      <div class="arrow-bar-item">
        <div class="arrow-bar-label-row">
          <span class="arrow-bar-label">${label}</span>
          <span class="arrow-bar-pct">${pct}%</span>
        </div>
        <div class="arrow-bar-bg">
          <div class="arrow-bar-fill ${classes[i]}" style="width: 0%" data-pct="${pct}"></div>
        </div>
      </div>
    `;
  }).join('');

  // アニメーション
  setTimeout(() => {
    document.querySelectorAll('.arrow-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
    });
  }, 100);
}

// ──────────────────────────────
// ミニ的（Canvas）を描画
// ──────────────────────────────
function drawMiniMato(shots) {
  const canvas = document.getElementById('mini-mato');
  const ctx    = canvas.getContext('2d');
  const cx = canvas.width  / 2;
  const cy = canvas.height / 2;
  const R  = 36;

  const rings = [
    { r: R,        color: '#fff',    stroke: '#ccc' },
    { r: R * 0.72, color: '#f0f4f2', stroke: '#bbb' },
    { r: R * 0.45, color: '#e0ede6', stroke: '#aaa' },
    { r: R * 0.22, color: '#2d7a5f', stroke: '#1a4a3a' },
  ];
  rings.forEach(ring => {
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.fillStyle   = ring.color;
    ctx.strokeStyle = ring.stroke;
    ctx.lineWidth   = 1;
    ctx.fill();
    ctx.stroke();
  });

  // 実際の着弾データを描画
  const withPos = shots.filter(s => s.pos_x !== null && s.pos_y !== null).slice(-20);
  withPos.forEach(shot => {
    const px = shot.pos_x * canvas.width;
    const py = shot.pos_y * canvas.height;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle   = shot.result ? 'rgba(45,122,95,0.75)' : 'rgba(154,170,159,0.5)';
    ctx.fill();
  });
}

// ──────────────────────────────
// 初期化実行
// ──────────────────────────────
init();
