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
      is_deleted: false,
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
  console.log('🔍 getUserProfile: Starting...');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError) {
    console.error('❌ getUserProfile: Error getting user:', userError);
    return null;
  }
  
  if (!user) {
    console.log('🔍 getUserProfile: No user found');
    return null;
  }
  
  console.log('🔍 getUserProfile: User ID =', user.id);

  let { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  console.log('🔍 getUserProfile: Query result - data exists?', !!data, 'error?', !!error, 'error code?', error?.code);

  // PGRST205エラー: テーブルがスキーマキャッシュに見つからない
  if (error && error.code === 'PGRST205') {
    console.error('❌ getUserProfile: CRITICAL - Table "user_profiles" not found in schema cache!');
    console.error('❌ This means the table does not exist or PostgREST cache needs refresh.');
    console.error('❌ Please check:');
    console.error('   1. Run supabase_schema.sql in Supabase SQL Editor');
    console.error('   2. Refresh PostgREST schema cache in Supabase Dashboard');
    console.error('   3. Verify table exists: SELECT * FROM user_profiles LIMIT 1;');
    // このエラーは致命的なので、nullを返す
    return null;
  }

  // プロフィールが存在しない場合は自動的に作成
  if (error && error.code === 'PGRST116') {
    console.log('🔍 getUserProfile: Profile not found (404), creating new profile...');
    const defaultName = user.email?.split('@')[0] || 'ユーザー';
    const { data: newProfile, error: insertError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: user.id,
        name: defaultName,
        personality: 'supportive',
        is_deleted: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ getUserProfile: Error creating user profile:', insertError);
      console.error('❌ Insert error details:', { code: insertError.code, message: insertError.message, details: insertError });
      // 作成に失敗した場合はデフォルト値を返す
      return {
        name: defaultName,
        personality: 'supportive',
        customInstruction: '',
      };
    }

    console.log('✅ getUserProfile: Profile created successfully');
    data = newProfile;
  } else if (error) {
    console.error('❌ getUserProfile: Error fetching user profile:', error);
    console.error('❌ Error details:', { code: error.code, message: error.message, details: error });
    return null;
  }

  // アカウントが削除されている場合はnullを返す
  if (data && data.is_deleted) {
    console.log('🔍 getUserProfile: Account is deleted');
    return null;
  }

  if (!data) {
    console.log('🔍 getUserProfile: No data returned');
    return null;
  }

  console.log('✅ getUserProfile: Profile loaded successfully:', { name: data.name, hasNickname: !!data.nickname });
  return {
    name: data.name || user.email?.split('@')[0] || 'ユーザー',
    nickname: data.nickname || undefined,
    personality: data.personality || 'supportive',
    profilePicture: data.profile_picture || undefined,
    customInstruction: data.custom_instruction || undefined,
  };
};

// アカウントを削除（削除フラグを設定）
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
  const { error: entriesError } = await supabase
    .from('diary_entries')
    .delete()
    .eq('user_id', user.id);

  if (entriesError) throw entriesError;

  // プロフィールに削除フラグを設定
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({ is_deleted: true })
    .eq('user_id', user.id);

  if (profileError) throw profileError;
};

// 日記データをすべて削除
export const deleteAllDiaryEntries = async (password: string): Promise<void> => {
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

  // 日記エントリをすべて削除
  const { error: entriesError } = await supabase
    .from('diary_entries')
    .delete()
    .eq('user_id', user.id);

  if (entriesError) throw entriesError;
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

