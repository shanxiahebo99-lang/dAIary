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
    console.log('🔍 Auth listener registered'); // デバッグログ
    
    const checkAuth = async () => {
      console.log('🔍 checkAuth: Starting initial auth check');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔍 checkAuth: Session exists?', !!session);
      if (session) {
        // セッションが確立されるまで少し待機
        await new Promise(resolve => setTimeout(resolve, 300));
        // プロフィールをチェックして、削除されていないか確認
        try {
          console.log('🔍 checkAuth: Fetching profile...');
          const profile = await getUserProfile();
          console.log('🔍 checkAuth: Profile fetched:', !!profile);
          if (!profile) {
            // アカウントが削除されている場合はログアウト
            console.log('🔍 checkAuth: Profile is null, signing out');
            await supabase.auth.signOut();
            setIsAuthenticated(false);
            return;
          }
        } catch (error) {
          console.error('❌ checkAuth: Error checking profile:', error);
        }
      }
      setIsAuthenticated(!!session);
    };
    
    checkAuth();
    
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔍 onAuthStateChange: Event =', event, 'Session exists?', !!session);
      
      // SIGNED_INイベントの場合のみ、セッションが確実に確立されるのを待つ
      if (event === 'SIGNED_IN' && session) {
        console.log('🔍 onAuthStateChange: SIGNED_IN detected, waiting for authenticated state...');
        // 認証状態が確実にauthenticatedになるまで待機
        await new Promise(resolve => setTimeout(resolve, 300));
        // セッションを再取得して確実にauthenticated状態にする
        const { data: { session: refreshedSession } } = await supabase.auth.getSession();
        console.log('🔍 onAuthStateChange: Refreshed session exists?', !!refreshedSession);
        
        if (!refreshedSession) {
          console.error('❌ onAuthStateChange: No session after refresh');
          setIsAuthenticated(false);
          return;
        }
        
        // プロフィールをチェック
        try {
          console.log('🔍 onAuthStateChange: Fetching profile after SIGNED_IN...');
          const profile = await getUserProfile();
          console.log('🔍 onAuthStateChange: Profile fetched:', !!profile, profile ? { name: profile.name, hasNickname: !!profile.nickname } : null);
          
          if (!profile) {
            console.log('🔍 onAuthStateChange: Profile is null, signing out');
            await supabase.auth.signOut();
            setIsAuthenticated(false);
            return;
          }
          
          console.log('✅ onAuthStateChange: Profile loaded successfully, setting authenticated');
          setIsAuthenticated(true);
        } catch (error: any) {
          console.error('❌ onAuthStateChange: Error checking profile after sign in:', error);
          console.error('❌ Error details:', { code: error?.code, message: error?.message, error });
          
          // 404エラーの場合はリトライ（RLSがまだ適用されていない可能性）
          if (error && typeof error === 'object' && 'code' in error && error.code === 'PGRST116') {
            console.log('🔍 onAuthStateChange: 404 error detected, retrying in 500ms...');
            setTimeout(async () => {
              try {
                console.log('🔍 onAuthStateChange: Retrying profile fetch...');
                const retryProfile = await getUserProfile();
                console.log('🔍 onAuthStateChange: Retry profile fetched:', !!retryProfile);
                if (!retryProfile) {
                  console.log('🔍 onAuthStateChange: Retry profile is null, signing out');
                  await supabase.auth.signOut();
                  setIsAuthenticated(false);
                } else {
                  console.log('✅ onAuthStateChange: Retry successful, setting authenticated');
                  setIsAuthenticated(true);
                }
              } catch (retryError) {
                console.error('❌ onAuthStateChange: Error retrying profile check:', retryError);
              }
            }, 500);
          } else {
            // 404以外のエラーでもリトライを試みる
            console.log('🔍 onAuthStateChange: Non-404 error, retrying in 500ms...');
            setTimeout(async () => {
              try {
                const retryProfile = await getUserProfile();
                if (!retryProfile) {
                  await supabase.auth.signOut();
                  setIsAuthenticated(false);
                } else {
                  setIsAuthenticated(true);
                }
              } catch (retryError) {
                console.error('❌ onAuthStateChange: Error retrying profile check:', retryError);
              }
            }, 500);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('🔍 onAuthStateChange: SIGNED_OUT detected');
        setIsAuthenticated(false);
      } else if (session) {
        // その他のイベント（TOKEN_REFRESHED等）でもセッションがある場合は認証済み
        console.log('🔍 onAuthStateChange: Other event with session:', event);
        setIsAuthenticated(true);
      } else {
        console.log('🔍 onAuthStateChange: No session, setting unauthenticated');
        setIsAuthenticated(false);
      }
    });
    
    return () => {
      console.log('🔍 Auth listener unsubscribed');
      listener.subscription.unsubscribe();
    };
  }, []);

  /* ---------------- Load data from Supabase ---------------- */
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const loadData = async () => {
      try {
        // 常にSupabaseからデータを読み込む（アカウントごとに同期）
        const loadedEntries = await getDiaryEntries();
        console.log('📥 Loaded entries from Supabase:', loadedEntries.length);
        setEntries(loadedEntries);
        
        // プロフィールも常にSupabaseから読み込む
        const loadedProfile = await getUserProfile();
        if (loadedProfile) {
          console.log('📥 Loaded profile from Supabase:', loadedProfile);
          setProfile(loadedProfile);
        }
      } catch (error) {
        console.error('❌ Error loading data from Supabase:', error);
        // エラー時は空の状態を維持（localStorageは使用しない）
        setEntries([]);
      }
    };
    
    loadData();
    
    // リアルタイム同期を設定
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 日記エントリの変更を監視
        const entriesChannel = supabase
          .channel('diary_entries_changes')
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: 'diary_entries',
              filter: `user_id=eq.${user.id}`
            }, 
            async () => {
              // データが変更されたら再読み込み
              const loadedEntries = await getDiaryEntries();
              setEntries(loadedEntries);
            }
          )
          .subscribe();

        // プロフィールの変更を監視
        const profileChannel = supabase
          .channel('user_profiles_changes')
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: 'user_profiles',
              filter: `user_id=eq.${user.id}`
            }, 
            async () => {
              // プロフィールが変更されたら再読み込み
              const loadedProfile = await getUserProfile();
              if (loadedProfile) {
                setProfile(loadedProfile);
              }
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(entriesChannel);
          supabase.removeChannel(profileChannel);
        };
      }
    };
    
    const cleanup = setupRealtime();
    
    return () => {
      cleanup.then((cleanupFn) => {
        if (cleanupFn) cleanupFn();
      });
    };
  }, [isAuthenticated]);

  /* ---------------- Save profile to Supabase ---------------- */
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // 初回ロード時は保存しない（無限ループを防ぐ）
    const isInitialLoad = entries.length === 0;
    if (isInitialLoad) return;
    
    const saveProfile = async () => {
      try {
        await saveUserProfile(profile);
        console.log('✅ Profile saved to Supabase');
      } catch (error) {
        console.error('❌ Error saving profile to Supabase:', error);
      }
    };
    
    saveProfile();
  }, [profile, isAuthenticated, entries.length]);

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
        console.log('✅ Diary entry saved to Supabase');
      } catch (error: any) {
        console.error('❌ Error saving diary entry to Supabase:', error);
        alert(`日記の保存に失敗しました: ${error.message || '不明なエラー'}\n\nデータはローカルにのみ保存されています。`);
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
