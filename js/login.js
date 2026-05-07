// ============================================================
// login.js  ―  ログイン画面の処理
// ============================================================

// ════════════════════════════════════════
//  ログインフォーム送信
// ════════════════════════════════════════

/**
 * フォームの onsubmit から呼ばれる
 * メール・パスワードでSupabase認証を行い、成功したらダッシュボードへ
 */
async function handleLogin(event) {
  event.preventDefault(); // フォームのデフォルト送信（ページリロード）を止める

  const email    = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const btn      = document.querySelector('.btn-login');

  if (!email || !password) {
    showError('メールアドレスとパスワードを入力してください');
    return;
  }

  // ボタンをローディング状態にして二重送信を防ぐ
  btn.textContent = '接続中...';
  btn.disabled    = true;

  try {
    await signIn(email, password); // supabase.js の関数
    window.location.href = 'pages/dashboard.html';
  } catch (error) {
    showError('ログインに失敗しました：' + error.message);
    btn.innerHTML = 'ログイン <span class="btn-arrow">→</span>';
    btn.disabled  = false;
  }
}


// ════════════════════════════════════════
//  新規登録
// ════════════════════════════════════════

/**
 * 「新規登録」ボタンから呼ばれる
 * prompt でメール・パスワードを入力させてSupabaseに登録
 */
async function handleRegister() {
  const email    = prompt('メールアドレスを入力してください');
  const password = prompt('パスワードを入力してください（6文字以上）');

  if (!email || !password) return;

  try {
    await signUp(email, password); // supabase.js の関数
    alert('登録メールを送信しました！メールを確認して認証を完了してください。');
  } catch (error) {
    showError('登録に失敗しました：' + error.message);
  }
}


// ════════════════════════════════════════
//  パスワードリセット
// ════════════════════════════════════════

/**
 * 「パスワードをお忘れの方」リンクから呼ばれる
 * メールアドレスを入力させてSupabaseからリセットメールを送信する
 */
async function handleForgotPassword(event) {
  event.preventDefault();

  // メールアドレスを入力させる
  const email = prompt('登録したメールアドレスを入力してください');
  if (!email) return;

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      // リセット後にリダイレクトするURL（Vercelのドメインに合わせて自動で飛ぶ）
      redirectTo: window.location.origin + '/index.html',
    });
    if (error) throw error;
    alert('パスワードリセットメールを送信しました！\nメールを確認してください。');
  } catch (error) {
    alert('送信に失敗しました：' + error.message);
  }
}


// ════════════════════════════════════════
//  エラー表示
// ════════════════════════════════════════

/**
 * フォームの下にエラーメッセージを表示する
 * 既存のメッセージがあれば上書きする
 */
function showError(message) {
  const existing = document.getElementById('error-msg');
  if (existing) existing.remove();

  const el = document.createElement('p');
  el.id            = 'error-msg';
  el.textContent   = message;
  el.style.cssText = 'color:#c0392b; font-size:12px; text-align:center; margin-top:8px;';

  document.querySelector('.login-form').appendChild(el);
}
