import React, { useState, useEffect, useMemo } from 'react';
import { DiaryEntry, UserProfile, TabType } from './types';
import Login from './Login';
import { supabase } from './supabase';
import Calendar from './Calendar';
import MyPage from './MyPage';
import MonthlyFeedbackButton from './MonthlyFeedbackButton';
import { saveDiaryEntry, getDiaryEntries, saveUserProfile, getUserProfile } from './supabaseService';

const App: React.FC = () => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    name: 'ユーザー',
    personality: 'supportive',
    customInstruction: '',
  });
  const [currentTab, setCurrentTab] = useState<TabType>('record');
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  // Helper function to get today's date string
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<DiaryEntry[]>([]);
  const [milestoneFeedback, setMilestoneFeedback] = useState<string | null>(null);
  const [celebratedMilestones, setCelebratedMilestones] = useState<Set<number>>(new Set());
  const [newEntryFeedback, setNewEntryFeedback] = useState<{ entry: DiaryEntry; showPopup: boolean } | null>(null);
  
  // Reset to today's date when switching to record tab
  useEffect(() => {
    if (currentTab === 'record') {
      setSelectedDate(getTodayDateString());
    }
  }, [currentTab]);

  // Load celebrated milestones from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('celebrated_milestones');
    if (saved) {
      setCelebratedMilestones(new Set(JSON.parse(saved)));
    }
  }, []);

  // Save celebrated milestones to localStorage
  useEffect(() => {
    localStorage.setItem('celebrated_milestones', JSON.stringify(Array.from(celebratedMilestones)));
  }, [celebratedMilestones]);

  /* ---------------- 認証 ---------------- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setIsAuthenticated(!!s);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  /* ---------------- Load data from Supabase ---------------- */
  useEffect(() => {
    const loadData = async () => {
      if (!isAuthenticated) return;
      
      try {
        // Load entries from Supabase
        const loadedEntries = await getDiaryEntries();
        setEntries(loadedEntries);
        
        // Load profile from Supabase
        const loadedProfile = await getUserProfile();
        if (loadedProfile) {
          setProfile(loadedProfile);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        // Fallback to localStorage if Supabase fails
        const savedEntries = localStorage.getItem('ai_diary_entries');
        const savedProfile = localStorage.getItem('ai_diary_profile');
        if (savedEntries) setEntries(JSON.parse(savedEntries));
        if (savedProfile) setProfile(JSON.parse(savedProfile));
      }
    };
    
    loadData();
  }, [isAuthenticated]);

  /* ---------------- Save profile to Supabase ---------------- */
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const saveProfile = async () => {
      try {
        await saveUserProfile(profile);
      } catch (error) {
        console.error('Error saving profile:', error);
        // Fallback to localStorage
        localStorage.setItem('ai_diary_profile', JSON.stringify(profile));
      }
    };
    
    saveProfile();
  }, [profile, isAuthenticated]);

  /* ---------------- Daily Streak Calculation ---------------- */
  const dailyStreak = useMemo(() => {
    if (entries.length === 0) return 0;
    
    const sortedEntries = [...entries].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    for (let i = 0; i < sortedEntries.length; i++) {
      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - i);
      const expectedYear = expectedDate.getFullYear();
      const expectedMonth = String(expectedDate.getMonth() + 1).padStart(2, '0');
      const expectedDay = String(expectedDate.getDate()).padStart(2, '0');
      const expectedDateStr = `${expectedYear}-${expectedMonth}-${expectedDay}`;
      
      if (sortedEntries[i].date === expectedDateStr) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }, [entries]);

  /* ---------------- Get Selected Date Entries ---------------- */
  useEffect(() => {
    const dateEntries = entries.filter(e => e.date === selectedDate);
    setSelectedEntries(dateEntries);
  }, [entries, selectedDate]);

  /* ---------------- Format Date for Display ---------------- */
  const formatDateForDisplay = (dateStr: string): string => {
    try {
      const [year, month, day] = dateStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('ja-JP', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  /* ---------------- 日記送信 ---------------- */
  const handleSubmit = async () => {
    if (!inputText.trim()) return;
    setIsAnalyzing(true);

    try {
      const apiUrl = '/api/ai/feedback';
      console.log('📤 APIリクエスト送信:', apiUrl);
      console.log('📤 リクエストボディ:', {
        content: inputText.substring(0, 50) + '...',
        personality: profile.personality,
        hasCustomInstruction: !!profile.customInstruction,
      });
      
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: inputText,
          personality: profile.personality,
          customInstruction: profile.personality === 'custom' ? profile.customInstruction : undefined,
        }),
      });

      console.log('📥 APIレスポンス:', res.status, res.statusText);
      console.log('📥 APIレスポンスヘッダー:', Object.fromEntries(res.headers.entries()));

      if (!res.ok) {
        const text = await res.text();
        console.error('❌ APIエラー:', text);
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();

      // Use selected date
      const newEntry: DiaryEntry = {
        id: Date.now().toString(),
        date: selectedDate,
        content: inputText,
        feedback: data.feedback,
        mood: data.mood,
      };

      // Show feedback in popup first
      setNewEntryFeedback({ entry: newEntry, showPopup: true });

      const updatedEntries = [newEntry, ...entries];
      setEntries(updatedEntries);
      setInputText('');

      // Save to Supabase
      try {
        await saveDiaryEntry(newEntry);
      } catch (error) {
        console.error('Error saving diary entry:', error);
        // Fallback to localStorage
        localStorage.setItem('ai_diary_entries', JSON.stringify(updatedEntries));
      }

      // Check for milestone (10, 20, 30, 40, 50, ...)
      // Recalculate streak after adding new entry
      const sortedEntries = [...updatedEntries].sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      let newStreak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      
      for (let i = 0; i < sortedEntries.length; i++) {
        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - i);
        const expectedYear = expectedDate.getFullYear();
        const expectedMonth = String(expectedDate.getMonth() + 1).padStart(2, '0');
        const expectedDay = String(expectedDate.getDate()).padStart(2, '0');
        const expectedDateStr = `${expectedYear}-${expectedMonth}-${expectedDay}`;
        
        if (sortedEntries[i].date === expectedDateStr) {
          newStreak++;
        } else {
          break;
        }
      }

      // Check if this is a milestone (10, 20, 30, 40, ...)
      if (newStreak > 0 && newStreak % 10 === 0 && !celebratedMilestones.has(newStreak)) {
        try {
          const milestoneRes = await fetch('/api/ai/milestone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              streak: newStreak,
              personality: profile.personality,
              customInstruction: profile.personality === 'custom' ? profile.customInstruction : undefined,
            }),
          });

          if (milestoneRes.ok) {
            const milestoneData = await milestoneRes.json();
            setMilestoneFeedback(milestoneData.feedback);
            setCelebratedMilestones(new Set([...celebratedMilestones, newStreak]));
          }
        } catch (err) {
          console.error('Milestone feedback error:', err);
        }
      }
    } catch (e: any) {
      console.error('❌ AI通信エラー:', e);
      console.error('エラー詳細:', {
        message: e.message,
        stack: e.stack,
        name: e.name,
      });
      
      // より詳細なエラーメッセージを表示
      let errorMessage = 'AIとの通信に失敗しました';
      if (e.message) {
        errorMessage += `: ${e.message}`;
      }
      if (e.message?.includes('Failed to fetch')) {
        errorMessage += '\n\n考えられる原因:\n- ネットワーク接続の問題\n- Vercel Functionsが正しく動作していない\n- CORSの問題\n\nVercelダッシュボードの「Functions」タブでログを確認してください。';
      }
      alert(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  /* ---------------- Handle Date Click in Calendar ---------------- */
  const handleDateClick = (dateStr: string) => {
    setCalendarSelectedDate(dateStr);
    const dateEntries = entries.filter((e) => e.date === dateStr);
    setSelectedEntries(dateEntries);
  };

  /* ---------------- 認証分岐 ---------------- */
  if (isAuthenticated === null) {
    return (
      <div className="gradient-bg min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 text-center">
          <div className="text-2xl font-semibold text-gray-700">Loading...</div>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Login />;

  /* ---------------- UI ---------------- */
  return (
    <div className="gradient-bg min-h-screen flex flex-col">
      {/* Header with Daily Streak */}
      <header className="px-4 py-4 pt-8">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <h1 
            className="text-2xl md:text-2xl text-xl font-bold text-gray-800 cursor-pointer hover:text-pink-600 transition-colors flex-shrink-0"
            onClick={() => {
              setCurrentTab('record');
              setSelectedDate(getTodayDateString());
            }}
          >
            dAIary
          </h1>
          <div className="streak-counter flex-shrink-0">
            <span className="fire-icon">🔥</span>
            <span className="font-semibold text-gray-700 whitespace-nowrap">{dailyStreak}日連続</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32 px-4">
        {currentTab === 'record' && (
          <div className="max-w-2xl mx-auto mt-6 space-y-6">
            {/* Entry Form Card */}
            <div className="glass-card-strong p-6">
              <h2 className="large-friendly-text mb-4">記録</h2>
              
              {/* Date Picker */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  日付を選択
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="login-input w-full"
                  max={(() => {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                  })()}
                />
                <button
                  onClick={() => {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');
                    setSelectedDate(`${year}-${month}-${day}`);
                  }}
                  className="mt-2 text-sm text-pink-600 hover:text-pink-700 font-medium"
                >
                  今日に戻る
                </button>
              </div>

              <div className="space-y-4">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="modern-textarea w-full h-64"
                  placeholder="今日あったことを書いてください..."
                  disabled={isAnalyzing}
                />

                <button
                  onClick={handleSubmit}
                  disabled={isAnalyzing || !inputText.trim()}
                  className="modern-button w-full"
                >
                  {isAnalyzing ? 'AIが分析中... ✨' : '送信'}
                </button>
              </div>
            </div>

            {/* Milestone Celebration */}
            {milestoneFeedback && (
              <div className="ai-feedback-glow p-6 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="ai-avatar text-4xl">
                    <span>🎉</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-2 text-lg">マイルストーン達成！</h3>
                    <p className="soft-text leading-relaxed">{milestoneFeedback}</p>
                    <button
                      onClick={() => setMilestoneFeedback(null)}
                      className="mt-4 text-sm text-pink-600 hover:text-pink-700 font-medium"
                    >
                      閉じる
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Existing Entries for Selected Date */}
            {selectedEntries.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 px-2">
                  {formatDateForDisplay(selectedDate)} の記録 ({selectedEntries.length}件)
                </h3>
                {selectedEntries.map((entry) => (
                  <div key={entry.id} id={`entry-feedback-${entry.id}`} className="glass-card-strong p-6 space-y-4">
                    <div className="soft-text text-base leading-relaxed whitespace-pre-wrap">
                      {entry.content}
                    </div>
                    <div className="ai-feedback-glow p-4 rounded-xl">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">💭</span>
                        <p className="soft-text flex-1 leading-relaxed">{entry.feedback}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentTab === 'history' && (
          <div className="max-w-2xl mx-auto mt-6 space-y-6">
            <Calendar
              entries={entries}
              onDateClick={handleDateClick}
              selectedDate={calendarSelectedDate}
            />
            
            {/* Monthly Feedback Button */}
            {(() => {
              const calendarYear = calendarSelectedDate ? new Date(calendarSelectedDate).getFullYear() : new Date().getFullYear();
              const calendarMonth = calendarSelectedDate ? new Date(calendarSelectedDate).getMonth() : new Date().getMonth();
              const monthlyEntries = entries.filter(e => {
                const entryDate = new Date(e.date);
                return entryDate.getFullYear() === calendarYear && entryDate.getMonth() === calendarMonth;
              });
              return monthlyEntries.length > 0;
            })() && (
              <MonthlyFeedbackButton
                entries={entries}
                year={calendarSelectedDate ? new Date(calendarSelectedDate).getFullYear() : new Date().getFullYear()}
                month={calendarSelectedDate ? new Date(calendarSelectedDate).getMonth() : new Date().getMonth()}
                personality={profile.personality}
                customInstruction={profile.personality === 'custom' ? profile.customInstruction : undefined}
              />
            )}
            
            {calendarSelectedDate && selectedEntries.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 px-2">
                  {formatDateForDisplay(calendarSelectedDate)} の記録 ({selectedEntries.length}件)
                </h3>
                {selectedEntries.map((entry) => (
                  <div key={entry.id} className="glass-card-strong p-6 space-y-4">
                    <p className="soft-text text-base leading-relaxed whitespace-pre-wrap">
                      {entry.content}
                    </p>
                    <div className="ai-feedback-glow p-4 rounded-xl">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">💭</span>
                        <p className="soft-text flex-1 leading-relaxed">{entry.feedback}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {calendarSelectedDate && selectedEntries.length === 0 && (
              <div className="glass-card p-8 text-center">
                <p className="soft-text">この日にはまだ記録がありません</p>
              </div>
            )}
          </div>
        )}

        {currentTab === 'mypage' && (
          <MyPage 
            profile={profile} 
            onProfileUpdate={setProfile}
            totalRecordCount={entries.length}
          />
        )}
      </main>

      {/* Floating Navigation Bar */}
      <nav className="nav-bar">
        <button
          onClick={() => setCurrentTab('record')}
          className={`fab px-4 py-3 ${currentTab === 'record' ? 'active' : ''}`}
        >
          <span className="text-sm font-medium">記録</span>
        </button>
        <button
          onClick={() => {
            setCurrentTab('history');
            setCalendarSelectedDate(null);
          }}
          className={`fab px-4 py-3 ${currentTab === 'history' ? 'active' : ''}`}
        >
          <span className="text-sm font-medium">履歴</span>
        </button>
        <button
          onClick={() => setCurrentTab('mypage')}
          className={`fab px-4 py-3 ${currentTab === 'mypage' ? 'active' : ''}`}
        >
          <span className="text-sm font-medium">マイページ</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
