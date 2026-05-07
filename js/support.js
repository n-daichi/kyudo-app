/**
 * js/support.js - サポート画面の処理
 *
 * 機能:
 *   - ログインチェック・サイドバー更新
 *   - FAQ のアコーディオン開閉
 *
 * 依存ファイル（HTML の script タグの順番）:
 *   1. supabase（CDN）
 *   2. js/supabase.js
 *   3. js/utils.js
 *   4. js/support.js（このファイル）
 */

// ============================================================
// 初期化
// ============================================================

async function init() {
  const user = await requireLogin(); // utils.js
  if (!user) return;

  updateSidebarUser(user); // utils.js
}

// ============================================================
// FAQ のアコーディオン
// ============================================================

/**
 * FAQ アイテムをクリックで開閉するハンドラ
 * HTML の onclick="toggleFaq(this)" から呼ばれる
 *
 * CSS の .faq-item.open クラスで開閉のアニメーションを制御している
 *
 * @param {HTMLElement} el - クリックされた .faq-item 要素
 */
function toggleFaq(el) {
  // 同じ要素をクリックしたら open クラスをトグル（付け外し）
  el.classList.toggle('open');
}

// ページ読み込み時に初期化を実行
init();
