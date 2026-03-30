import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { isValidIndiaDate } from "@/lib/date";

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
  const campaignName = searchParams.get("campaign_name");

  if (!date || !isValidIndiaDate(date)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_DATE", message: "date 必须是 YYYY-MM-DD" } },
      { status: 400 }
    );
  }

  if (!campaignName) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CAMPAIGN", message: "campaign_name 不能为空" } },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseClient
    .from("campaign_notes")
    .select("id,date,campaign_name,content,created_at")
    .eq("date", date)
    .eq("campaign_name", campaignName)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "SUPABASE_ERROR", message: "查询 campaign_notes 失败", details: error.message }
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
  const campaignName: string | undefined = body?.campaign_name;
  const content: string | undefined = body?.content;

  if (!date || !isValidIndiaDate(date)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_DATE", message: "date 必须是 YYYY-MM-DD" } },
      { status: 400 }
    );
  }

  if (!campaignName) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CAMPAIGN", message: "campaign_name 不能为空" } },
      { status: 400 }
    );
  }

  if (typeof content !== "string") {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CONTENT", message: "content 不能为空" } },
      { status: 400 }
    );
  }

  if (!content.trim()) {
    // content 为空视为删除备注
    const { error } = await supabaseClient
      .from("campaign_notes")
      .delete()
      .eq("date", date)
      .eq("campaign_name", campaignName);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "SUPABASE_ERROR",
            message: "删除 campaign_notes 失败",
            details: error.message
          }
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseClient
    .from("campaign_notes")
    .upsert(
      {
        date,
        campaign_name: campaignName,
        content
      },
      { onConflict: "date,campaign_name" }
    );

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "SUPABASE_ERROR", message: "写入 campaign_notes 失败", details: error.message }
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

