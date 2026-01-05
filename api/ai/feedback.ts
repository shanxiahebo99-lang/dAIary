import { GoogleGenAI } from '@google/genai';

function extractFirstJsonObject(text: string): any {
  // Markdownコードブロック（```json ... ```）の中のJSONを抽出
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch (e) {
      // コードブロック内のパースが失敗した場合は次に進む
    }
  }
  
  // コードブロックがない場合、最初の {...} を抽出
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
    const { content, personality, customInstruction } = await req.json();

    // 入力値検証
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return new Response(JSON.stringify({ error: 'content is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (content.length > 10000) {
      return new Response(JSON.stringify({ error: 'content is too long (max 10000 characters)' }), {
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

    let sanitizedCustomInstruction: string | undefined = undefined;
    if (personality === 'custom') {
      if (!customInstruction || typeof customInstruction !== 'string' || customInstruction.trim() === '') {
        return new Response(JSON.stringify({ error: 'customInstruction is required when personality is custom' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (customInstruction.length > 500) {
        return new Response(JSON.stringify({ error: 'customInstruction is too long (max 500 characters)' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      sanitizedCustomInstruction = customInstruction.trim();
    }

    const sanitizedContent = content.trim();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const ai = new GoogleGenAI({ apiKey });

    // Build prompt based on personality
    let promptText = '';
    if (personality === 'custom' && sanitizedCustomInstruction) {
      promptText = `${sanitizedCustomInstruction}\n\n`;
    } else {
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
      return new Response(JSON.stringify({
        error: 'AIの応答がJSON形式ではありませんでした',
        raw: text,
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      feedback: json.feedback,
      mood: typeof json.mood === 'string' ? json.mood : '不明',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('❌ feedback error:', err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

