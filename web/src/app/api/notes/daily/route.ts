import { NextRequest, NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabase";
import { isValidIndiaDate } from "@/lib/date";

export async function GET(req: NextRequest) {
  if (!supabaseClient) {
    return NextResponse.json(
      { ok: false, error: { code: "SUPABASE_NOT_CONFIGURED", message: "Supabase 环境变量未配置" } },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  if (!startDate || !endDate || !isValidIndiaDate(startDate) || !isValidIndiaDate(endDate)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_DATE", message: "start_date 和 end_date 必须是 YYYY-MM-DD" } },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseClient
    .from("daily_notes")
    .select("id,date,content,created_at")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "SUPABASE_ERROR", message: "查询 daily_notes 失败", details: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest) {
  if (!supabaseClient) {
    return NextResponse.json(
      { ok: false, error: { code: "SUPABASE_NOT_CONFIGURED", message: "Supabase 环境变量未配置" } },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const date: string | undefined = body?.date;
  const content: string | undefined = body?.content;

  if (!date || !isValidIndiaDate(date)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_DATE", message: "date 必须是 YYYY-MM-DD" } },
      { status: 400 }
    );
  }

  if (!content || typeof content !== "string") {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CONTENT", message: "content 不能为空" } },
      { status: 400 }
    );
  }

  const { error } = await supabaseClient.from("daily_notes").insert({ date, content });

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "SUPABASE_ERROR", message: "写入 daily_notes 失败", details: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

