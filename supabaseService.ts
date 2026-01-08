import { supabase } from './supabase';
import { DiaryEntry, UserProfile } from './types';

// 日記エントリをSupabaseに保存
export const saveDiaryEntry = async (entry: DiaryEntry): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // 既に存在する場合は更新、存在しない場合は挿入
  const { error: upsertError } = await supabase
    .from('diary_entries')
    .upsert({
      id: entry.id,
      user_id: user.id,
      date: entry.date,
      content: entry.content,
      feedback: entry.feedback,
      mood: entry.mood,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id',
    });

  if (upsertError) {
    console.error('Error upserting diary entry:', upsertError);
    throw upsertError;
  }
};

// ユーザーの日記エントリを取得
export const getDiaryEntries = async (): Promise<DiaryEntry[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching diary entries:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    date: row.date,
    content: row.content,
    feedback: row.feedback,
    mood: row.mood,
  }));
};

// ユーザープロフィールをSupabaseに保存
export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // プロフィール画像（サイズ制限なし）
  const profilePicture = profile.profilePicture || null;

  const { error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: user.id,
      name: profile.name,
      nickname: profile.nickname || null,
      personality: profile.personality,
      profile_picture: profilePicture,
      custom_instruction: profile.customInstruction || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('Error saving profile:', error);
    throw error;
  }
};

// ユーザープロフィールを取得
export const getUserProfile = async (): Promise<UserProfile | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // プロフィールが存在しない場合はデフォルト値を返す
      return {
        name: user.email?.split('@')[0] || 'ユーザー',
        personality: 'supportive',
        customInstruction: '',
      };
    }
    console.error('Error fetching user profile:', error);
    return null;
  }

  return {
    name: data.name || user.email?.split('@')[0] || 'ユーザー',
    nickname: data.nickname || undefined,
    personality: data.personality || 'supportive',
    profilePicture: data.profile_picture || undefined,
    customInstruction: data.custom_instruction || undefined,
  };
};

// 日記エントリを削除
export const deleteDiaryEntry = async (entryId: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('diary_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', user.id);

  if (error) throw error;
};

// ユーザーアカウントを削除（日記エントリとプロフィールも削除）
export const deleteUserAccount = async (password: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) throw new Error('User not authenticated');

  // パスワードで再認証
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: password,
  });

  if (signInError) {
    throw new Error('パスワードが正しくありません');
  }

  // 日記エントリを削除
  await supabase
    .from('diary_entries')
    .delete()
    .eq('user_id', user.id);

  // プロフィールを削除
  await supabase
    .from('user_profiles')
    .delete()
    .eq('user_id', user.id);

  // アカウントを削除（Supabase Admin APIが必要なため、ここではauth.deleteUserを使用）
  // 注意: 実際の実装では、Supabase Admin APIを使用するか、バックエンドエンドポイントを作成する必要があります
  // ここでは、ユーザーにSupabaseダッシュボードから削除してもらうか、バックエンドエンドポイントを作成する必要があります
  throw new Error('アカウント削除機能は現在利用できません。サポートにお問い合わせください。');
};

