import { NextRequest, NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabase";
import { isValidIndiaDate } from "@/lib/date";
import { inferProductLine } from "@/lib/productLine";
import type { ProductLine } from "@/lib/productLine";

/**
 * 备注完整性检查：返回在日期范围内
 * - missing_notes: 有指标(ads_metrics)但无备注或备注为空的 (date, campaign_name)，便于补全
 * - orphan_notes: 有备注但该日无指标的 (date, campaign_name)，备注会保留并在透视表中显示
 */
export async function GET(req: NextRequest) {
  if (!supabaseClient) {
    return NextResponse.json(
      { ok: false, error: { code: "SUPABASE_NOT_CONFIGURED", message: "Supabase 未配置" } },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const productLine = searchParams.get("product_line") as ProductLine | null;

  if (!startDate || !endDate || !isValidIndiaDate(startDate) || !isValidIndiaDate(endDate)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_DATE", message: "start_date 和 end_date 需为 YYYY-MM-DD" } },
      { status: 400 }
    );
  }

  const adsQuery = supabaseClient
    .from("ads_metrics")
    .select("date,campaign_name,product_line")
    .gte("date", startDate)
    .lte("date", endDate);
  if (productLine && productLine !== "other") {
    adsQuery.eq("product_line", productLine);
  }
  const { data: metricsRows, error: metricsErr } = await adsQuery;

  if (metricsErr) {
    return NextResponse.json(
      { ok: false, error: { code: "SUPABASE_ERROR", message: "查询 ads_metrics 失败", details: metricsErr.message } },
      { status: 500 }
    );
  }

  const { data: noteRows, error: notesErr } = await supabaseClient
    .from("campaign_notes")
    .select("date,campaign_name,content")
    .gte("date", startDate)
    .lte("date", endDate);

  if (notesErr) {
    return NextResponse.json(
      { ok: false, error: { code: "SUPABASE_ERROR", message: "查询 campaign_notes 失败", details: notesErr.message } },
      { status: 500 }
    );
  }

  const metricsKeys = new Set((metricsRows ?? []).map((r) => `${r.date}__${r.campaign_name}`));
  const notesWithContent = new Map<string, string>();
  const noteKeysSet = new Set<string>();
  for (const r of noteRows ?? []) {
    const key = `${r.date}__${r.campaign_name}`;
    noteKeysSet.add(key);
    if (r.content && String(r.content).trim()) {
      notesWithContent.set(key, String(r.content).trim());
    }
  }

  const missing_notes: { date: string; campaign_name: string }[] = [];
  for (const r of metricsRows ?? []) {
    const key = `${r.date}__${r.campaign_name}`;
    if (!notesWithContent.has(key)) {
      missing_notes.push({ date: r.date as string, campaign_name: r.campaign_name as string });
    }
  }
  missing_notes.sort((a, b) => (a.date !== b.date ? (a.date > b.date ? 1 : -1) : (a.campaign_name > b.campaign_name ? 1 : -1)));

  const orphan_notes: { date: string; campaign_name: string }[] = [];
  for (const r of noteRows ?? []) {
    const key = `${r.date}__${r.campaign_name}`;
    if (!metricsKeys.has(key)) {
      const pl = inferProductLine((r.campaign_name as string) ?? "");
      if (productLine && productLine !== "other" && pl !== productLine) continue;
      orphan_notes.push({ date: r.date as string, campaign_name: r.campaign_name as string });
    }
  }
  orphan_notes.sort((a, b) => (a.date !== b.date ? (a.date > b.date ? 1 : -1) : (a.campaign_name > b.campaign_name ? 1 : -1)));

  return NextResponse.json({
    ok: true,
    data: {
      start_date: startDate,
      end_date: endDate,
      product_line: productLine ?? "all",
      missing_notes,
      orphan_notes,
    },
  });
}
