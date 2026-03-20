"use client";

import Link from "next/link";
import { useState } from "react";

export default function UploadPage() {
  const [metricsFile, setMetricsFile] = useState<File | null>(null);
  const [paidFile, setPaidFile] = useState<File | null>(null);
  const [metricsStatus, setMetricsStatus] = useState<string | null>(null);
  const [paidStatus, setPaidStatus] = useState<string | null>(null);

  async function handleMetricsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMetricsStatus(null);
    if (!metricsFile) {
      setMetricsStatus("请先选择指标表 CSV。");
      return;
    }
    const formData = new FormData();
    formData.append("file", metricsFile);
    const res = await fetch("/api/csv/upload/metrics", { method: "POST", body: formData });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      const details = json?.error?.details ? `（详情：${json.error.details}）` : "";
      setMetricsStatus((json?.error?.message ?? "上传失败。") + details);
      return;
    }
    const inserted = json.data?.inserted ?? 0;
    const skipped = json.data?.skipped ?? 0;
    const errorIndexes: number[] = (json.data?.errors ?? []).map((e: { index: number }) => e.index);
    let msg = `成功导入 ${inserted} 行`;
    if (skipped > 0) {
      msg += `，跳过 ${skipped} 行（第 ${errorIndexes.join(", ")} 行）。`;
    } else {
      msg += "。";
    }
    setMetricsStatus(msg + " 看板数据已更新，可前往看板查看。");
  }

  async function handlePaidSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPaidStatus(null);
    if (!paidFile) {
      setPaidStatus("请先选择新 JID 付费表 CSV。");
      return;
    }
    const formData = new FormData();
    formData.append("file", paidFile);
    const res = await fetch("/api/csv/upload/paid", { method: "POST", body: formData });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      const details = json?.error?.details ? `（详情：${json.error.details}）` : "";
      setPaidStatus((json?.error?.message ?? "上传失败。") + details);
      return;
    }
    const inserted = json.data?.inserted ?? 0;
    const skipped = json.data?.skipped ?? 0;
    const errorIndexes: number[] = (json.data?.errors ?? []).map((e: { index: number }) => e.index);
    const persistMode = json.data?.persist_mode as string | undefined;
    const usedLegacySchema = Boolean(json.data?.used_legacy_schema);
    let msg = `成功导入 ${inserted} 行`;
    if (skipped > 0) {
      msg += `，跳过 ${skipped} 行（第 ${errorIndexes.join(", ")} 行）。`;
    } else {
      msg += "。";
    }
    if (persistMode === "no_android") {
      msg +=
        " 注意：数据库尚无 new_android_jid_users 列，本次未保存「新安卓 JID数量」；请执行 web/supabase-migration-20260321-add-new-android-jid-users.sql 后重新上传。";
    } else if (persistMode === "legacy" || usedLegacySchema) {
      msg +=
        " 注意：数据库尚无 iOS/安卓扩展列或仅支持旧表结构，本次仅保存「新 JID 付费数量」；请依次执行 ios/android 迁移 SQL 后重新上传。";
    }
    setPaidStatus(msg + " 看板数据已更新，可前往看板查看。");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            上传 CSV 数据
          </h1>
          <p className="text-sm text-slate-600">
            指标表（HKD）与新 JID 付费表分开上传，系统自动按「日期 + 广告系列」对齐，仪表盘中以 USD 显示成本。
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded border border-slate-200 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-slate-50"
        >
          进入看板
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-medium text-slate-900">
            1. 指标表（日期、campaign、预算、消耗）
          </h2>
          <p className="mt-2 text-xs text-slate-600">
            表头需包含：<strong>日期</strong>（或 天）、<strong>广告系列</strong>、<strong>预算</strong>、<strong>费用</strong>。
            日期格式 YYYY-MM-DD。系统会自动跳过无效行，并提示行号。
          </p>
          <form onSubmit={handleMetricsSubmit} className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setMetricsFile(e.target.files?.[0] ?? null)}
              className="block flex-1 text-sm text-slate-800 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-sky-500 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-sky-400"
            />
            <button
              type="submit"
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-600"
            >
              上传指标表
            </button>
          </form>
          {metricsStatus && (
            <p className="mt-3 text-xs leading-relaxed text-slate-700">{metricsStatus}</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-medium text-slate-900">
            2. 新 JID 付费表（用于计算新用户 CPA）
          </h2>
          <p className="mt-2 text-xs text-slate-600">
            表头需包含：<strong>日期</strong>、<strong>广告系列</strong>、<strong>新 JID 付费数量</strong>。
            可选列：<strong>新IOS JID数量</strong>（也兼容 <strong>新 JID 付费表</strong>）、<strong>新安卓 JID数量</strong>。
            系统按「日期 + 广告系列」与指标表匹配；新用户 CPA = 消耗 / 新 JID 付费人数；新IOS 用户 CPA = 消耗 / 新IOS JID数量。
            看板中「新增IOS付费用户占比」= 新IOS JID数量 / 新JID用户数（与表头列名一致）。
          </p>
          <form onSubmit={handlePaidSubmit} className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setPaidFile(e.target.files?.[0] ?? null)}
              className="block flex-1 text-sm text-slate-800 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-emerald-500 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-600"
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-600"
            >
              上传新 JID 付费表
            </button>
          </form>
          {paidStatus && (
            <p className="mt-3 text-xs leading-relaxed text-slate-700">{paidStatus}</p>
          )}
        </section>
      </div>
    </div>
  );
}
