import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { isValidIndiaDate, toIndiaDate } from "@/lib/date";
import type { ProductLine } from "@/lib/productLine";
import { inferProductLine } from "@/lib/productLine";

type Row = {
  date: string;
  campaign_name: string;
  product_line: ProductLine;
  spend: number;
  budget: number;
  ads_conversions: number;
  new_jid_users: number | null;
  new_ios_jid_users: number | null;
  new_android_jid_users: number | null;
};

type Summary = {
  product_line: Exclude<ProductLine, "other">;
  total_spend: number;
  total_paid: number;
  avg_cpa: number | null;
};

type ServerPaidRow = {
  date: string;
  campaign_name: string;
  new_jid_users: number;
  /** 未跑 DB 迁移时，查询结果可能不包含该字段 */
  new_ios_jid_users?: number;
  new_android_jid_users?: number;
};

export async function GET(req: NextRequest) {
  const supabaseClient = await getSupabaseServerClient();

  if (!supabaseClient) {
    return NextResponse.json(
      { ok: false, error: { code: "SUPABASE_NOT_CONFIGURED", message: "Supabase 环境变量未配置" } },
      { status: 500 }
    );
  }

  const { data: authData, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const productLine = searchParams.get("product_line") as ProductLine | null;
  const search = searchParams.get("search") ?? "";
  const viewPivot = searchParams.get("view") === "pivot";
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = viewPivot ? 10000 : Number(searchParams.get("page_size") ?? "50");

  if (!startDate || !endDate || !isValidIndiaDate(startDate) || !isValidIndiaDate(endDate)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_DATE", message: "start_date 和 end_date 必须是 YYYY-MM-DD" } },
      { status: 400 }
    );
  }

  if (!viewPivot && (page <= 0 || pageSize <= 0)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_PAGINATION", message: "page 与 page_size 必须为正数" } },
      { status: 400 }
    );
  }

  if (viewPivot && (!productLine || productLine === "other")) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_VIEW", message: "透视表模式需指定 product_line 为 ft / pu / ppt" } },
      { status: 400 }
    );
  }

  const adsQuery = supabaseClient
    .from("ads_metrics")
    .select("date,campaign_name,product_line,spend,budget,ads_conversions")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })
    .order("product_line", { ascending: true })
    .order("campaign_name", { ascending: true });

  if (productLine && productLine !== "other") {
    adsQuery.eq("product_line", productLine);
  }

  if (search) {
    adsQuery.ilike("campaign_name", `%${search}%`);
  }

  const { data: adsRows, error: adsError } = await adsQuery;

  if (adsError) {
    return NextResponse.json(
      { ok: false, error: { code: "SUPABASE_ERROR", message: "查询 ads_metrics 失败", details: adsError.message } },
      { status: 500 }
    );
  }

  const keys = Array.from(
    new Set((adsRows ?? []).map((r) => `${r.date as string}__${r.campaign_name as string}`))
  );
  let dates = Array.from(new Set((adsRows ?? []).map((r) => r.date as string)));

  let paidRows: ServerPaidRow[] | null = null;
  let paidQueryIncludesIos = false;
  let paidQueryIncludesAndroid = false;

  if (keys.length > 0) {
    const paidSelectFull =
      "date,campaign_name,new_jid_users,new_ios_jid_users,new_android_jid_users";
    const paidSelectMid = "date,campaign_name,new_jid_users,new_ios_jid_users";
    const paidSelectLegacy = "date,campaign_name,new_jid_users";

    const firstPaid = await supabaseClient
      .from("server_paid_data")
      .select(paidSelectFull)
      .gte("date", startDate)
      .lte("date", endDate);

    let paidData: ServerPaidRow[] | null = null;

    if (!firstPaid.error) {
      paidData = (firstPaid.data ?? []) as ServerPaidRow[];
      paidQueryIncludesIos = true;
      paidQueryIncludesAndroid = true;
    } else {
      const secondPaid = await supabaseClient
        .from("server_paid_data")
        .select(paidSelectMid)
        .gte("date", startDate)
        .lte("date", endDate);
      if (!secondPaid.error) {
        paidData = (secondPaid.data ?? []) as ServerPaidRow[];
        paidQueryIncludesIos = true;
        paidQueryIncludesAndroid = false;
      } else {
        const thirdPaid = await supabaseClient
          .from("server_paid_data")
          .select(paidSelectLegacy)
          .gte("date", startDate)
          .lte("date", endDate);
        if (thirdPaid.error) {
          const e1 = firstPaid.error?.message ?? "";
          const e2 = secondPaid.error?.message ?? "";
          const e3 = thirdPaid.error.message ?? "";
          return NextResponse.json(
            {
              ok: false,
              error: {
                code: "SUPABASE_ERROR",
                message: "查询 server_paid_data 失败",
                details: [e1 && `全列：${e1}`, e2 && e2 !== e1 && `无安卓列：${e2}`, e3 && e3 !== e2 && `仅JID：${e3}`]
                  .filter(Boolean)
                  .join("；")
              }
            },
            { status: 500 }
          );
        }
        paidData = (thirdPaid.data ?? []) as ServerPaidRow[];
        paidQueryIncludesIos = false;
        paidQueryIncludesAndroid = false;
      }
    }

    paidRows = paidData ?? [];
  } else {
    paidRows = [];
  }

  const norm = (d: unknown) => toIndiaDate(String(d ?? ""));
  const paidMap = new Map<
    string,
    { new_jid_users: number; new_ios_jid_users: number; new_android_jid_users: number }
  >();
  for (const r of paidRows ?? []) {
    const key = `${norm(r.date)}__${r.campaign_name}`;
    paidMap.set(key, {
      new_jid_users: r.new_jid_users ?? 0,
      new_ios_jid_users: paidQueryIncludesIos ? (r.new_ios_jid_users ?? 0) : 0,
      new_android_jid_users: paidQueryIncludesAndroid ? (r.new_android_jid_users ?? 0) : 0
    });
  }
  let merged: Row[] = (adsRows ?? []).map((r) => {
    const dateStr = norm(r.date);
    const key = `${dateStr}__${r.campaign_name as string}`;
    const paid = paidMap.get(key);
    const newJid = paid ? paid.new_jid_users : null;
    const newIosJid = paidQueryIncludesIos && paid ? paid.new_ios_jid_users : null;
    const newAndroidJid = paidQueryIncludesAndroid && paid ? paid.new_android_jid_users : null;
    return {
      date: dateStr,
      campaign_name: r.campaign_name as string,
      product_line: r.product_line as ProductLine,
      spend: Number(r.spend ?? 0),
      budget: Number(r.budget ?? 0),
      ads_conversions: Number(r.ads_conversions ?? 0),
      new_jid_users: newJid,
      new_ios_jid_users: newIosJid,
      new_android_jid_users: newAndroidJid
    };
  });

  // 透视表下：拉取日期范围内所有 campaign_notes，保证「有备注无指标」的 (date,campaign) 也显示，备注永久保留不随数据导入覆盖
  const mergedKeys = new Set(merged.map((r) => `${r.date}__${r.campaign_name}`));
  let notes: Record<string, string> = {};
  if (viewPivot && productLine && productLine !== "other") {
    const { data: noteRows } = await supabaseClient
      .from("campaign_notes")
      .select("date,campaign_name,content")
      .gte("date", startDate)
      .lte("date", endDate);
    const noteMap = new Map<string, string>();
    for (const row of noteRows ?? []) {
      const pl = inferProductLine((row.campaign_name as string) ?? "");
      if (pl !== productLine) continue;
      const dateStr = norm(row.date);
      const key = `${dateStr}__${row.campaign_name}`;
      if (row.content) noteMap.set(key, row.content as string);
      if (!mergedKeys.has(key)) {
        mergedKeys.add(key);
        merged.push({
          date: dateStr,
          campaign_name: row.campaign_name as string,
          product_line: productLine as ProductLine,
          spend: 0,
          budget: 0,
          ads_conversions: 0,
          new_jid_users: null,
          new_ios_jid_users: null,
          new_android_jid_users: null
        });
      }
    }
    notes = Object.fromEntries(noteMap);
    // 按日期升序、campaign_name 排序，与前端展示一致
    merged = merged
      .slice()
      .sort((a, b) => {
        if (a.date !== b.date) return a.date > b.date ? 1 : -1;
        return (a.campaign_name as string) > (b.campaign_name as string) ? 1 : -1;
      });
    dates = [...new Set(merged.map((r) => r.date))].sort((a, b) => (a > b ? 1 : -1));
  }

  // 顶部产品线汇总（仅 ft/pu/ppt）- 基于合并后的 merged 计算，但汇总只计有指标的（不含仅备注行）
  const summaries: Summary[] = ["ft", "pu", "ppt"].map((pl) => {
    const subset = merged.filter((r) => r.product_line === pl);
    const totalSpend = subset.reduce((sum, r) => sum + r.spend, 0);
    const totalPaid = subset.reduce(
      (sum, r) => sum + (typeof r.new_jid_users === "number" ? r.new_jid_users : 0),
      0
    );
    const avgCpa = totalPaid > 0 ? totalSpend / totalPaid : null;
    return {
      product_line: pl as Exclude<ProductLine, "other">,
      total_spend: totalSpend,
      total_paid: totalPaid,
      avg_cpa: avgCpa
    };
  });

  const total = merged.length;
  const startIndex = viewPivot ? 0 : (page - 1) * pageSize;
  const size = viewPivot ? total : pageSize;
  const pageRows = merged.slice(startIndex, startIndex + size);

  // 透视表模式：产品日备注（campaign_notes 已在上面按产品线合并并包含「仅有备注」行，notes 已包含全量备注不随数据覆盖）
  let productDailyNotes: Record<string, string> = {};
  if (viewPivot && pageRows.length > 0) {
    if (productLine && productLine !== "other") {
      const { data: pdRows } = await supabaseClient
        .from("product_daily_notes")
        .select("date,content")
        .eq("product_line", productLine)
        .gte("date", startDate)
        .lte("date", endDate);
      const pdMap: Record<string, string> = {};
      for (const row of pdRows ?? []) {
        if (row.content) pdMap[row.date as string] = row.content as string;
      }
      productDailyNotes = pdMap;
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      rows: pageRows,
      total,
      page: viewPivot ? 1 : page,
      page_size: viewPivot ? total : pageSize,
      dates,
      summaries,
      view: viewPivot ? "pivot" : undefined,
      notes,
      productDailyNotes
    }
  });
}

