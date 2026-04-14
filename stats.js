// ===========================
// KYUDO DOJO - 統計・分析
// ===========================

// ──────────────────────────────
// データ（後でSupabaseから取得する）
// ──────────────────────────────

// 過去30日の的中率データ（日付・的中率）
const data30 = [
  { label: '9/21', pct: 62 },
  { label: '9/24', pct: 58 },
  { label: '9/27', pct: 70 },
  { label: '9/30', pct: 65 },
  { label: '10/3', pct: 72 },
  { label: '10/6', pct: 68 },
  { label: '10/9', pct: 75 },
  { label: '10/12', pct: 80 },
  { label: '10/15', pct: 71 },
  { label: '10/18', pct: 78 },
  { label: '10/21', pct: 73 },
  { label: '10/24', pct: 80 },
];

const data7 = [
  { label: '10/18', pct: 78 },
  { label: '10/19', pct: 65 },
  { label: '10/20', pct: 70 },
  { label: '10/21', pct: 73 },
  { label: '10/22', pct: 75 },
  { label: '10/23', pct: 68 },
  { label: '10/24', pct: 80 },
];

const data90 = [
  { label: '8月前半', pct: 55 },
  { label: '8月後半', pct: 60 },
  { label: '9月前半', pct: 63 },
  { label: '9月後半', pct: 67 },
  { label: '10月前半', pct: 72 },
  { label: '10月後半', pct: 75 },
];

// 矢別的中率
const arrowData = [
  { label: '1本目（甲矢）', pct: 82, cls: 'a1' },
  { label: '2本目（乙矢）', pct: 65, cls: 'a2' },
  { label: '3本目（甲矢）', pct: 71, cls: 'a3' },
  { label: '4本目（乙矢）', pct: 58, cls: 'a4' },
];

// ──────────────────────────────
// 棒グラフを描画する
// ──────────────────────────────
function renderChart(days) {
  // 日数に合わせてデータを選ぶ
  const dataset = days === '7'  ? data7
                : days === '90' ? data90
                : data30;

  const maxPct = Math.max(...dataset.map(d => d.pct));
  const chartEl = document.getElementById('bar-chart');
  const xEl     = document.getElementById('chart-x');

  // 棒グラフHTML
  chartEl.innerHTML = dataset.map(d => {
    // 最大値を基準に高さを計算（最大140px）
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

  // X軸ラベル（データが多い場合は間引く）
  const step = dataset.length > 8 ? 2 : 1;
  xEl.innerHTML = dataset.map((d, i) => `
    <span class="x-label">${i % step === 0 ? d.label : ''}</span>
  `).join('');
}

// セレクト変更時に呼ばれる
function updateChart(value) {
  renderChart(value);
}

// ──────────────────────────────
// 矢別分析バーを描画する
// ──────────────────────────────
function renderArrowBars() {
  const el = document.getElementById('arrow-bars');
  el.innerHTML = arrowData.map(a => `
    <div class="arrow-bar-item">
      <div class="arrow-bar-label-row">
        <span class="arrow-bar-label">${a.label}</span>
        <span class="arrow-bar-pct">${a.pct}%</span>
      </div>
      <div class="arrow-bar-bg">
        <!-- widthは0から始めて、後でアニメーションで伸ばす -->
        <div class="arrow-bar-fill ${a.cls}" style="width: 0%" data-pct="${a.pct}"></div>
      </div>
    </div>
  `).join('');

  // 少し待ってからアニメーションで伸ばす（CSS transitionを活かすため）
  setTimeout(() => {
    document.querySelectorAll('.arrow-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
    });
  }, 100);
}

// ──────────────────────────────
// ミニ的（Canvas）を描画する
// ──────────────────────────────
function drawMiniMato() {
  const canvas = document.getElementById('mini-mato');
  const ctx    = canvas.getContext('2d');
  const cx = canvas.width  / 2;
  const cy = canvas.height / 2;
  const R  = 36;

  // 的の輪
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

  // 着弾クラスター（右上に集中している例）
  const cluster = [
    { x: cx + 8,  y: cy - 10 },
    { x: cx + 10, y: cy - 6  },
    { x: cx + 6,  y: cy - 12 },
    { x: cx + 12, y: cy - 8  },
    { x: cx + 4,  y: cy - 8  },
  ];

  cluster.forEach(pt => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(45,122,95,0.75)';
    ctx.fill();
  });
}

// ──────────────────────────────
// 初期描画
// ──────────────────────────────
renderChart('30');
renderArrowBars();
drawMiniMato();
