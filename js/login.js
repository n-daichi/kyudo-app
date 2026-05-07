/**
 * js/login.js - ログイン画面の処理
 *
 * 依存ファイル（この順番で HTML に記述すること）:
 *   1. supabase.js（CDN）
 *   2. js/supabase.js（接続設定・認証関数）
 *   3. js/login.js（このファイル）
 */

// ============================================================
// ログイン処理
// ============================================================

/**
 * ログインフォームの送信ハンドラ
 * HTML の <form onsubmit="handleLogin(event)"> から呼ばれる
 *
 * @param {Event} event - フォームの submit イベント
 */
async function handleLogin(event) {
  // デフォルトのフォーム送信（ページリロード）を防ぐ
  event.preventDefault();

  const email    = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const btn      = document.querySelector('.btn-login');

  // 入力チェック
  if (!email || !password) {
    showError('メールアドレスとパスワードを入力してください');
    return;
  }

  // ボタンをローディング状態にして二重送信を防ぐ
  btn.textContent = '接続中...';
  btn.disabled    = true;

  try {
    await signIn(email, password); // supabase.js の関数
    // ログイン成功 → ダッシュボードへ移動
    window.location.href = '/pages/dashboard.html';
  } catch (error) {
    // ログイン失敗 → エラーメッセージを表示してボタンを戻す
    showError('ログインに失敗しました：' + error.message);
    btn.innerHTML = 'ログイン <span class="btn-arrow">→</span>';
    btn.disabled  = false;
  }
}

// ============================================================
// 新規登録処理
// ============================================================

/**
 * 新規登録ボタンのクリックハンドラ
 * HTML の onclick="handleRegister()" から呼ばれる
 *
 * prompt() でメールとパスワードを入力させる簡易実装
 * （本番では専用の登録フォームページを作ることを推奨）
 */
async function handleRegister() {
  const email    = prompt('メールアドレスを入力してください');
  const password = prompt('パスワードを入力してください（6文字以上）');

  // キャンセルした場合は何もしない
  if (!email || !password) return;

  try {
    await signUp(email, password); // supabase.js の関数
    alert('登録メールを送信しました！\nメールを確認して認証を完了してください。');
  } catch (error) {
    showError('登録に失敗しました：' + error.message);
  }
}

// ============================================================
// エラー表示
// ============================================================

/**
 * フォームの下にエラーメッセージを表示する
 * 既存のエラーがあれば上書きする
 *
 * @param {string} message - 表示するエラーメッセージ
 */
function showError(message) {
  // 既存のエラー表示を削除
  const existing = document.getElementById('error-msg');
  if (existing) existing.remove();

  // 新しいエラー要素を作成してフォームに追加
  const el = document.createElement('p');
  el.id            = 'error-msg';
  el.textContent   = message;
  el.style.cssText = 'color: #c0392b; font-size: 12px; text-align: center; margin-top: 8px;';

  document.querySelector('.login-form').appendChild(el);
}
