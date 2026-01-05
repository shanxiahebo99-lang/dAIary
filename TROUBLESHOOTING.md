# トラブルシューティングガイド

## 「Failed to fetch」エラーの原因と解決方法

### エラーの意味

`TypeError: Failed to fetch` は、ブラウザがSupabaseサーバーへのリクエストを送信できなかったことを意味します。

### 主な原因

1. **環境変数が正しく設定されていない**
   - Vercelで環境変数が設定されていても、ビルド時に正しく注入されていない可能性があります

2. **Supabase URLが間違っている**
   - URLに`https://`が含まれているか確認
   - 末尾に`/`がないか確認

3. **CORSの問題**
   - Supabaseの設定で、Vercelのドメインが許可されているか確認

4. **ネットワークの問題**
   - ブラウザの開発者ツールのNetworkタブで、リクエストが送信されているか確認

### 解決手順

#### ステップ1: 環境変数の確認

ブラウザのコンソール（F12）で以下を実行：

```javascript
console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '設定済み' : '未設定');
```

**期待される結果：**
- `URL:` に `https://xxxxx.supabase.co` のようなURLが表示される
- `Key:` に `設定済み` と表示される

**もし `undefined` が表示される場合：**
- Vercelの環境変数が正しく設定されていない
- 再デプロイが必要

#### ステップ2: Vercel環境変数の再確認

1. Vercelダッシュボード → プロジェクト → 設定 → 環境変数
2. 以下が設定されているか確認：
   - `VITE_SUPABASE_URL`（値は `https://xxxxx.supabase.co` 形式）
   - `VITE_SUPABASE_ANON_KEY`（長い文字列）
3. **重要**: 環境変数名は `VITE_` で始まる必要があります
4. 設定後、**必ず再デプロイ**してください

#### ステップ3: Supabase設定の確認

1. Supabaseダッシュボードにログイン
2. プロジェクト → Settings → API
3. 以下を確認：
   - **Project URL**: これが `VITE_SUPABASE_URL` の値
   - **anon public key**: これが `VITE_SUPABASE_ANON_KEY` の値

#### ステップ4: CORS設定の確認

1. Supabaseダッシュボード → Settings → API
2. 「CORS」セクションを確認
3. Vercelのドメイン（例：`https://your-app.vercel.app`）が許可されているか確認
4. 許可されていない場合は、追加してください

#### ステップ5: ブラウザのNetworkタブで確認

1. ブラウザの開発者ツール（F12）を開く
2. Networkタブを開く
3. ログインを試みる
4. 失敗したリクエストをクリック
5. 以下を確認：
   - **Request URL**: SupabaseのURLが正しいか
   - **Status**: エラーステータスコード（例：404, 500, CORS error）
   - **Response**: エラーメッセージの内容

### よくある間違い

❌ **間違い1**: 環境変数名が `SUPABASE_URL` になっている
✅ **正解**: `VITE_SUPABASE_URL` である必要があります

❌ **間違い2**: 環境変数を設定したが再デプロイしていない
✅ **正解**: 環境変数を変更したら必ず再デプロイが必要です

❌ **間違い3**: Supabase URLに末尾の `/` が含まれている
✅ **正解**: URLは `https://xxxxx.supabase.co` のように末尾に `/` がない形式

### デバッグ用コード

現在のコードには、コンソールに環境変数の状態を表示するデバッグコードが追加されています。
ブラウザのコンソールを確認して、環境変数が正しく読み込まれているか確認してください。

