# KYUDO DOJO アプリ

## フォルダ構成

```
kyudo-dojo/
├── login.html     ← ログイン画面（今ここ）
├── login.css      ← ログイン画面のスタイル
├── login.js       ← ログイン処理（後でSupabase接続）
└── README.md      ← このファイル
```

## 今後追加予定のファイル

```
kyudo-dojo/
├── dashboard.html ← 道場ダッシュボード（的中記録）
├── mato.html      ← 的の位置記録
├── stats.html     ← 統計・分析
└── supabase.js    ← Supabase接続設定（後で作成）
```

## 開き方

`login.html` をブラウザにドラッグ＆ドロップするだけで開けます。
VSCodeの場合は「Live Server」拡張機能を使うと便利です。

## 学習ポイント（login.html）

- `<form>` タグ：入力フォームの作り方
- `onsubmit="handleLogin(event)"` ：ボタンを押したときの処理
- `event.preventDefault()` ：ページ再読込を防ぐ重要なコード

## 学習ポイント（login.css）

- `CSS変数（--green-dark など）`：色を一箇所で管理する方法
- `@keyframes cardIn`：アニメーションの書き方
- `:focus`：入力欄にフォーカスしたときのスタイル
- `position: relative / absolute`：アイコンをフィールド内に置く方法
