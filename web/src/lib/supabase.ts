import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // 在构建或运行阶段若未配置，将在使用时抛出更可读的错误
  // 这里不直接 throw，避免导入时报错
  console.warn("Supabase 环境变量未配置：NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabaseClient = url && anonKey ? createClient(url, anonKey) : null;

