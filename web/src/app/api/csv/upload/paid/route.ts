import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { isValidIndiaDate } from "@/lib/date";

/** 支持中文表头：日期、广告系列、新 JID 付费数量；可选：新IOS JID数量、新安卓 JID数量 */
const COL_DATE = ["日期", "date", "Day"];
const COL_CAMPAIGN = ["广告系列", "campaign_name", "Campaign"];
const COL_NEW_JID = ["新 JID 付费数量", "新JID付费数量", "new_jid_users"];
// 新 IOS JID 数量：兼容多种导出表头（含用户提到的“新 JID 付费表”列名）
const COL_NEW_IOS_JID = [
  "新IOS JID数量",
  "新 IOS JID数量",
  "新IOSJID数量",
  "新 IOS JID 数量",
  "新IOS JID 数量",
  "新 JID 付费表",
  "新JID付费表",
  "new_ios_jid_users"
];
const COL_NEW_ANDROID_JID = [
  "新安卓 JID数量",
  "新安卓JID数量",
  "新 安卓 JID 数量",
  "新安卓 JID 数量",
  "Android新JID数量",
  "new_android_jid_users"
];

function normalizeHeaderToken(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, "")
    .replace(/[\u3000]/g, "")
    .toLowerCase();
}

function isLikelyEnglishIdentifierToken(token: string): boolean {
  // 仅用于避免把 `new_jid_users` 误匹配进 `new_ios_jid_users` 这类 substring 场景
  return /^[a-z0-9_]+$/.test(token);
}

function findIndex(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map((h) => normalizeHeaderToken(h ?? ""));
  const normalizedCandidates = candidates.map((c) => normalizeHeaderToken(c));

  // 1) exact match (after whitespace normalization)
  for (let ci = 0; ci < normalizedCandidates.length; ci++) {
    const want = normalizedCandidates[ci]!;
    const i = normalizedHeaders.findIndex((h) => h === want);
    if (i >= 0) return i;
  }

  // 2) substring match（主要用于中文导出表头带前后缀；英文列名不做 substring，避免误判）
  for (let ci = 0; ci < normalizedCandidates.length; ci++) {
    const want = normalizedCandidates[ci]!;
    if (!want) continue;
    if (isLikelyEnglishIdentifierToken(want)) continue;

    const i = normalizedHeaders.findIndex((h) => {
      if (!h) return false;
      if (h.includes(want)) return true;
      if (want.includes(h)) return want.length >= 6 && h.length >= 6;
      return false;
    });
    if (i >= 0) return i;
  }

  return -1;
}

