/**
 * js/utils.js - 全ページで使う共通のユーティリティ関数
 *
 * このファイルに書いた関数は、すべてのページから呼び出せます。
 * 読み込み順：supabase.js → utils.js → 各ページのJS
 */

// ============================================================
// 日付関連
// ============================================================

/**
 * 今日の日付を "YYYY-MM-DD" 形式の文字列で返す
 *
 * NG: new Date().toISOString() → UTC時刻のため日本と1日ずれる場合あり
 * OK: この関数はローカル時間（端末の時刻）を使うので正確
 */
function getLocalDateStr() {
  const d   = new Date();
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0'); // 例: 4 → "04"
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`; // 例: "2024-04-30"
}

/**
 * "YYYY-MM-DD" → "M/D" 形式に変換する
 * 例: "2024-04-30" → "4/30"
 *
 * NG: new Date("2024-04-30") → タイムゾーンにより "4/29" になる場合あり
 * OK: 文字列を直接分割して変換する
 */
function formatDateLabel(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

/**
 * "YYYY-MM-DD" → { month: "Apr", day: 30 } に変換する
 * 練習ログの日付表示で使用
 */
function parseDateStr(dateStr) {
  const monthNames = [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const [, m, d] = dateStr.split('-');
  return {
    month: monthNames[parseInt(m)],
    day:   parseInt(d),
  };
}

// ============================================================
// プロフィール関連
// ============================================================

/**
 * 段位コード → 日本語ラベルの変換マップ
 * 例: rankMap['shodan'] → '初段'
 */
const rankMap = {
  mudan:   '無段',
  shodan:  '初段',
  nidan:   '二段',
  sandan:  '三段',
  yondan:  '四段',
  godan:   '五段',
  rokudan: '六段',
};

/**
 * ローカルストレージからプロフィール設定を読み込む
 * 未設定の場合は空オブジェクト {} を返す
 */
function loadProfile() {
  return JSON.parse(localStorage.getItem('kyudo-profile') || '{}');
}

/**
 * サイドバーとヘッダーのユーザー情報を更新する
 * すべてのページの init() から呼び出す
 *
 * @param {object} user - Supabase の auth.getUser() で得たユーザー情報
 */
function updateSidebarUser(user) {
  const saved       = loadProfile();
  const displayName = saved.name || user.email || 'Kyudojin';
  const initial     = displayName[0].toUpperCase(); // 頭文字をアバターに表示
  const rankLabel   = rankMap[saved.rank] || '初段';

  // サイドバーを更新（要素が存在するページのみ）
  const el = id => document.getElementById(id);
  if (el('sidebar-avatar')) el('sidebar-avatar').textContent = initial;
  if (el('sidebar-name'))   el('sidebar-name').textContent   = displayName;
  if (el('sidebar-rank'))   el('sidebar-rank').textContent   = `Rank: ${rankLabel}`;
  if (el('header-avatar'))  el('header-avatar').textContent  = initial;
}

// ============================================================
// 認証関連
// ============================================================

/**
 * ログインチェック
 * 未ログインならログインページへリダイレクト、
 * ログイン済みなら user オブジェクトを返す
 */
async function requireLogin() {
  const user = await getCurrentUser(); // supabase.js の関数
  if (!user) {
    window.location.href = '/login.html';
    return null;
  }
  return user;
}

/**
 * 「Sign Out」リンクのクリックハンドラ
 * すべてのページの HTML から onclick="handleSignOut(event)" で呼ぶ
 */
async function handleSignOut(e) {
  e.preventDefault();
  await signOut(); // supabase.js の signOut() を呼ぶ
}

// ============================================================
// Canvas：ミニ的の描画（stats.js で使用）
// ============================================================

/**
 * ミニ的（小さな的）を Canvas に描く
 * Stats ページの「的中傾向分析」で使用
 *
 * @param {HTMLCanvasElement} canvas - 描画先の Canvas 要素
 * @param {Array}             shots  - 射データの配列（pos_x, pos_y, result を持つ）
 */
function drawMiniMato(canvas, shots) {
  const ctx = canvas.getContext('2d');
  const cx  = canvas.width  / 2;
  const cy  = canvas.height / 2;
  const R   = 36; // 的の外枠半径（px）

  // 的の輪を外から内へ順番に描く
  [
    { r: R,        color: '#ffffff', stroke: '#cccccc' }, // 外枠（白）
    { r: R * 0.72, color: '#f0f4f2', stroke: '#bbbbbb' }, // 第2輪
    { r: R * 0.45, color: '#e0ede6', stroke: '#aaaaaa' }, // 第3輪
    { r: R * 0.22, color: '#2d7a5f', stroke: '#1a4a3a' }, // 星（緑）
  ].forEach(ring => {
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.fillStyle   = ring.color;
    ctx.strokeStyle = ring.stroke;
    ctx.lineWidth   = 1;
    ctx.fill();
    ctx.stroke();
  });

  // 着弾点を描く（最新20射分のみ表示）
  shots
    .filter(s => s.pos_x !== null && s.pos_y !== null)
    .slice(-20)
    .forEach(shot => {
      ctx.beginPath();
      ctx.arc(
        shot.pos_x * canvas.width,  // 0〜1 の比率をpx座標に変換
        shot.pos_y * canvas.height,
        3,
        0, Math.PI * 2
      );
      ctx.fillStyle = shot.result
        ? 'rgba(45, 122, 95, 0.75)' // 的中 → 緑
        : 'rgba(154, 170, 159, 0.5)'; // 失中 → グレー
      ctx.fill();
    });
}

/**
 * 数学的な角度を時計の時刻に変換する
 * Canvas の坐標軸に合わせた変換
 *
 * 数学角度: 右=0°、上=90°、左=180°（反時計回り）
 * 時計時刻: 12時=上、3時=右、6時=下、9時=左
 *
 * 例: deg=90° → "12時"（真上）
 *     deg=0°  → "3時"（右）
 *
 * @param {number} deg - Math.atan2 で得た角度（度数法）
 * @returns {string}   - "○時" 形式の文字列
 */
function angleToClock(deg) {
  let clock = ((90 - deg) / 30 + 12) % 12;
  if (clock <= 0) clock += 12;
  return `${Math.round(clock)}時`;
}
