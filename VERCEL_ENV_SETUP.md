# Vercel環境変数設定ガイド

## ⚠️ **重要な注意点**

**`.env.local`はVercelでは使えません！**

Vercelでは、環境変数を**Vercelダッシュボードで設定する必要があります**。

---

## 📋 **必要な環境変数**

Vercelダッシュボードで以下の環境変数を設定してください：

### 1. Supabase設定（クライアント側用）
```
VITE_SUPABASE_URL=あなたのSupabaseプロジェクトURL
VITE_SUPABASE_ANON_KEY=あなたのSupabase匿名キー
```

### 2. Gemini API設定（サーバー側用）
```
GEMINI_API_KEY=あなたのGemini APIキー
GEMINI_MODEL=gemini-2.0-flash（オプション、デフォルト値）
```

---

## 🔧 **設定手順（詳細）**

### ステップ1: Vercelダッシュボードにアクセス

1. https://vercel.com にログイン
2. プロジェクトを選択

### ステップ2: 環境変数を設定

1. **「設定」タブ**をクリック
2. **「環境変数」**セクションを開く
3. 以下の環境変数を追加：

#### 環境変数1: `VITE_SUPABASE_URL`
- **キー**: `VITE_SUPABASE_URL`
- **値**: Supabaseダッシュボードの「Settings」→「API」→「Project URL」
- **環境**: `Production`, `Preview`, `Development` すべてにチェック

#### 環境変数2: `VITE_SUPABASE_ANON_KEY`
- **キー**: `VITE_SUPABASE_ANON_KEY`
- **値**: Supabaseダッシュボードの「Settings」→「API」→「anon public key」
- **環境**: `Production`, `Preview`, `Development` すべてにチェック

#### 環境変数3: `GEMINI_API_KEY`
- **キー**: `GEMINI_API_KEY`
- **値**: あなたのGemini APIキー（`.env.local`にある値と同じ）
- **環境**: `Production`, `Preview`, `Development` すべてにチェック
- **重要**: `VITE_`プレフィックスは**付けない**（サーバー側用）

#### 環境変数4: `GEMINI_MODEL`（オプション）
- **キー**: `GEMINI_MODEL`
- **値**: `gemini-2.0-flash`（デフォルト値なので設定しなくてもOK）
- **環境**: `Production`, `Preview`, `Development` すべてにチェック

### ステップ3: 再デプロイ

環境変数を設定したら、**必ず再デプロイ**してください：

1. 「Deployments」タブを開く
2. 最新のデプロイメントの「...」メニューをクリック
3. 「Redeploy」を選択
4. または、GitHubにpushして自動デプロイをトリガー

---

## ✅ **確認方法**

### 方法1: Vercel Functionsのログを確認

1. Vercelダッシュボード → 「Functions」タブ
2. `/api/ai/feedback`をクリック
3. ログを確認
4. `GEMINI_API_KEY is not configured`というエラーが出ていないか確認

### 方法2: ブラウザのコンソールで確認

1. ブラウザの開発者ツール（F12）を開く
2. Consoleタブで以下を実行：

```javascript
// Supabase環境変数（クライアント側）
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '設定済み' : '未設定');
```

**注意**: `GEMINI_API_KEY`はサーバー側でのみ使用されるため、ブラウザのコンソールでは確認できません。

---

## 🐛 **トラブルシューティング**

### 問題1: 環境変数を設定したが、まだエラーが出る

**解決策**:
1. 環境変数を設定した後、**必ず再デプロイ**してください
2. 環境変数の名前が正しいか確認（`VITE_SUPABASE_URL`、`GEMINI_API_KEY`など）
3. 値に余分なスペースや改行が含まれていないか確認

### 問題2: `GEMINI_API_KEY is not configured`エラーが出る

**解決策**:
1. Vercelダッシュボードで`GEMINI_API_KEY`が設定されているか確認
2. **重要**: `VITE_GEMINI_API_KEY`ではなく、`GEMINI_API_KEY`であることを確認
3. 環境変数の「環境」で`Production`にチェックが入っているか確認
4. 再デプロイを実行

### 問題3: Supabaseの環境変数が`undefined`になる

**解決策**:
1. 環境変数名が`VITE_SUPABASE_URL`と`VITE_SUPABASE_ANON_KEY`であることを確認
2. `VITE_`プレフィックスが正しく付いているか確認
3. 再デプロイを実行

---

## 📝 **`.env.local`との違い**

| 項目 | `.env.local`（ローカル開発） | Vercel環境変数（本番） |
|------|---------------------------|---------------------|
| 設定場所 | プロジェクトルートの`.env.local`ファイル | Vercelダッシュボード |
| 読み込み方法 | `dotenv.config()` | 自動的に`process.env`に注入 |
| クライアント側 | `VITE_`プレフィックスが必要 | `VITE_`プレフィックスが必要 |
| サーバー側 | `process.env.GEMINI_API_KEY` | `process.env.GEMINI_API_KEY` |

---

## 🎯 **まとめ**

1. **`.env.local`はVercelでは使えない**
2. **Vercelダッシュボードで環境変数を設定する**
3. **環境変数を設定したら、必ず再デプロイする**
4. **クライアント側用**: `VITE_`プレフィックスが必要
5. **サーバー側用**: `VITE_`プレフィックスは不要

