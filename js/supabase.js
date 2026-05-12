// ============================================================
// supabase.js  ―  Supabase接続・認証・データ操作
//
// ⚠️ このファイルはAPIキーを含むため .gitignore に追加すること
// ============================================================

// ── 接続情報 ──
// Vercel公開時は環境変数から読む（window.__SUPABASE_URL__ が設定されていれば優先）
const SUPABASE_URL = window.__SUPABASE_URL__ || 'https://htyerocmuhanaixwgrdk.supabase.co';
const SUPABASE_KEY = window.__SUPABASE_KEY__ || 'YOUR_ANON_KEY'; // ← 自分のキーに書き換える

// ── Supabaseクライアントを初期化 ──
const { createClient } = window.supabase;
const supabaseClient   = createClient(SUPABASE_URL, SUPABASE_KEY);


// ════════════════════════════════════════
//  認証系
// ════════════════════════════════════════

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signUp(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
  // pages/ フォルダから見たルートの index.html へ
  window.location.href = '../index.html';
}

// ── ユーザーキャッシュ ──
// getSession()はローカルのみで完結するため高速
// getUser()はサーバー問い合わせが発生するため極力使わない
let _cachedUser = null;

async function getCurrentUser() {
  if (_cachedUser) return _cachedUser;

  // getSession はローカルストレージのトークンを読むだけ（サーバー通信なし）
  const { data: { session } } = await supabaseClient.auth.getSession();
  _cachedUser = session?.user ?? null;
  return _cachedUser;
}

// 認証状態が変わったときにキャッシュを更新
supabaseClient.auth.onAuthStateChange((event, session) => {
  _cachedUser = session?.user ?? null;
});


// ════════════════════════════════════════
//  shots テーブル操作
// ════════════════════════════════════════

/**
 * 射の記録を1件保存する
 * result: true=的中 / false=失中
 * pos_x, pos_y: 着弾座標（0〜1の比率、null可）
 */
async function saveShot({ shot_date, session_num, arrow_num, arrow_type, result, pos_x, pos_y }) {
  const user = await getCurrentUser();
  if (!user) throw new Error('ログインが必要です');

  const { data, error } = await supabaseClient
    .from('shots')
    .insert([{ user_id: user.id, shot_date, session_num, arrow_num, arrow_type, result, pos_x, pos_y }]);

  if (error) throw error;
  return data;
}

/**
 * 今日の射データをすべて取得する
 * タイムゾーンずれ対策でローカル日時を使用
 */
async function getTodayShots() {
  const user = await getCurrentUser();
  if (!user) throw new Error('ログインが必要です');

  const d     = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const { data, error } = await supabaseClient
    .from('shots')
    .select('*')
    .eq('user_id',   user.id)
    .eq('shot_date', today)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * 過去N日間の射データを取得する
 * @param {number} days - 何日前まで取得するか（デフォルト30）
 */
async function getRecentShots(days = 30) {
  const user = await getCurrentUser();
  if (!user) throw new Error('ログインが必要です');

  const from    = new Date();
  from.setDate(from.getDate() - days);
  const fromStr = `${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,'0')}-${String(from.getDate()).padStart(2,'0')}`;

  const { data, error } = await supabaseClient
    .from('shots')
    .select('*')
    .eq('user_id', user.id)
    .gte('shot_date', fromStr)
    .order('shot_date', { ascending: true });

  if (error) throw error;
  return data;
}
