"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const router = useRouter();
  const [redirect, setRedirect] = useState("/dashboard");

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("redirect") ?? "/dashboard";
    setRedirect(next);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (user?.email) {
        setUserEmail(user.email);
        router.replace(redirect);
      }
    });
  }, [supabase, redirect, router]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!supabase) {
      setError("Supabase 环境变量未配置");
      return;
    }
    if (!email.trim() || !password) {
      setError("请输入 email 和 password");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setError(error.message ?? "登录失败");
      return;
    }

    router.replace(redirect);
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUserEmail(null);
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">登录</h1>
        <p className="text-sm text-slate-600">登录后才能查看看板与上传数据。</p>
      </div>

      {userEmail && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          已登录：{userEmail}。正在跳转…
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="rounded border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            >
              退出登录
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSignIn} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </div>

        {error && <div className="text-sm text-rose-700">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-600 disabled:opacity-60"
        >
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
    </div>
  );
}

