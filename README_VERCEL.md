# Vercelデプロイ設定ガイド

## 必要な環境変数

Vercelのダッシュボードで以下の環境変数を設定してください：

### Supabase設定
```
VITE_SUPABASE_URL=あなたのSupabaseプロジェクトURL
VITE_SUPABASE_ANON_KEY=あなたのSupabase匿名キー
```

### Gemini API設定
```
GEMINI_API_KEY=あなたのGemini APIキー
GEMINI_MODEL=gemini-2.0-flash（オプション、デフォルト値）
```

## 設定手順

1. Vercelダッシュボードにログイン
2. プロジェクトを選択
3. 「設定」→「環境変数」に移動
4. 上記の環境変数を追加
5. 再デプロイ

## APIエンドポイント

以下のエンドポイントがVercel Functionsとして自動的にデプロイされます：

- `/api/ai/feedback` - 日記フィードバック
- `/api/ai/monthly` - 月次フィードバック
- `/api/ai/milestone` - マイルストーンフィードバック

## トラブルシューティング

### 「Failed to fetch」エラーが出る場合

1. **環境変数の確認**
   - Vercelダッシュボードで環境変数が正しく設定されているか確認
   - 特に`VITE_SUPABASE_URL`と`VITE_SUPABASE_ANON_KEY`が必須

2. **ブラウザのコンソールを確認**
   - 開発者ツール（F12）を開く
   - Consoleタブでエラーメッセージを確認
   - Networkタブでリクエストが失敗していないか確認

3. **Vercel Functionsのログを確認**
   - Vercelダッシュボードの「Functions」タブでログを確認
   - エラーが発生していないか確認

### ログインできない場合

- Supabaseの環境変数が正しく設定されているか確認
- SupabaseプロジェクトのURLとキーが正しいか確認
- ブラウザのコンソールでエラーメッセージを確認

