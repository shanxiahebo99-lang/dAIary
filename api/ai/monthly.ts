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
    const { entries, personality, customInstruction } = await req.json();

    if (!Array.isArray(entries) || entries.length === 0) {
      return new Response(JSON.stringify({ error: 'entries is required (array)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (entries.length > 100) {
      return new Response(JSON.stringify({ error: 'too many entries (max 100)' }), {
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
    console.error('❌ monthly error:', err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