function detectHeaderRow(rows: string[][]): { header: string[]; startIndex: number } | null {
  for (let i = 0; i < rows.length; i++) {
    const cols = rows[i].map((c) => c.trim());
    const hasDate = findIndex(cols, COL_DATE) >= 0;
    const hasCampaign = findIndex(cols, COL_CAMPAIGN) >= 0;
    const hasNewJid = findIndex(cols, COL_NEW_JID) >= 0;
    if (hasDate && hasCampaign && hasNewJid) {
      return { header: cols, startIndex: i + 1 };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
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
          message:
            "未在 CSV 中找到包含 日期、广告系列、新 JID 付费数量 的表头行（新IOS/新安卓列为可选）"
        }
      },
      { status: 400 }
    );
  }

  const { header, startIndex } = headerInfo;
  const dateIdx = findIndex(header, COL_DATE);
  const campaignIdx = findIndex(header, COL_CAMPAIGN);
  const newJidIdx = findIndex(header, COL_NEW_JID);
  const newIosJidIdx = findIndex(header, COL_NEW_IOS_JID);
  const newAndroidJidIdx = findIndex(header, COL_NEW_ANDROID_JID);

  if (dateIdx < 0 || campaignIdx < 0 || newJidIdx < 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_HEADER",
          message: "CSV 表头需包含：日期、广告系列、新 JID 付费数量（可中文）"
        }
      },
      { status: 400 }
    );
  }

  const seenKeys = new Set<string>();
  const rows: {
    date: string;
    campaign_name: string;
    new_jid_users: number;
    new_ios_jid_users: number;
    new_android_jid_users: number;
  }[] = [];
  const errors: { index: number; message: string }[] = [];

  for (let i = startIndex; i < rawRows.length; i++) {
    const row = rawRows[i];
    const line = i + 1;
    const dateRaw = (row[dateIdx] ?? "").trim();
    const campaignName = (row[campaignIdx] ?? "").trim();
    const newJidRaw = (row[newJidIdx] ?? "").trim();
    const newIosJidRaw = newIosJidIdx >= 0 ? (row[newIosJidIdx] ?? "").trim() : "";
    const newAndroidJidRaw = newAndroidJidIdx >= 0 ? (row[newAndroidJidIdx] ?? "").trim() : "";

    if (!dateRaw || !isValidIndiaDate(dateRaw)) {
      errors.push({ index: line, message: "日期为空或格式不是 YYYY-MM-DD" });
      continue;
    }
    if (!campaignName) {
      errors.push({ index: line, message: "广告系列不能为空" });
      continue;
    }

    const newJid = Number(newJidRaw);
    if (!Number.isInteger(newJid) || newJid < 0) {
      errors.push({ index: line, message: "新 JID 付费数量必须是 ≥0 的整数" });
      continue;
    }

    let newIosJid = 0;
    if (newIosJidIdx >= 0) {
      if (!newIosJidRaw) {
        errors.push({ index: line, message: "新 IOS JID 数量不能为空（如该列不适用请从表头移除该列）" });
        continue;
      }
      newIosJid = Number(newIosJidRaw);
      if (!Number.isInteger(newIosJid) || newIosJid < 0) {
        errors.push({ index: line, message: "新 IOS JID 数量必须是 ≥0 的整数" });
        continue;
      }
    }

    let newAndroidJid = 0;
    if (newAndroidJidIdx >= 0) {
      if (!newAndroidJidRaw) {
        errors.push({ index: line, message: "新安卓 JID 数量不能为空（如该列不适用请从表头移除该列）" });
        continue;
      }
      newAndroidJid = Number(newAndroidJidRaw);
      if (!Number.isInteger(newAndroidJid) || newAndroidJid < 0) {
        errors.push({ index: line, message: "新安卓 JID 数量必须是 ≥0 的整数" });
        continue;
      }
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
      new_jid_users: newJid,
      new_ios_jid_users: newIosJid,
      new_android_jid_users: newAndroidJid
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

  const toUpsertFull = rows.map((r) => ({
    date: r.date,
    campaign_name: r.campaign_name,
    paid_users: r.new_jid_users,
    new_jid_users: r.new_jid_users,
    new_ios_jid_users: r.new_ios_jid_users,
    new_android_jid_users: r.new_android_jid_users
  }));

  const toUpsertMid = rows.map((r) => ({
    date: r.date,
    campaign_name: r.campaign_name,
    paid_users: r.new_jid_users,
    new_jid_users: r.new_jid_users,
    new_ios_jid_users: r.new_ios_jid_users
  }));

  const toUpsertLegacy = rows.map((r) => ({
    date: r.date,
    campaign_name: r.campaign_name,
    paid_users: r.new_jid_users,
    new_jid_users: r.new_jid_users
  }));

  type PersistMode = "full" | "no_android" | "legacy";
  let persistMode: PersistMode = "full";

  // 仅写入 server_paid_data；按库结构逐级回退（缺列时仍可写入其余字段）
  const { error: upsertFullError } = await supabaseClient.from("server_paid_data").upsert(toUpsertFull, {
    onConflict: "date,campaign_name"
  });

  if (upsertFullError) {
    const { error: upsertMidError } = await supabaseClient
      .from("server_paid_data")
      .upsert(toUpsertMid, { onConflict: "date,campaign_name" });

    if (upsertMidError) {
      const { error: upsertLegacyError } = await supabaseClient
        .from("server_paid_data")
        .upsert(toUpsertLegacy, { onConflict: "date,campaign_name" });

      if (upsertLegacyError) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "SUPABASE_ERROR",
              message: "写入失败",
              details: `${upsertFullError.message}${
                upsertMidError.message !== upsertFullError.message
                  ? `；回退(无安卓)：${upsertMidError.message}`
                  : ""
              }${
                upsertLegacyError.message !== upsertMidError.message
                  ? `；回退(仅JID)：${upsertLegacyError.message}`
                  : ""
              }`
            }
          },
          { status: 500 }
        );
      }
      persistMode = "legacy";
    } else {
      persistMode = "no_android";
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      inserted: rows.length,
      skipped: errors.length,
      errors,
      /** full：iOS+安卓均写入；no_android：库无安卓列；legacy：仅 JID 数量写入 */
      persist_mode: persistMode,
      /** 兼容旧前端 */
      used_legacy_schema: persistMode === "legacy"
    }
  });
}
