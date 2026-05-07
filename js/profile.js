/**
 * js/profile.js - プロフィール画面の処理
 *
 * 機能:
 *   - ローカルストレージから設定を読み込んで表示
 *   - Supabase から統計（総射数・的中率・練習日数）を取得
 *   - 設定変更をローカルストレージに保存する
 *
 * ※ 表示名・段位・道場名・弓の強さは端末に保存されます。
 *    複数端末で使う場合は同期されません。
 *
 * 依存ファイル（HTML の script タグの順番）:
 *   1. supabase（CDN）
 *   2. js/supabase.js
 *   3. js/utils.js
 *   4. js/profile.js（このファイル）
 */

// ============================================================
// 初期化
// ============================================================

async function init() {
  const user = await requireLogin(); // utils.js
  if (!user) return;

  updateSidebarUser(user); // utils.js

  // ── プロフィールカードの表示 ──
  const saved       = loadProfile(); // utils.js
  const displayName = saved.name || 'Kyudojin';
  const initial     = displayName[0].toUpperCase();
  const rankLabel   = rankMap[saved.rank] || '初段'; // utils.js の rankMap

  // 大きなアバター・名前・メール・段位バッジを更新
  setTextById('profile-avatar-big',   initial);
  setTextById('profile-display-name', displayName);
  setTextById('profile-email',        user.email || '');
  setTextById('profile-rank-badge',   `Rank: ${rankLabel}`);

  // ── 設定フォームに保存済みの値をセット ──
  setValueById('input-name', saved.name  || '');
  setValueById('input-rank', saved.rank  || 'shodan');
  setValueById('input-dojo', saved.dojo  || '');
  setValueById('input-bow',  saved.bow   || '16');

  // ── 統計を Supabase から取得して表示 ──
  try {
    // 過去1年分のデータを取得
    const shots = await getRecentShots(365); // supabase.js
    const hits  = shots.filter(s => s.result).length;
    const days  = new Set(shots.map(s => s.shot_date)).size;
    const pct   = shots.length > 0 ? Math.round(hits / shots.length * 100) : 0;

    setTextById('stat-total-shots', shots.length || '-');
    setTextById('stat-avg-pct',     shots.length > 0 ? `${pct}%` : '-');
    setTextById('stat-days',        days || '-');

  } catch (e) {
    console.error('統計取得エラー:', e);
  }
}

// ============================================================
// 設定の保存
// ============================================================

/**
 * 設定フォームの内容をローカルストレージに保存する
 * HTML の onclick="saveSettings()" から呼ばれる
 */
function saveSettings() {
  const profile = {
    name: getValueById('input-name'),
    rank: getValueById('input-rank'),
    dojo: getValueById('input-dojo'),
    bow:  getValueById('input-bow'),
  };

  // ローカルストレージに JSON 文字列で保存
  localStorage.setItem('kyudo-profile', JSON.stringify(profile));

  // ── 画面をリアルタイム更新 ──
  const displayName = profile.name || 'Kyudojin';
  const initial     = displayName[0].toUpperCase();
  const rankLabel   = rankMap[profile.rank] || '初段';

  // サイドバー・ヘッダー・プロフィールカードをすべて更新
  ['sidebar-avatar', 'header-avatar', 'profile-avatar-big'].forEach(id => {
    setTextById(id, initial);
  });
  setTextById('sidebar-name',         displayName);
  setTextById('sidebar-rank',         `Rank: ${rankLabel}`);
  setTextById('profile-display-name', displayName);
  setTextById('profile-rank-badge',   `Rank: ${rankLabel}`);

  alert('設定を保存しました！');
}

// ============================================================
// ヘルパー関数（コードの重複を減らすための小さな関数）
// ============================================================

/** getElementById + textContent を1行で書くためのヘルパー */
function setTextById(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** getElementById + value を1行で書くためのヘルパー */
function setValueById(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

/** getElementById + value の取得を1行で書くためのヘルパー */
function getValueById(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

// ページ読み込み時に初期化を実行
init();
