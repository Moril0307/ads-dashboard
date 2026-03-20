import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { supabaseClient } from "@/lib/supabase";
import { isValidIndiaDate } from "@/lib/date";
import { inferProductLine } from "@/lib/productLine";

/** 支持中文表头：天 或 日期 → date，广告系列 → campaign_name，预算 → budget，费用 → spend */
const COL_DATE = ["日期", "天", "date", "Day"];
const COL_CAMPAIGN = ["广告系列", "campaign_name", "Campaign"];
const COL_BUDGET = ["预算", "budget", "Budget"];
const COL_SPEND = ["费用", "消耗", "spend", "Cost"];

function findIndex(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex((h) => h?.trim() === c);
    if (i >= 0) return i;
  }
  return -1;
}

function detectHeaderRow(rows: string[][]): { header: string[]; startIndex: number } | null {
  for (let i = 0; i < rows.length; i++) {
    const cols = rows[i].map((c) => c.trim());
    const hasDate = cols.some((c) => COL_DATE.includes(c));
    const hasCampaign = cols.some((c) => COL_CAMPAIGN.includes(c));
    const hasBudget = cols.some((c) => COL_BUDGET.includes(c));
    const hasSpend = cols.some((c) => COL_SPEND.includes(c));
    if (hasDate && hasCampaign && hasBudget && hasSpend) {
      return { header: cols, startIndex: i + 1 };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!supabaseClient) {
    return NextResponse.json(
      { ok: false, error: { code: "SUPABASE_NOT_CONFIGURED", message: "Supabase 环境变量未配置" } },
      { status: 500 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: { code: "NO_FILE", message: "未收到 CSV 文件" } },
      { status: 400 }
    );
  }

  const text = await file.text();

  // 从首行猜分隔符，兼容逗号、制表符、分号等导出格式
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  let delimiter: string = ",";
  if (firstLine.includes("\t")) delimiter = "\t";
  else if (firstLine.includes(";")) delimiter = ";";

  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    delimiter
  });

  const rawRows = (parsed.data as string[][]).filter((row) => row.length > 0);
  if (!rawRows.length) {
    return NextResponse.json(
      { ok: false, error: { code: "EMPTY", message: "CSV 内容为空" } },
      { status: 400 }
    );
  }

  const headerInfo = detectHeaderRow(rawRows);
  if (!headerInfo) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_HEADER",
          message: "未在 CSV 中找到包含 日期/天、广告系列、预算、费用 的表头行"
        }
      },
      { status: 400 }
    );
  }

  const { header, startIndex } = headerInfo;
  const dateIdx = findIndex(header, COL_DATE);
  const campaignIdx = findIndex(header, COL_CAMPAIGN);
  const budgetIdx = findIndex(header, COL_BUDGET);
  const spendIdx = findIndex(header, COL_SPEND);

  if (dateIdx < 0 || campaignIdx < 0 || budgetIdx < 0 || spendIdx < 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_HEADER",
          message: "CSV 表头需包含：日期(或 天)、广告系列、预算、费用（可中文）"
        }
      },
      { status: 400 }
    );
  }

  const seenKeys = new Set<string>();
  const rows: { date: string; campaign_name: string; budget: number; spend: number }[] = [];
  const errors: { index: number; message: string }[] = [];

  for (let i = startIndex; i < rawRows.length; i++) {
    const row = rawRows[i];
    const line = i + 1;
    const dateRaw = (row[dateIdx] ?? "").trim();
    const campaignName = (row[campaignIdx] ?? "").trim();
    const budgetRaw = (row[budgetIdx] ?? "").trim();
    const spendRaw = (row[spendIdx] ?? "").trim();

    if (!dateRaw || !isValidIndiaDate(dateRaw)) {
      errors.push({ index: line, message: "日期为空或格式不是 YYYY-MM-DD" });
      continue;
    }
    if (!campaignName) {
      errors.push({ index: line, message: "广告系列不能为空" });
      continue;
    }

    const budget = Number(budgetRaw);
    const spend = Number(spendRaw);
    if (Number.isNaN(budget) || budget < 0) {
      errors.push({ index: line, message: "预算必须是有效数字且 ≥ 0" });
      continue;
    }
    if (Number.isNaN(spend) || spend < 0) {
      errors.push({ index: line, message: "费用必须是有效数字且 ≥ 0" });
      continue;
    }

    const key = `${dateRaw}__${campaignName}`;
    if (seenKeys.has(key)) {
      errors.push({ index: line, message: "同一文件中 日期+广告系列 重复" });
      continue;
    }
    seenKeys.add(key);

    rows.push({
      date: dateRaw,
      campaign_name: campaignName,
      budget: Math.round(budget * 100) / 100,
      spend: Math.round(spend * 100) / 100
    });
  }

  if (rows.length === 0 && errors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "CSV 中存在格式错误或重复键，整文件导入失败",
          details: errors.slice(0, 20)
        }
      },
      { status: 400 }
    );
  }

  const toUpsert = rows.map((r) => ({
    date: r.date,
    campaign_name: r.campaign_name,
    product_line: inferProductLine(r.campaign_name),
    budget: r.budget,
    spend: r.spend,
    ads_conversions: 0
  }));

  // 仅写入 ads_metrics，永不写入或删除 campaign_notes，备注由用户单独编辑、永久保留
  const { error } = await supabaseClient.from("ads_metrics").upsert(toUpsert, {
    onConflict: "date,campaign_name"
  });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "SUPABASE_ERROR", message: "写入失败", details: error.message }
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: { inserted: rows.length, skipped: errors.length, errors }
  });
}
