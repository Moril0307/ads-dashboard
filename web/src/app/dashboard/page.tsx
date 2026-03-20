"use client";

import Link from "next/link";
import { Fragment, useEffect, useState, useMemo } from "react";
import { getTodayInIndia, getIndiaWeekday, formatDateWithWeekday } from "@/lib/date";

type Row = {
  date: string;
  campaign_name: string;
  product_line: "ft" | "pu" | "ppt" | "other";
  spend: number;
  budget: number;
  ads_conversions: number;
  new_jid_users: number | null;
  new_ios_jid_users: number | null;
  new_android_jid_users: number | null;
};

type Summary = {
  product_line: "ft" | "pu" | "ppt";
  total_spend: number;
  total_paid: number;
  avg_cpa: number | null;
};

type ApiResponse = {
  ok: boolean;
  data?: {
    rows: Row[];
    total: number;
    page: number;
    page_size: number;
    dates: string[];
    summaries: Summary[];
    notes?: Record<string, string>;
    productDailyNotes?: Record<string, string>;
  };
  error?: { message: string };
};

const HKD_PER_USD = 7;
// 每个 Campaign 的子列：备注 + 指标（组与组之间通过单独透明列隔开）
const SUB_COLS = [
  "备注",
  "预算",
  "消耗",
  "付费",
  "新JID用户数",
  "新JID CPA",
  "新IOS JID数量",
  "新IOS 用户CPA",
  "新安卓 JID数量",
  "新增IOS付费用户占比"
] as const;
const GOOD_CPA = 20; // USD，优秀阈值
const BAD_CPA = 40; // USD，预警阈值

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function toUsd(amountHkd: number): number {
  return amountHkd / HKD_PER_USD;
}

type ProductTab = "ft" | "pu" | "ppt";

const TABS: { key: ProductTab; label: string }[] = [
  { key: "ft", label: "Fachat" },
  { key: "pu", label: "Parau" },
  { key: "ppt", label: "Pinkpinkchat" },
];

