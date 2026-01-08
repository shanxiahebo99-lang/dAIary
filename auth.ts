import { supabase } from "./supabase";

export const signUp = async (email: string, password: string) => {
  try {
    console.log('🔍 signUp: Calling supabase.auth.signUp...');
    const result = await supabase.auth.signUp({ email, password });
    if (result.error) {
      console.error('❌ signUp error:', result.error);
    } else {
      console.log('✅ signUp success:', result.data);
    }
    return result;
  } catch (error) {
    console.error('❌ signUp exception:', error);
    throw error;
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      console.error('❌ signIn error:', result.error);
    }
    return result;
  } catch (error) {
    console.error('❌ signIn exception:', error);
    throw error;
  }
};

export const signOut = async () => {
  return supabase.auth.signOut();
};
