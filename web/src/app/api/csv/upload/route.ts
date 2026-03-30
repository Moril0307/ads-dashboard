import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { isValidIndiaDate } from "@/lib/date";

type CsvRow = {
  date: string;
  campaign_name: string;
  paid_users: string;
  new_jid_users: string;
};

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

  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: "greedy"
  });

  if (parsed.errors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PARSE_ERROR",
          message: "CSV 解析失败",
          details: parsed.errors.slice(0, 5).map((e) => ({ row: e.row, message: e.message }))
        }
      },
      { status: 400 }
    );
  }

  const requiredHeader = ["date", "campaign_name", "paid_users", "new_jid_users"];
  const headers = parsed.meta.fields ?? [];

  if (headers.length !== requiredHeader.length || !requiredHeader.every((h, i) => headers[i] === h)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_HEADER",
          message: "CSV 列头必须为: date,campaign_name,paid_users,new_jid_users（且顺序一致）"
        }
      },
      { status: 400 }
    );
  }

  const seenKeys = new Set<string>();
  const rows: { date: string; campaign_name: string; paid_users: number; new_jid_users: number }[] = [];
  const errors: { index: number; message: string }[] = [];

  parsed.data.forEach((row, index) => {
    const line = index + 2; // 加上表头行
    const date = (row.date ?? "").trim();
    const campaignName = (row.campaign_name ?? "").trim();
    const paidUsersRaw = (row.paid_users ?? "").trim();
    const newJidUsersRaw = (row.new_jid_users ?? "").trim();

    if (!date || !isValidIndiaDate(date)) {
      errors.push({ index: line, message: "date 为空或格式不是 YYYY-MM-DD" });
      return;
    }

    if (!campaignName) {
      errors.push({ index: line, message: "campaign_name 不能为空" });
      return;
    }

    const paidUsers = Number(paidUsersRaw);
    const newJidUsers = Number(newJidUsersRaw);

    if (!Number.isInteger(paidUsers)) {
      errors.push({ index: line, message: "paid_users 必须是整数" });
      return;
    }

    if (!Number.isInteger(newJidUsers)) {
      errors.push({ index: line, message: "new_jid_users 必须是整数" });
      return;
    }

    const key = `${date}__${campaignName}`;
    if (seenKeys.has(key)) {
      errors.push({ index: line, message: "同一文件中 date + campaign_name 重复" });
      return;
    }
    seenKeys.add(key);

    rows.push({ date, campaign_name: campaignName, paid_users: paidUsers, new_jid_users: newJidUsers });
  });

  if (errors.length > 0) {
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

  const { error } = await supabaseClient
    .from("server_paid_data")
    .upsert(
      rows.map((r) => ({
        date: r.date,
        campaign_name: r.campaign_name,
        paid_users: r.paid_users,
        new_jid_users: r.new_jid_users
      })),
      {
        onConflict: "date,campaign_name"
      }
    );

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "SUPABASE_ERROR", message: "写入 Supabase 失败", details: error.message }
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data: { inserted: rows.length } });
}

