/**
 * 服务端直连 Supabase（Service Role），用于无登录态的机器调用（如 Ads AI 后端 POST /api/ios-cpa）。
 * 切勿把 SUPABASE_SERVICE_ROLE_KEY 暴露到浏览器。
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (_admin !== undefined) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    _admin = null;
    return null;
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
