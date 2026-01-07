// services/geminiService.ts
import { DiaryEntry, UserProfile } from '../types';

// Vercel Functionsを使用するため、相対パスを使用
const API_BASE = '/api/ai';

export const generateDailyFeedback = async (
  content: string,
  profile: UserProfile,
  entries: DiaryEntry[]
): Promise<{ feedback: string; mood: string }> => {
  try {
    const response = await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        personality: profile.personality,
        entries,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Server error response:', errorData);
      throw new Error(`Server error: ${response.status} - ${errorData.error || errorData.details || 'Unknown error'}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('generateDailyFeedback error:', error);
    if (error.message?.includes('fetch')) {
      throw new Error('サーバーに接続できません。サーバーが起動しているか確認してください。');
    }
    throw error;
  }
};

export const generateWeeklySummary = async (
  entries: DiaryEntry[],
  profile: UserProfile
): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE}/weekly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries,
        personality: profile.personality,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Server error response:', errorData);
      throw new Error(`Server error: ${response.status} - ${errorData.error || errorData.details || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.report;
  } catch (error: any) {
    console.error('generateWeeklySummary error:', error);
    if (error.message?.includes('fetch')) {
      throw new Error('サーバーに接続できません。サーバーが起動しているか確認してください。');
    }
    throw error;
  }
};
