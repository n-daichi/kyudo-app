# KYUDO DOJO アプリ

## フォルダ構成

```
kyudo-app/
├── login.html          ← ログイン画面（ルート）
├── vercel.json         ← Vercel のルーティング設定
├── .gitignore          ← js/supabase.js を除外
│
├── pages/              ← 各ページの HTML
│   ├── dashboard.html  ← 道場（的中記録）
│   ├── mato.html       ← 的の位置記録
│   ├── stats.html      ← 統計・分析
│   ├── profile.html    ← プロフィール設定
│   └── support.html    ← サポート・FAQ
│
├── css/                ← スタイルシート
│   ├── common.css      ← 全ページ共通（サイドバー・ヘッダー等）
│   ├── login.css       ← ログイン画面専用
│   ├── dashboard.css   ← ダッシュボード専用
│   ├── mato.css        ← 的の位置記録専用
│   ├── stats.css       ← 統計・分析専用
│   ├── profile.css     ← プロフィール専用
│   └── support.css     ← サポート専用
│
└── js/                 ← JavaScript
    ├── supabase.js     ← DB接続・認証（⚠️ .gitignore に追加済み）
    ├── utils.js        ← 全ページ共通の関数
    ├── login.js        ← ログイン画面
    ├── dashboard.js    ← ダッシュボード
    ├── mato.js         ← 的の位置記録
    ├── stats.js        ← 統計・分析
    ├── profile.js      ← プロフィール
    └── support.js      ← サポート
```

## JS の読み込み順（各 HTML 共通）

```html
<script src="../js/supabase.js"></script>  <!-- 1. DB接続 -->
<script src="../js/utils.js"></script>     <!-- 2. 共通関数 -->
<script src="../js/〇〇.js"></script>      <!-- 3. ページ固有 -->
```

## 開き方（ローカル開発）

VSCode の「Live Server」拡張機能で `login.html` を開く

## Vercel へのデプロイ

1. `js/supabase.js` の URL と KEY を環境変数に移行
2. GitHub にプッシュ
3. Vercel で GitHub リポジトリを接続
