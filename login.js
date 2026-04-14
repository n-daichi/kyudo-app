// ===========================
// KYUDO DOJO - ログイン処理
// ===========================
// Supabaseの認証を使ってログイン・新規登録する

async function handleLogin(event) {
  event.preventDefault();

  const email    = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const btn      = document.querySelector('.btn-login');

  if (!email || !password) {
    showError('メールアドレスとパスワードを入力してください');
    return;
  }

  // ボタンをローディング状態にする
  btn.textContent = '接続中...';
  btn.disabled    = true;

  try {
    await signIn(email, password);
    // ログイン成功 → ダッシュボードへ
    window.location.href = 'dashboard.html';
  } catch (error) {
    showError('ログインに失敗しました：' + error.message);
    btn.innerHTML = 'ログイン <span class="btn-arrow">→</span>';
    btn.disabled  = false;
  }
}

async function handleRegister() {
  const email    = prompt('メールアドレスを入力してください');
  const password = prompt('パスワードを入力してください（6文字以上）');

  if (!email || !password) return;

  try {
    await signUp(email, password);
    alert('登録メールを送信しました！メールを確認して認証を完了してください。');
  } catch (error) {
    showError('登録に失敗しました：' + error.message);
  }
}

function showError(message) {
  // 既存のエラー表示を消す
  const existing = document.getElementById('error-msg');
  if (existing) existing.remove();

  const el = document.createElement('p');
  el.id          = 'error-msg';
  el.textContent = message;
  el.style.cssText = 'color:#c0392b; font-size:12px; text-align:center; margin-top:8px;';

  document.querySelector('.login-form').appendChild(el);
}
