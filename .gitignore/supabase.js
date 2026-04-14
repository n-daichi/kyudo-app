// ===========================
// KYUDO DOJO - Supabase接続
// ===========================
// ⚠️ 注意：このファイルはGitHubに公開しないこと
// （.gitignoreに追加することを推奨）

// ── あなたのSupabase情報をここに入力 ──
const SUPABASE_URL  = 'https://htyerocmuhanaixwgrdk.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_nl8-HSe7Kr9obq1hlC6HRA_cvDrwBvF';

// ── Supabaseクライアントを作成 ──
// CDNから読み込んだsupabaseライブラリを使う
const { createClient } = supabase;
const supabaseClient   = createClient(SUPABASE_URL, SUPABASE_KEY);

// ──────────────────────────────
// 認証：ログイン
// ──────────────────────────────
async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

// ──────────────────────────────
// 認証：新規登録
// ──────────────────────────────
async function signUp(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

// ──────────────────────────────
// 認証：ログアウト
// ──────────────────────────────
async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
  window.location.href = 'login.html';
}

// ──────────────────────────────
// 認証：現在のユーザーを取得
// ──────────────────────────────
async function getCurrentUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

// ──────────────────────────────
// shots：射の記録を保存する
// ──────────────────────────────
async function saveShot({ shot_date, session_num, arrow_num, arrow_type, result, pos_x, pos_y }) {
  const user = await getCurrentUser();
  if (!user) throw new Error('ログインが必要です');

  const { data, error } = await supabaseClient
    .from('shots')
    .insert([{
      user_id: user.id,
      shot_date,
      session_num,
      arrow_num,
      arrow_type,
      result,
      pos_x,
      pos_y,
    }]);

  if (error) throw error;
  return data;
}

// ──────────────────────────────
// shots：今日の記録を取得する
// ──────────────────────────────
async function getTodayShots() {
  const user = await getCurrentUser();
  if (!user) throw new Error('ログインが必要です');

  // 今日の日付を YYYY-MM-DD 形式で取得
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabaseClient
    .from('shots')
    .select('*')
    .eq('user_id', user.id)   // 自分のデータだけ
    .eq('shot_date', today)    // 今日のデータだけ
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

// ──────────────────────────────
// shots：過去N日の記録を取得する
// ──────────────────────────────
async function getRecentShots(days = 30) {
  const user = await getCurrentUser();
  if (!user) throw new Error('ログインが必要です');

  // N日前の日付を計算
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fromStr = from.toISOString().split('T')[0];

  const { data, error } = await supabaseClient
    .from('shots')
    .select('*')
    .eq('user_id', user.id)
    .gte('shot_date', fromStr)  // fromStr以降のデータ
    .order('shot_date', { ascending: true });

  if (error) throw error;
  return data;
}