export default function DashboardPage() {
  const [productLine, setProductLine] = useState<ProductTab>("ft");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<ApiResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [productDailyNotesMap, setProductDailyNotesMap] = useState<Record<string, string>>({});

  // 仅在客户端挂载后设置“今天”（印度时间），避免服务端与客户端时区不一致导致日期错位
  useEffect(() => {
    const today = getTodayInIndia();
    setStartDate(today);
    setEndDate(today);
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      product_line: productLine,
      view: "pivot",
    });
    const res = await fetch(`/api/dashboard?${params.toString()}`);
    const json: ApiResponse = await res.json();

    if (!res.ok || !json.ok) {
      setError(json.error?.message ?? "加载看板数据失败");
      setData(null);
    } else {
      setData(json.data!);
      setNotesMap(json.data!.notes ?? {});
      setProductDailyNotesMap(json.data!.productDailyNotes ?? {});
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!startDate || !endDate) return;
    load();
  }, [startDate, endDate, productLine]);

  const { pivotDates, pivotCampaigns, rowMap, dailySummary } = useMemo(() => {
    if (!data?.rows?.length) {
      return {
        pivotDates: [] as string[],
        pivotCampaigns: [] as string[],
        rowMap: new Map<string, Row>(),
        dailySummary: new Map<
          string,
          { totalBudget: number; totalSpend: number; totalPaid: number; overallCpa: number | null }
        >(),
      };
    }
    // 日期按升序排列（最早在上，最新在下）
    const dates = [...(data.dates ?? [])].sort((a, b) => (a > b ? 1 : -1));
    const map = new Map<string, Row>();
    const summaryAgg = new Map<
      string,
      { totalBudget: number; totalSpend: number; totalPaid: number }
    >();

    for (const r of data.rows) {
      map.set(`${r.date}__${r.campaign_name}`, r);
      const key = r.date;
      if (!summaryAgg.has(key)) {
        summaryAgg.set(key, { totalBudget: 0, totalSpend: 0, totalPaid: 0 });
      }
      const agg = summaryAgg.get(key)!;
      agg.totalBudget += typeof r.budget === "number" ? r.budget : 0;
      agg.totalSpend += typeof r.spend === "number" ? r.spend : 0;
      if (typeof r.new_jid_users === "number" && r.new_jid_users > 0) {
        agg.totalPaid += r.new_jid_users;
      }
    }

    const dailySummary = new Map<
      string,
      { totalBudget: number; totalSpend: number; totalPaid: number; overallCpa: number | null }
    >();
    for (const [date, agg] of summaryAgg.entries()) {
      const { totalBudget, totalSpend, totalPaid } = agg;
      const overallCpa = totalPaid > 0 ? totalSpend / totalPaid : null;
      dailySummary.set(date, { totalBudget, totalSpend, totalPaid, overallCpa });
    }

    /** 区间内每日花费、最大日预算；用于排序 */
    const campaignSortMeta = (campaignName: string) => {
      let maxBudgetHkd = 0;
      let allDaysZeroSpend = true; // 若无任一天 spend>0 保持 true（含区间内无行视为 0 花费）
      let trailingZeroSpendDays = 0;
      for (const d of dates) {
        const row = map.get(`${d}__${campaignName}`);
        const spend = row && typeof row.spend === "number" ? row.spend : 0;
        const budget = row && typeof row.budget === "number" ? row.budget : 0;
        if (budget > maxBudgetHkd) maxBudgetHkd = budget;
        if (spend > 0) allDaysZeroSpend = false;
      }
      for (let i = dates.length - 1; i >= 0; i--) {
        const row = map.get(`${dates[i]}__${campaignName}`);
        const spend = row && typeof row.spend === "number" ? row.spend : 0;
        if (spend === 0) trailingZeroSpendDays += 1;
        else break;
      }
      // 暂停（排后）：① 全区间花费为 0；② 从最晚日起连续 ≥2 天花费为 0（含「近期刚停」、日期里含周末等——业务上视为低优先观察）
      const paused =
        dates.length === 0 || allDaysZeroSpend || trailingZeroSpendDays >= 2;

      return { paused, maxBudgetHkd };
    };

    const campaignNames = [...new Set(data.rows.map((r) => r.campaign_name))];
    const campaigns = campaignNames.sort((a, b) => {
      const ma = campaignSortMeta(a);
      const mb = campaignSortMeta(b);
      if (ma.paused !== mb.paused) return ma.paused ? 1 : -1;
      if (mb.maxBudgetHkd !== ma.maxBudgetHkd) return mb.maxBudgetHkd - ma.maxBudgetHkd;
      return a.localeCompare(b, "en");
    });

    return { pivotDates: dates, pivotCampaigns: campaigns, rowMap: map, dailySummary };
  }, [data]);

  const currentSummary = data?.summaries?.find((s) => s.product_line === productLine);

  const gapsBetweenCampaigns = pivotCampaigns.length > 0 ? pivotCampaigns.length - 1 : 0;
  const totalColumns =
    1 + // 日期
    1 + // 产品日备注（总预算前的备注列）
    4 + // 日汇总四列（总预算、总花费、总JID付费数量、总体CPA）
    1 + // 日汇总与第一个 Campaign 之间的 gap
    pivotCampaigns.length * SUB_COLS.length + // 每个 Campaign 的列数
    gapsBetweenCampaigns; // Campaign 之间的 gap 列数

  async function handleSaveCampaignNoteCell(date: string, campaign_name: string, content: string) {
    const trimmed = content.trim();
    const key = `${date}__${campaign_name}`;
    const res = await fetch("/api/notes/campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, campaign_name, content: trimmed }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setNotesError(json.error?.message ?? "保存备注失败");
      return;
    }
    setNotesMap((prev) => ({ ...prev, [key]: trimmed }));
  }

  async function handleSaveProductDailyNote(date: string, content: string) {
    const trimmed = content.trim();
    setNotesError(null);
    const res = await fetch("/api/notes/product-daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, product_line: productLine, content: trimmed }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setNotesError(json.error?.message ?? "保存产品日备注失败");
      return;
    }
    setProductDailyNotesMap((prev) => ({ ...prev, [date]: trimmed }));
  }

  function handleExportCurrentView() {
    if (!data || data.rows.length === 0) return;
    const headers = [
      "date",
      "product_line",
      "campaign_name",
      "budget_usd",
      "spend_usd",
      "ads_conversions",
      "new_jid_users",
      "cpa_usd",
      "new_ios_jid_users",
      "ios_cpa_usd",
      "new_android_jid_users",
      "new_ios_share_pct",
    ];
    const lines = data.rows.map((row) => {
      const paid =
        typeof row.new_jid_users === "number" && row.new_jid_users > 0 ? row.new_jid_users : "-";
      const iosPaid =
        typeof row.new_ios_jid_users === "number" && row.new_ios_jid_users > 0
          ? row.new_ios_jid_users
          : "-";
      const androidPaid =
        typeof row.new_android_jid_users === "number" && row.new_android_jid_users > 0
          ? row.new_android_jid_users
          : "-";
      const spendUsd = toUsd(row.spend);
      const budgetUsd = toUsd(row.budget);
      const cpa =
        typeof row.new_jid_users === "number" && row.new_jid_users > 0
          ? formatMoney(spendUsd / row.new_jid_users)
          : "-";
      const iosCpa =
        typeof row.new_ios_jid_users === "number" && row.new_ios_jid_users > 0
          ? formatMoney(spendUsd / row.new_ios_jid_users)
          : "-";
      let iosShare = "-";
      if (
        typeof row.new_jid_users === "number" &&
        row.new_jid_users > 0 &&
        typeof row.new_ios_jid_users === "number"
      ) {
        iosShare = `${((row.new_ios_jid_users / row.new_jid_users) * 100).toFixed(2)}%`;
      }
      return [
        row.date,
        row.product_line,
        row.campaign_name,
        formatMoney(budgetUsd),
        formatMoney(spendUsd),
        String(row.ads_conversions),
        String(paid),
        String(cpa),
        String(iosPaid),
        String(iosCpa),
        String(androidPaid),
        String(iosShare),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adsdatahub-pivot-${productLine}-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getCellValue(row: Row | undefined, col: (typeof SUB_COLS)[number]): string {
    if (!row) return "-";
    const spendUsd = toUsd(row.spend);
    const budgetUsd = toUsd(row.budget);
    const paid =
      typeof row.new_jid_users === "number" && row.new_jid_users > 0
        ? row.new_jid_users
        : null;
    const iosPaid =
      typeof row.new_ios_jid_users === "number" && row.new_ios_jid_users > 0
        ? row.new_ios_jid_users
        : null;
    const androidPaid =
      typeof row.new_android_jid_users === "number" && row.new_android_jid_users > 0
        ? row.new_android_jid_users
        : null;
    switch (col) {
      case "备注":
        return "";
      case "预算":
        return formatMoney(budgetUsd);
      case "消耗":
        return formatMoney(spendUsd);
      case "付费":
        return row.ads_conversions != null ? String(row.ads_conversions) : "-";
      case "新JID用户数":
        return paid != null ? String(paid) : "-";
      case "新JID CPA":
        return paid != null && paid > 0 ? formatMoney(spendUsd / paid) : "-";
      case "新IOS JID数量":
        return iosPaid != null ? String(iosPaid) : "-";
      case "新IOS 用户CPA":
        return iosPaid != null && iosPaid > 0 ? formatMoney(spendUsd / iosPaid) : "-";
      case "新安卓 JID数量":
        return androidPaid != null ? String(androidPaid) : "-";
      case "新增IOS付费用户占比": {
        const jid = row.new_jid_users;
        const ios = row.new_ios_jid_users;
        if (typeof jid !== "number" || jid <= 0) return "-";
        if (typeof ios !== "number") return "-";
        return `${((ios / jid) * 100).toFixed(2)}%`;
      }
      default:
        return "-";
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            数据看板 · 产品透视表
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            按产品线 Tab 切换；金额以 USD 展示（1 USD = 7 HKD）。左侧日期列固定，右侧为产品日汇总 + Campaign 列组。
            广告系列自左向右：预算高、近期有花费的在前；全区间无花费或「最晚日起连续 ≥2 天花费为 0」的系列排在最后。
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link
            href="/"
            className="rounded border border-slate-200 px-3 py-1 font-medium text-sky-700 hover:bg-slate-50"
          >
            返回首页
          </Link>
          <Link
            href="/upload"
            className="rounded border border-slate-200 px-3 py-1 font-medium text-sky-700 hover:bg-slate-50"
          >
            上传数据
          </Link>
        </div>
      </div>

      {/* Product Tabs */}
      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setProductLine(key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              productLine === key
                ? "bg-sky-100 text-sky-700 shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </section>

      {/* Date range + refresh + export */}
      <section className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs text-slate-400">开始日期（含）</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400">结束日期（含）</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="block text-xs text-slate-400 opacity-0 pointer-events-none">快捷</span>
          <button
            type="button"
            onClick={() => {
              const today = getTodayInIndia();
              setStartDate(today);
              setEndDate(today);
            }}
            className="rounded border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100"
          >
            今天（印度时间）
          </button>
        </div>
        <p className="self-center text-xs text-slate-500">
          日期以印度时间 (Asia/Kolkata) 为准
        </p>
        <button
          type="button"
          onClick={load}
          className="rounded bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-600"
        >
          刷新
        </button>
        <button
          type="button"
          onClick={handleExportCurrentView}
          className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          导出 CSV
        </button>
      </section>

      {(error || notesError) && (
        <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error || notesError}
        </div>
      )}

      {/* Summary card for current product line */}
      {currentSummary && (
        <section className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 shadow-sm">
          <div className="text-sm font-medium text-slate-800">
            {TABS.find((t) => t.key === productLine)?.label} 汇总（当前日期范围）
          </div>
          <div className="mt-2 flex flex-wrap gap-6 text-xs text-slate-700">
            <span>总消耗（USD）：<span className="font-semibold text-slate-900">{formatMoney(toUsd(currentSummary.total_spend))}</span></span>
            <span>总付费人数：<span className="font-semibold text-slate-900">{currentSummary.total_paid}</span></span>
            <span>
              平均 CPA（USD）：
              {currentSummary.avg_cpa != null
                ? <span className="font-semibold text-slate-900">{formatMoney(toUsd(currentSummary.avg_cpa))}</span>
                : "-"}
            </span>
          </div>
        </section>
      )}

      {/* Pivot table：左日期，右 Campaign 列组，中间用透明隔离列，每组含一列备注 */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs font-mono">
            <thead className="text-slate-700">
              <tr>
                {/* 日期列表头 */}
                <th
                  className="sticky left-0 z-20 min-w-[200px] border-r border-slate-200 bg-white px-3 py-2 text-left text-[13px] font-semibold text-sky-700 shadow-[4px_0_6px_rgba(15,23,42,0.08)]"
                  scope="col"
                >
                  日期
                </th>
                {/* 产品日备注 + 日汇总四列表头 */}
                <th className="min-w-[120px] border-r border-slate-200 bg-slate-100 px-2 py-2 text-center text-[12px] font-semibold text-slate-800">
                  备注
                </th>
                <th className="min-w-[120px] border-r border-slate-200 bg-slate-100 px-2 py-2 text-center text-[12px] font-semibold text-slate-800">
                  总预算 (USD)
                </th>
                <th className="min-w-[120px] border-r border-slate-200 bg-slate-100 px-2 py-2 text-center text-[12px] font-semibold text-slate-800">
                  总花费 (USD)
                </th>
                <th className="min-w-[120px] border-r border-slate-200 bg-slate-100 px-2 py-2 text-center text-[12px] font-semibold text-slate-800">
                  总JID付费数量
                </th>
                <th className="min-w-[120px] border-r border-slate-200 bg-slate-100 px-2 py-2 text-center text-[12px] font-semibold text-slate-800">
                  总体CPA (USD)
                </th>
                {/* 日汇总与第一个 Campaign 之间的 gap */}
                <th
                  className="w-[40px] border-0 border-transparent bg-transparent"
                  style={{ minWidth: 40 }}
                />
                {/* 各 Campaign 标题 */}
                {pivotCampaigns.map((camp, idx) => (
                  <Fragment key={camp}>
                    <th
                      colSpan={SUB_COLS.length}
                      className="border-r border-slate-200 bg-sky-100 px-2 py-2 text-center text-[12px] font-semibold text-sky-900"
                    >
                      {camp}
                    </th>
                    {idx < pivotCampaigns.length - 1 && (
                      <th
                        className="w-[40px] border-0 border-transparent bg-transparent"
                        style={{ minWidth: 40 }}
                      />
                    )}
                  </Fragment>
                ))}
              </tr>
              <tr className="bg-slate-50">
                {/* 日期子表头占位 */}
                <th
                  className="sticky left-0 z-20 min-w-[200px] border-r border-slate-200 bg-white px-3 py-1.5 text-left text-[12px] font-normal text-slate-500 shadow-[4px_0_6px_rgba(15,23,42,0.08)]"
                  scope="col"
                />
                {/* 日汇总子表头占位 */}
                <th className="min-w-[120px] border-r border-slate-200 bg-slate-50" />
                <th className="min-w-[120px] border-r border-slate-200 bg-slate-50" />
                <th className="min-w-[120px] border-r border-slate-200 bg-slate-50" />
                <th className="min-w-[120px] border-r border-slate-200 bg-slate-50" />
                <th className="min-w-[120px] border-r border-slate-200 bg-slate-50" />
                {/* gap 列 */}
                <th
                  className="w-[40px] border-0 border-transparent bg-transparent"
                  style={{ minWidth: 40 }}
                />
                {/* 各 Campaign 子列头 */}
                {pivotCampaigns.map((camp, idx) => (
                  <Fragment key={camp}>
                    {SUB_COLS.map((sub) => (
                      <th
                        key={`${camp}-${sub}`}
                        className="min-w-[88px] border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[11px] font-normal text-slate-500"
                        scope="col"
                      >
                        {sub}
                      </th>
                    ))}
                    {idx < pivotCampaigns.length - 1 && (
                      <th
                        className="w-[40px] border-0 border-transparent bg-transparent"
                        style={{ minWidth: 40 }}
                      />
                    )}
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={totalColumns}
                    className="px-3 py-8 text-center text-[13px] text-slate-400"
                  >
                    正在加载数据...
                  </td>
                </tr>
              )}
              {!loading && !startDate && !endDate && (
                <tr>
                  <td
                    colSpan={Math.max(totalColumns, 1)}
                    className="px-3 py-8 text-center text-[13px] text-slate-400"
                  >
                    正在加载日期…
                  </td>
                </tr>
              )}
              {!loading && (startDate || endDate) && pivotDates.length === 0 && (
                <tr>
                  <td
                    colSpan={Math.max(totalColumns, 1)}
                    className="px-3 py-8 text-center text-[13px] text-slate-400"
                  >
                    当前日期范围内没有数据。
                  </td>
                </tr>
              )}
              {!loading &&
                pivotDates.map((date, rowIndex) => {
                  const prevDate = rowIndex > 0 ? pivotDates[rowIndex - 1] : null;
                  const prevWeekday = prevDate != null ? getIndiaWeekday(prevDate) : null;
                  const currentWeekday = getIndiaWeekday(date); // 0=周日,1=周一,...（印度时区）
                  const isWeekBreak = prevWeekday === 0 && currentWeekday === 1;

                  const summary = dailySummary.get(date) ?? {
                    totalBudget: 0,
                    totalSpend: 0,
                    totalPaid: 0,
                    overallCpa: null as number | null,
                  };
                  const totalBudgetUsd = toUsd(summary.totalBudget);
                  const totalSpendUsd = toUsd(summary.totalSpend);
                  const totalPaid = summary.totalPaid;
                  const overallCpaUsd =
                    summary.overallCpa != null ? toUsd(summary.overallCpa) : null;
                  const stripeBg =
                    rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50";

                  const summaryBaseCls =
                    "min-w-[120px] border-r border-slate-200 px-0 py-0 align-middle";
                  const summaryWrapperBase = `flex h-full w-full items-center justify-center px-2 py-1.5 text-[13px] ${stripeBg} border border-slate-200 hover:bg-slate-100`;

                  // 总体 CPA 的显示与颜色
                  let cpaText = "-";
                  let cpaTextColor = "text-slate-800";
                  let cpaBg = "";
                  if (overallCpaUsd != null) {
                    cpaText = formatMoney(overallCpaUsd);
                    if (overallCpaUsd <= GOOD_CPA) {
                      cpaTextColor = "text-emerald-700";
                      cpaBg = "bg-emerald-50";
                    } else if (overallCpaUsd >= BAD_CPA) {
                      cpaTextColor = "text-rose-700";
                      cpaBg = "bg-rose-50";
                    }
                  }

                  return (
                    <Fragment key={date}>
                      {isWeekBreak && (
                        <tr>
                          <td
                            colSpan={totalColumns}
                            className="border-0 bg-white p-0"
                          >
                            <div className="h-[38px]" />
                          </td>
                        </tr>
                      )}
                      <tr className="border-t border-slate-900/80">
                        <td className="sticky left-0 z-10 min-w-[200px] border-r border-slate-200 bg-white px-3 py-1.5 text-left text-[13px] font-semibold text-sky-700 shadow-[4px_0_6px_rgba(15,23,42,0.08)]">
                          {formatDateWithWeekday(date)}
                        </td>
                        {/* 产品日备注列 */}
                        <td className={summaryBaseCls}>
                          <div
                            role="button"
                            tabIndex={0}
                            className={`${summaryWrapperBase} cursor-pointer text-left text-[11px] text-slate-600`}
                            onClick={() => {
                              const current = productDailyNotesMap[date] ?? "";
                              const next = window.prompt("编辑产品日备注（留空后确定即删除）", current);
                              if (next !== null) void handleSaveProductDailyNote(date, next);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                const current = productDailyNotesMap[date] ?? "";
                                const next = window.prompt("编辑产品日备注（留空后确定即删除）", current);
                                if (next !== null) void handleSaveProductDailyNote(date, next);
                              }
                            }}
                          >
                            {(productDailyNotesMap[date] ?? "").trim() || "—"}
                          </div>
                        </td>
                        {/* 日汇总四列：总预算、总花费、总JID付费数量、总体CPA */}
                        <td className={summaryBaseCls}>
                          <div
                            className={`${summaryWrapperBase} text-center font-semibold text-slate-800`}
                          >
                            {formatMoney(totalBudgetUsd)}
                          </div>
                        </td>
                        <td className={summaryBaseCls}>
                          <div
                            className={`${summaryWrapperBase} text-center font-semibold text-slate-800`}
                          >
                            {formatMoney(totalSpendUsd)}
                          </div>
                        </td>
                        <td className={summaryBaseCls}>
                          <div
                            className={`${summaryWrapperBase} text-center font-semibold text-slate-800`}
                          >
                            {totalPaid}
                          </div>
                        </td>
                        <td className={summaryBaseCls}>
                          <div
                            className={`${summaryWrapperBase} text-center font-semibold ${cpaTextColor} ${cpaBg}`}
                          >
                            {cpaText}
                          </div>
                        </td>
                        {/* 汇总与第一个 Campaign 之间的 gap */}
                        <td
                          className="w-[40px] border-0 border-transparent bg-transparent"
                          style={{ minWidth: 40 }}
                        />

                        {pivotCampaigns.map((camp, idx) => {
                      const row = rowMap.get(`${date}__${camp}`);
                      const key = `${date}__${camp}`;
                      const note = notesMap[key] ?? "";
                      return (
                        <Fragment key={camp}>
                          {SUB_COLS.map((sub) => {
                            const isFirst = sub === SUB_COLS[0];
                            const isLast = sub === SUB_COLS[SUB_COLS.length - 1];
                            const wrapperBase = `flex h-full w-full items-center justify-center px-2 py-1.5 text-[13px] ${stripeBg} border border-slate-200 hover:bg-slate-100`;
                            const rounded = `${isFirst ? "rounded-l-sm" : ""} ${
                              isLast ? "rounded-r-sm" : ""
                            }`;
                            const cellClass =
                              "min-w-[88px] border-r border-slate-200 px-0 py-0 align-middle";
                            if (sub === "备注") {
                              return (
                                <td
                                  key={`${date}-${camp}-${sub}`}
                                  className={cellClass}
                                  onClick={() => {
                                    const current = notesMap[key] ?? "";
                                    const next = window.prompt("编辑备注（留空后确定即删除）", current);
                                    if (next == null) return;
                                    void handleSaveCampaignNoteCell(date, camp, next);
                                  }}
                                >
                                  <div
                                    className={`${wrapperBase} ${rounded} cursor-pointer text-center text-[11px] text-slate-700`}
                                  >
                                    {note || ""}
                                  </div>
                                </td>
                              );
                            }
                            const value = getCellValue(row, sub);
                            const isSpend = sub === "消耗";
                            const isCpa = sub === "新JID CPA" || sub === "新IOS 用户CPA";
                            let textColor = "text-slate-800";
                            let extraBg = "";
                            if (isCpa && value !== "-") {
                              const n = Number(value);
                              if (!Number.isNaN(n)) {
                                if (n <= GOOD_CPA) {
                                  textColor = "text-emerald-700";
                                  extraBg = "bg-emerald-50";
                                } else if (n >= BAD_CPA) {
                                  textColor = "text-rose-700";
                                  extraBg = "bg-rose-50";
                                }
                              }
                            }
                            const fontWeight = isSpend || isCpa ? "font-semibold" : "font-normal";
                            return (
                              <td
                                key={`${date}-${camp}-${sub}`}
                                className={cellClass}
                              >
                                <div
                                  className={`${wrapperBase} ${rounded} text-center ${fontWeight} ${textColor} ${extraBg}`}
                                >
                                  {value}
                                </div>
                              </td>
                            );
                          })}
                          {idx < pivotCampaigns.length - 1 && (
                            <td
                              className="w-[40px] border-0 border-transparent bg-transparent"
                              style={{ minWidth: 40 }}
                            />
                          )}
                        </Fragment>
                      );
                    })}
                      </tr>
                      {rowIndex === pivotDates.length - 1 && (
                        <tr>
                          <td
                            colSpan={totalColumns}
                            className="border-0 bg-white p-0"
                          >
                            <div className="h-[38px]" />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
