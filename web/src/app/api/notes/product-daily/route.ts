import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { isValidIndiaDate } from "@/lib/date";

const PRODUCT_LINES = ["ft", "pu", "ppt"] as const;

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
  const date = searchParams.get("date");
  const productLine = searchParams.get("product_line");

  if (!date || !isValidIndiaDate(date)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_DATE", message: "date 必须是 YYYY-MM-DD" } },
      { status: 400 }
    );
  }

  if (!productLine || !PRODUCT_LINES.includes(productLine as any)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_PRODUCT_LINE", message: "product_line 必须是 ft / pu / ppt" } },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseClient
    .from("product_daily_notes")
    .select("id,date,product_line,content,created_at")
    .eq("date", date)
    .eq("product_line", productLine)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "SUPABASE_ERROR", message: "查询 product_daily_notes 失败", details: error.message }
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data });
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

  const body = await req.json().catch(() => null);
  const date: string | undefined = body?.date;
  const productLine: string | undefined = body?.product_line;
  const content: string | undefined = body?.content;

  if (!date || !isValidIndiaDate(date)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_DATE", message: "date 必须是 YYYY-MM-DD" } },
      { status: 400 }
    );
  }

  if (!productLine || !PRODUCT_LINES.includes(productLine as any)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_PRODUCT_LINE", message: "product_line 必须是 ft / pu / ppt" } },
      { status: 400 }
    );
  }

  if (typeof content !== "string") {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CONTENT", message: "content 必须为字符串" } },
      { status: 400 }
    );
  }

  if (!content.trim()) {
    const { error } = await supabaseClient
      .from("product_daily_notes")
      .delete()
      .eq("date", date)
      .eq("product_line", productLine);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "SUPABASE_ERROR",
            message: "删除 product_daily_notes 失败",
            details: error.message
          }
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseClient
    .from("product_daily_notes")
    .upsert(
      { date, product_line: productLine, content: content.trim() },
      { onConflict: "date,product_line" }
    );

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "SUPABASE_ERROR", message: "写入 product_daily_notes 失败", details: error.message }
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
