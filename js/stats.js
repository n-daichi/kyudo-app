/**
 * js/stats.js - 統計・分析画面の処理
 *
 * 機能:
 *   - 週間・月間サマリーカードの表示
 *   - 日別的中率の棒グラフ（7日・30日・90日切り替え）
 *   - 矢別的中率分析（日付フィルタ対応）
 *   - 的中傾向分析（ミニ的 + テキスト）
 *   - 練習日数・平均矢数の表示
 *
 * 依存ファイル（HTML の script タグの順番）:
 *   1. supabase（CDN）
 *   2. js/supabase.js
 *   3. js/utils.js
 *   4. js/stats.js（このファイル）
 */

// ============================================================
// 状態管理
// ============================================================

// 矢別分析の日付フィルタで使うために全データを保持
let allShots30 = [];

// ============================================================
// 初期化
// ============================================================

async function init() {
  const user = await requireLogin(); // utils.js
  if (!user) return;

  updateSidebarUser(user); // utils.js

  // 3つの期間のデータを並行取得する
  // Promise.all を使うと3つのリクエストを同時に送れて速い
  const [shots30, shots7, shots90] = await Promise.all([
    getRecentShots(30),  // supabase.js
    getRecentShots(7),
    getRecentShots(90),
  ]);

  // 矢別分析のフィルタ用に保持
  allShots30 = shots30;

  // ── グラフ ──
  // 各期間のデータをグラフ描画用に集計する
  const data30 = calcDailyAccuracy(shots30, 30);
  const data7  = calcDailyAccuracy(shots7,  7);
  const data90 = calcWeeklyAccuracy(shots90);

  // 初期表示は30日
  renderChart(data30);

  // セレクトボックスの変更で期間を切り替える
  document.getElementById('chart-period').addEventListener('change', function() {
    if      (this.value === '7')  renderChart(data7);
    else if (this.value === '90') renderChart(data90);
    else                          renderChart(data30);
  });

  // ── 各セクションを描画 ──
  renderSummary(shots30, shots7);
  buildArrowDateSelector(shots30); // 日付セレクタのオプションを生成
  renderArrowBars(shots30);        // 初期は全期間で表示
  renderBottomStats(shots30);

  // ミニ的は utils.js の共通関数を使う
  const miniCanvas = document.getElementById('mini-mato');
  if (miniCanvas) drawMiniMato(miniCanvas, shots30);
}

// ============================================================
// データ集計
// ============================================================

/**
 * 日別の的中率を計算する
 * グラフの棒1本 = 1日分のデータ
 *
 * データがない日はスキップする（棒を表示しない）
 *
 * @param {Array}  shots - 射データの配列
 * @param {number} days  - 集計する日数
 * @returns {Array}      - [{ label: "4/30", pct: 75 }, ...] の形式
 */
function calcDailyAccuracy(shots, days) {
  // まず日付をキーにしたマップを作る
  // 例: { "2024-04-30": { hits: 3, total: 4 } }
  const map = {};
  shots.forEach(shot => {
    const date = shot.shot_date;
    if (!map[date]) map[date] = { hits: 0, total: 0 };
    map[date].total++;
    if (shot.result) map[date].hits++;
  });

  // 過去 N 日分の日付を生成してデータを取り出す
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    // タイムゾーン対策：文字列で組み立てる
    const key   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const label = formatDateLabel(key); // utils.js
    const data  = map[key];

    // その日のデータがある場合のみグラフに追加
    if (data && data.total > 0) {
      result.push({ label, pct: Math.round(data.hits / data.total * 100) });
    }
  }

  // データが1件もない場合のフォールバック
  return result.length > 0 ? result : [{ label: 'データなし', pct: 0 }];
}

/**
 * 週別の的中率を計算する（90日表示用）
 * グラフの棒1本 = 1週間分のデータ
 *
 * @param {Array} shots - 射データの配列
 * @returns {Array}     - [{ label: "4/29週", pct: 70 }, ...] の形式
 */
