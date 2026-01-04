console.log('🔥 THIS IS THE REAL SERVER.TS 🔥');

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

/* ===============================
   middleware
================================ */
app.use(express.json());

// CORS設定
// 開発環境: すべてのオリジンを許可（開発用）
// 本番環境では、特定のオリジンのみを許可するように変更してください
// 例: origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com']
app.use(
  cors({
    origin: (_origin, cb) => cb(null, true), // 本番では適切なオリジンのみ許可
    credentials: true,
  })
);

/* ===============================
   ENV CHECK
================================ */
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY が設定されていません（.env.local を確認してください）');
  process.exit(1);
}
console.log('✅ GEMINI_API_KEY 読み込み成功');

/* ===============================
   Gemini 初期化（@google/genai）
================================ */
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function extractFirstJsonObject(text: string): any {
  // Markdownコードブロック（```json ... ```）の中のJSONを抽出
  // まずコードブロック内を探す
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch (e) {
      // コードブロック内のパースが失敗した場合は次に進む
    }
  }
  
  // コードブロックがない場合、またはコードブロック内のパースが失敗した場合
  // 最初の {...} を抽出（貪欲マッチ）
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    // パースが失敗した場合、より保守的なアプローチを試す
    // ネストされたJSONオブジェクトを考慮
    let braceCount = 0;
    let startIndex = -1;
    for (let i = 0; i < match[0].length; i++) {
      if (match[0][i] === '{') {
        if (startIndex === -1) startIndex = i;
        braceCount++;
      } else if (match[0][i] === '}') {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          try {
            return JSON.parse(match[0].substring(startIndex, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }
}

/* ===============================
   health check
================================ */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/* ===============================
   日記フィードバック
================================ */
app.post('/api/ai/feedback', async (req, res) => {
  try {
    const { content, personality, customInstruction } = req.body ?? {};

    // 入力値検証
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({ error: 'content is required' });
    }

    // コンテンツの長さ制限（攻撃防止）
    if (content.length > 10000) {
      return res.status(400).json({ error: 'content is too long (max 10000 characters)' });
    }

    // personalityの検証
    const validPersonalities = ['supportive', 'strict', 'philosophical', 'custom'];
    if (personality && !validPersonalities.includes(personality)) {
      return res.status(400).json({ error: 'invalid personality' });
    }

    // customInstructionの検証
    let sanitizedCustomInstruction: string | undefined = undefined;
    if (personality === 'custom') {
      if (!customInstruction || typeof customInstruction !== 'string' || customInstruction.trim() === '') {
        return res.status(400).json({ error: 'customInstruction is required when personality is custom' });
      }
      if (customInstruction.length > 500) {
        return res.status(400).json({ error: 'customInstruction is too long (max 500 characters)' });
      }
      sanitizedCustomInstruction = customInstruction.trim();
    }

    // 基本的なサニタイゼーション
    const sanitizedContent = content.trim();

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    // Build prompt based on personality
    let promptText = '';
    if (personality === 'custom' && sanitizedCustomInstruction) {
      // Custom mode: use user's custom instruction
      promptText = `${sanitizedCustomInstruction}\n\n`;
    } else {
      // Standard modes
      const role =
        personality === 'strict'
          ? '熱血コーチ'
          : personality === 'philosophical'
          ? '静かな賢者'
          : '優しい親友';
      promptText = `あなたは${role}です。\n\n`;
    }
    
    promptText += `ユーザーの日記：\n「${sanitizedContent}」\n\n`;
    promptText += `150文字以内で寄り添ったコメントをしてください。\n必ず以下の JSON 形式のみで返してください。\n\n{"feedback":"コメント","mood":"感情"}`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ text: promptText }],
    });

    const text = response.text ?? '';
    const json = extractFirstJsonObject(text);

    if (!json || typeof json.feedback !== 'string') {
      console.error('❌ Gemini response not JSON:', text);
      return res.status(502).json({
        error: 'AIの応答がJSON形式ではありませんでした',
        raw: text,
      });
    }

    return res.json({
      feedback: json.feedback,
      mood: typeof json.mood === 'string' ? json.mood : '不明',
    });
  } catch (err: any) {
    console.error('❌ feedback error:', err);
    res.status(500).json({ error: err?.message || String(err) });
  }
});

