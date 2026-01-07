import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function extractFirstJsonObject(text: string): any {
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch (e) {}
  }
  
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORSヘッダー
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // CORS preflight リクエストの処理
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🔍 Monthly feedback - Environment check:');
  console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ 設定済み' : '❌ 未設定');

  try {
    const { entries, personality, customInstruction } = req.body || {};

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries is required (array)' });
    }

    if (entries.length > 100) {
      return res.status(400).json({ error: 'too many entries (max 100)' });
    }

    const validPersonalities = ['supportive', 'strict', 'philosophical', 'custom'];
    if (personality && !validPersonalities.includes(personality)) {
      return res.status(400).json({ error: 'invalid personality' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY is not configured in Vercel environment variables');
      return res.status(500).json({ 
        error: 'GEMINI_API_KEY is not configured. Please set it in Vercel environment variables.',
        hint: 'Vercelダッシュボード → 設定 → 環境変数 → GEMINI_API_KEY を追加してください'
      });
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const json = extractFirstJsonObject(text);

    if (!json || typeof json.feedback !== 'string') {
      console.error('❌ monthly response not JSON:', text);
      return res.status(502).json({
        error: 'AIの応答がJSON形式ではありませんでした',
        raw: text,
      });
    }

    return res.status(200).json({ feedback: json.feedback });
  } catch (err: any) {
    console.error('❌ monthly error:', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
