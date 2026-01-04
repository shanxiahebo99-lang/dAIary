import { supabase } from "./supabase";

// 日記を保存
export const saveDiary = async (content: string) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return;

  await supabase.from("diaries").insert({
    user_id: user.id,
    content
  });
};

// 1週間前の自分を取得
export const getWeekAgoEntries = async () => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data } = await supabase
    .from("diaries")
    .select("content")
    .gte("created_at", oneWeekAgo.toISOString());

  return data;
};
