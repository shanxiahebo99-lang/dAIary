import { GoogleGenAI } from '@google/genai';

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

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { streak, personality, customInstruction } = await req.json();

    if (typeof streak !== 'number' || streak <= 0) {
      return new Response(JSON.stringify({ error: 'streak is required (number > 0)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const validPersonalities = ['supportive', 'strict', 'philosophical', 'custom'];
    if (personality && !validPersonalities.includes(personality)) {
      return new Response(JSON.stringify({ error: 'invalid personality' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const ai = new GoogleGenAI({ apiKey });

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
      return new Response(JSON.stringify({
        error: 'AIの応答がJSON形式ではありませんでした',
        raw: text,
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ feedback: json.feedback }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('❌ milestone error:', err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

