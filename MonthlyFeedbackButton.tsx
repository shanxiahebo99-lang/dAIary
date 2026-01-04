import React, { useState } from 'react';
import { DiaryEntry, UserProfile } from './types';

interface MonthlyFeedbackButtonProps {
  entries: DiaryEntry[];
  year: number;
  month: number;
  personality: UserProfile['personality'];
  customInstruction?: string;
}

const MonthlyFeedbackButton: React.FC<MonthlyFeedbackButtonProps> = ({
  entries,
  year,
  month,
  personality,
  customInstruction,
}) => {
  const [monthlyFeedback, setMonthlyFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGetMonthlyFeedback = async () => {
    // Get entries for the specified month
    const monthlyEntries = entries.filter(e => {
      const entryDate = new Date(e.date);
      return entryDate.getFullYear() === year && entryDate.getMonth() === month;
    });

    if (monthlyEntries.length === 0) {
      alert('この月には記録がありません');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: monthlyEntries,
          personality,
          customInstruction: personality === 'custom' ? customInstruction : undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setMonthlyFeedback(data.feedback);
    } catch (e: any) {
      console.error(e);
      alert(`AIとの通信に失敗しました: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const monthName = new Date(year, month).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div className="glass-card-strong p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-800 mb-1">{monthName}の振り返り</h3>
          <p className="text-sm text-gray-600">この月の記録を踏まえたフィードバック</p>
        </div>
        <button
          onClick={handleGetMonthlyFeedback}
          disabled={isLoading}
          className="modern-button whitespace-nowrap"
        >
          {isLoading ? '分析中...' : 'フィードバック取得'}
        </button>
      </div>

      {monthlyFeedback && (
        <div className="mt-4 ai-feedback-glow p-4 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-xl">📊</span>
            <div className="flex-1">
              <p className="soft-text leading-relaxed whitespace-pre-wrap">{monthlyFeedback}</p>
              <button
                onClick={() => setMonthlyFeedback(null)}
                className="mt-3 text-sm text-pink-600 hover:text-pink-700 font-medium"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyFeedbackButton;



