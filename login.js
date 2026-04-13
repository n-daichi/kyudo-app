// ===========================
// KYUDO DOJO - ログイン処理
// ===========================
// ※ 現在はダミーのログイン処理です
//    後でSupabaseと接続します

function handleLogin(event) {
  event.preventDefault(); // ページリロードを防ぐ

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  // 入力チェック
  if (!email || !password) {
    alert('メールアドレスとパスワードを入力してください');
    return;
  }

  // ダミーログイン（後でSupabaseに置き換え）
  console.log('ログイン試行:', email);
  alert('ログイン成功！（現在はダミー）\n次のステップでSupabaseと接続します');

  // 本番では → window.location.href = 'dashboard.html';
}