function calcWeeklyAccuracy(shots) {
  // 週の月曜日をキーにしてデータをまとめる
  const map = {};
  shots.forEach(shot => {
    const d   = new Date(shot.shot_date + 'T00:00:00'); // タイムゾーン対策
    const day = d.getDay() || 7; // 日曜=0 → 7 に変換
    d.setDate(d.getDate() - day + 1); // その週の月曜日に移動

    const key   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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

// ============================================================
// サマリーカードの描画
// ============================================================

/**
 * 週間・月間サマリーとベストパフォーマンスを更新する
 *
 * @param {Array} shots30 - 過去30日の射データ
 * @param {Array} shots7  - 過去7日の射データ
 */
function renderSummary(shots30, shots7) {
  // ── 週間サマリー ──
  const weekHits  = shots7.filter(s => s.result).length;
  const weekTotal = shots7.length;
  const weekPct   = weekTotal > 0 ? (weekHits / weekTotal * 100).toFixed(1) : '-';

  document.getElementById('week-pct').innerHTML =
    `${weekPct} <span class="summary-unit">%</span>`;
  document.getElementById('week-detail').textContent =
    weekTotal > 0
      ? `今週の記録：${weekTotal}射 / 的中：${weekHits}`
      : '今週の記録はまだありません';

  // ── 月間サマリー ──
  const monthHits  = shots30.filter(s => s.result).length;
  const monthTotal = shots30.length;
  const monthPct   = monthTotal > 0 ? (monthHits / monthTotal * 100).toFixed(1) : '-';

  document.getElementById('month-pct').innerHTML =
    `${monthPct} <span class="summary-unit">%</span>`;
  document.getElementById('month-detail').textContent =
    monthTotal > 0
      ? `今月の記録：${monthTotal}射 / 的中：${monthHits}`
      : '今月の記録はまだありません';

  // ── ベスト連続的中 ──
  // shots30 を順番に見て、連続して的中が続いた最長の数を求める
  let maxStreak     = 0;
  let currentStreak = 0;
  let bestDate      = null;

  shots30.forEach(shot => {
    if (shot.result) {
      currentStreak++;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
        bestDate  = shot.shot_date; // YYYY-MM-DD 文字列をそのまま使う
      }
    } else {
      currentStreak = 0; // 失中でリセット
    }
  });

  document.getElementById('best-streak').innerHTML =
    `${maxStreak || '-'} <span class="best-unit">連射的中</span>`;
  document.getElementById('best-date').textContent =
    bestDate ? `記録日：${formatDateLabel(bestDate)}` : '記録なし'; // utils.js
}

// ============================================================
// 棒グラフの描画
// ============================================================

/**
 * 的中率推移の棒グラフを描画する
 *
 * グラフの最大値は常に 100%（棒の最大高さ = 100%のとき）
 * これにより複数期間の比較がしやすくなる
 *
 * @param {Array} dataset - [{ label, pct }, ...] の形式
 */
function renderChart(dataset) {
  if (!dataset || dataset.length === 0) return;

  const chartEl = document.getElementById('bar-chart');
  const xEl     = document.getElementById('chart-x');

  // 棒グラフの HTML を生成
  chartEl.innerHTML = dataset.map(d => `
    <div class="bar-wrap">
      <div class="bar-tooltip">${d.pct}%</div>
      <div class="bar" style="height: ${d.pct}%">
        <div class="bar-dot"></div>
      </div>
    </div>
  `).join('');

  // X軸のラベル（データが多いときは1つおきに表示）
  const step = dataset.length > 8 ? 2 : 1;
  xEl.innerHTML = dataset.map((d, i) =>
    `<span class="x-label">${i % step === 0 ? d.label : ''}</span>`
  ).join('');
}

// ============================================================
// 矢別的中率分析
// ============================================================

/**
 * 矢別分析の日付セレクタに選択肢を追加する
 * 「全期間」オプション + 練習した日付のオプション
 *
 * @param {Array} shots - 射データの配列
 */
function buildArrowDateSelector(shots) {
  // 練習した日付を重複なく取得して新しい順に並べる
  const dates = [...new Set(shots.map(s => s.shot_date))].sort().reverse();
  const sel   = document.getElementById('arrow-date-select');

  // 既存の日付オプション（「全期間」以外）を削除してから追加
  while (sel.options.length > 1) sel.remove(1);

  dates.forEach(date => {
    const opt       = document.createElement('option');
    opt.value       = date;
    opt.textContent = formatDateLabel(date); // utils.js
    sel.appendChild(opt);
  });
}

/**
 * 矢別分析の日付セレクタ変更ハンドラ
 * HTML の onchange="onArrowDateChange(this.value)" から呼ばれる
 *
 * @param {string} value - 選択された値（"all" または "YYYY-MM-DD"）
 */
function onArrowDateChange(value) {
  if (value === 'all') {
    renderArrowBars(allShots30); // 全期間
  } else {
    // 選択した日付のデータだけフィルタして表示
    renderArrowBars(allShots30.filter(s => s.shot_date === value));
  }
}

/**
 * 矢別的中率のバーを描画する
 * 1〜4本目それぞれの的中率をバーで表示する
 *
 * @param {Array} shots - 表示対象の射データ
 */
function renderArrowBars(shots) {
  // 矢番号ごとに集計する
  const arrowMap = {
    1: { hits: 0, total: 0 },
    2: { hits: 0, total: 0 },
    3: { hits: 0, total: 0 },
    4: { hits: 0, total: 0 },
  };

  shots.forEach(shot => {
    const num = shot.arrow_num;
    if (!arrowMap[num]) return;
    arrowMap[num].total++;
    if (shot.result) arrowMap[num].hits++;
  });

  const labels  = ['1本目（甲矢）', '2本目（乙矢）', '3本目（甲矢）', '4本目（乙矢）'];
  const classes = ['a1', 'a2', 'a3', 'a4']; // CSS クラス名（色の指定に使う）
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
          <!-- width は 0% からアニメーションで伸ばす（CSS transition を活用） -->
          <div class="arrow-bar-fill ${classes[i]}" style="width: 0%" data-pct="${pct}"></div>
        </div>
      </div>
    `;
  }).join('');

  // 少し待ってから width を設定することで CSS の transition が発火する
  setTimeout(() => {
    document.querySelectorAll('.arrow-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
    });
  }, 100);

  // ── アドバイス表示 ──
  // 最も的中率が低い矢番号を探してアドバイスを出す
  const minArrow = Object.entries(arrowMap)
    .filter(([, d]) => d.total > 0)
    .sort(([, a], [, b]) => (a.hits / a.total) - (b.hits / b.total))[0];

  const noteEl   = document.getElementById('arrow-note');
  const noteText = document.getElementById('arrow-note-text');

  if (minArrow) {
    const arrowNames = ['', '1本目（甲矢）', '2本目（乙矢）', '3本目（甲矢）', '4本目（乙矢）'];
    noteEl.style.display  = 'flex';
    noteText.textContent  = `${arrowNames[minArrow[0]]}の的中率が低めです。集中力を保ちましょう。`;
  } else {
    noteEl.style.display = 'none';
  }
}

// ============================================================
// 下段統計（平均矢数・練習日数・的中傾向）
// ============================================================

/**
 * 下段の統計情報を更新する
 *
 * @param {Array} shots - 過去30日の射データ
 */
function renderBottomStats(shots) {
  // ── 練習日数と平均矢数 ──
  const days     = new Set(shots.map(s => s.shot_date)).size; // 重複除去で日数を数える
  const avgShots = days > 0 ? Math.round(shots.length / days) : 0;

  document.getElementById('avg-shots').innerHTML =
    `${avgShots || '-'}<span class="mini-stat-unit">本</span>`;
  document.getElementById('avg-shots-sub').textContent =
    days > 0 ? '過去30日間の平均' : 'データなし';

  document.getElementById('practice-days').innerHTML =
    `${days || '-'}<span class="mini-stat-unit">日</span>`;
  document.getElementById('practice-days-sub').textContent =
    days > 0 ? '過去30日間' : 'データなし';

  // ── 的中傾向テキスト ──
  const withPos    = shots.filter(s => s.pos_x !== null && s.pos_y !== null);
  const tendencyEl = document.getElementById('tendency-desc');

  if (withPos.length === 0) {
    tendencyEl.textContent = 'Mato 画面で着弾位置を記録すると傾向が表示されます。';
    return;
  }

  // 方向ごとにカウント
  let upperRight = 0, center = 0, other = 0;
  withPos.forEach(s => {
    const dx   = s.pos_x - 0.5;
    const dy   = s.pos_y - 0.5;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.12)            center++;
    else if (dx > 0 && dy < 0)  upperRight++;
    else                         other++;
  });

  // 最も多い方向を「支配的な方向」として表示
  const dominant = upperRight > center && upperRight > other ? '右上（名上）'
                 : center > other ? '中心部'
                 : 'その他の方向';

  tendencyEl.textContent =
    `着弾点は${dominant}に集中しています。${withPos.length}射のデータより算出。`;
}

// ページ読み込み時に初期化を実行
init();