/* ===============================
   週次レポート（フロント側が呼んでいる /api/ai/weekly を実装）
================================ */
app.post('/api/ai/weekly', async (req, res) => {
  try {
    const { entries, personality } = req.body ?? {};

    // 入力値検証
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries is required (array)' });
    }

    // エントリ数の制限（攻撃防止）
    if (entries.length > 100) {
      return res.status(400).json({ error: 'too many entries (max 100)' });
    }

    // personalityの検証
    const validPersonalities = ['supportive', 'strict', 'philosophical', 'custom'];
    if (personality && !validPersonalities.includes(personality)) {
      return res.status(400).json({ error: 'invalid personality' });
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    const role =
      personality === 'strict'
        ? '熱血コーチ'
        : personality === 'philosophical'
        ? '静かな賢者'
        : '優しい親友';

    const formatted = entries
      .slice(-14) // 長すぎるとトークン消費するので直近だけ
      .map((e: any, i: number) => {
        const date = e?.date ?? `Day${i + 1}`;
        const content = e?.content ?? '';
        const feedback = e?.aiFeedback ?? '';
        return `【${date}】\n日記: ${content}\nAI: ${feedback}`;
      })
      .join('\n\n');

    const prompt = `
あなたは${role}です。

以下はユーザーの日記のログです。1週間分の振り返りレポートを日本語で作ってください。
- 200〜500文字程度
- 良かった点 / 変化 / 次週の小さな提案（押し付けない）
- 出力は必ず JSON で返す

日記ログ:
${formatted}

{"report":"ここにレポート本文"}
`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });

    const text = response.text ?? '';
    const json = extractFirstJsonObject(text);

    if (!json || typeof json.report !== 'string') {
      console.error('❌ weekly response not JSON:', text);
      return res.status(502).json({
        error: 'AIの応答がJSON形式ではありませんでした',
        raw: text,
      });
    }

    return res.json({ report: json.report });
  } catch (err: any) {
    console.error('❌ weekly error:', err);
    res.status(500).json({ error: err?.message || String(err) });
  }
});

/* ===============================
   月次フィードバック
================================ */
app.post('/api/ai/monthly', async (req, res) => {
  try {
    const { entries, personality, customInstruction } = req.body ?? {};

    // 入力値検証
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries is required (array)' });
    }

    // エントリ数の制限
    if (entries.length > 100) {
      return res.status(400).json({ error: 'too many entries (max 100)' });
    }

    // personalityの検証
    const validPersonalities = ['supportive', 'strict', 'philosophical', 'custom'];
    if (personality && !validPersonalities.includes(personality)) {
      return res.status(400).json({ error: 'invalid personality' });
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    // Build prompt based on personality
    let rolePrompt = '';
    if (personality === 'custom' && customInstruction && customInstruction.trim()) {
      rolePrompt = customInstruction;
    } else {
      const role =
        personality === 'strict'
          ? '熱血コーチ'
          : personality === 'philosophical'
          ? '静かな賢者'
          : '優しい親友';
      rolePrompt = `あなたは${role}です。`;
    }

    const formatted = entries
      .map((e: any) => {
        const date = e?.date ?? '';
        const content = e?.content ?? '';
        return `【${date}】\n${content}`;
      })
      .join('\n\n');

    const prompt = `
${rolePrompt}

以下はユーザーの今月の日記のログです。1か月分の振り返りとモチベーションを上げるフィードバックを日本語で作ってください。
- 300〜600文字程度
- この1か月の成長や変化を認める
- 前向きで励ましの言葉を
- 出力は必ず JSON で返す

日記ログ:
${formatted}

{"feedback":"ここにフィードバック本文"}
`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ text: prompt }],
    });

    const text = response.text ?? '';
    const json = extractFirstJsonObject(text);

    if (!json || typeof json.feedback !== 'string') {
      console.error('❌ monthly response not JSON:', text);
      return res.status(502).json({
        error: 'AIの応答がJSON形式ではありませんでした',
        raw: text,
      });
    }

    return res.json({ feedback: json.feedback });
  } catch (err: any) {
    console.error('❌ monthly error:', err);
    res.status(500).json({ error: err?.message || String(err) });
  }
});

/* ===============================
   マイルストーンフィードバック（10日、20日、30日...）
================================ */
app.post('/api/ai/milestone', async (req, res) => {
  try {
    const { streak, personality, customInstruction } = req.body ?? {};

    // 入力値検証
    if (typeof streak !== 'number' || streak <= 0) {
      return res.status(400).json({ error: 'streak is required (number > 0)' });
    }

    // personalityの検証
    const validPersonalities = ['supportive', 'strict', 'philosophical', 'custom'];
    if (personality && !validPersonalities.includes(personality)) {
      return res.status(400).json({ error: 'invalid personality' });
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    // Build prompt based on personality
    let rolePrompt = '';
    if (personality === 'custom' && customInstruction && customInstruction.trim()) {
      rolePrompt = customInstruction;
    } else {
      const role =
        personality === 'strict'
          ? '熱血コーチ'
          : personality === 'philosophical'
          ? '静かな賢者'
          : '優しい親友';
      rolePrompt = `あなたは${role}です。`;
    }

    const prompt = `
${rolePrompt}

ユーザーが${streak}日連続で日記を記録しました！🎉

このマイルストーンを祝い、モチベーションを上げるフィードバックを日本語で作ってください。
- 200〜400文字程度
- 達成を祝福する
- 継続の意義を伝える
- 前向きで励ましの言葉を
- 出力は必ず JSON で返す

{"feedback":"ここにフィードバック本文"}
`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ text: prompt }],
    });

    const text = response.text ?? '';
    const json = extractFirstJsonObject(text);

    if (!json || typeof json.feedback !== 'string') {
      console.error('❌ milestone response not JSON:', text);
      return res.status(502).json({
        error: 'AIの応答がJSON形式ではありませんでした',
        raw: text,
      });
    }

    return res.json({ feedback: json.feedback });
  } catch (err: any) {
    console.error('❌ milestone error:', err);
    res.status(500).json({ error: err?.message || String(err) });
  }
});

/* ===============================
   listen
================================ */
app.listen(PORT, () => {
  console.log(`🚀 AI Server running on http://localhost:${PORT}`);
});
