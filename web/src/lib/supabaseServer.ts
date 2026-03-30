import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getCookieStore() {
  // next/headers 的 cookies() 在 route handler / server component 中可用
  return cookies();
}

export async function getSupabaseServerClient() {
  if (!url || !anonKey) return null;

  const cookieStore = await getCookieStore();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...(options ?? {}) });
      },
      remove(name, options) {
        cookieStore.set({ name, value: "", ...(options ?? {}), expires: new Date(0) });
      }
    }
  });
}

