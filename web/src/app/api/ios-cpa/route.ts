/**
 * Ads AI 数据分析平台拉取「新 iOS 用户 CPA」：按 campaign_name 对齐 Supabase 中
 * ads_metrics.spend + server_paid_data.new_ios_jid_users，与现有 dashboard 逻辑一致。
 *
 * 鉴权：Authorization: Bearer <IOS_CPA_SECRET>（与 Ads AI backend .env 中 IOS_CPA_API_KEY 相同）
 *
 * POST JSON:
 * { "report_date": "YYYY-MM-DD", "campaigns": [
 *   { "google_customer_id": "907...", "campaign_id": "123", "campaign_name": "ft-web-..." }
 * ]}
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidIndiaDate, toIndiaDate } from "@/lib/date";

type CampIn = {
  google_customer_id?: string;
  campaign_id?: string;
  campaign_name?: string;
};

type DayAgg = { spend: number; ios: number };

function iosCpaUsd(spend: number, ios: number): number | null {
  if (ios <= 0) return null;
  const v = spend / ios;
  return Number.isFinite(v) ? v : null;
}

function rowKey(c: CampIn): string {
  const gid = String(c.google_customer_id ?? "").replace(/\D/g, "");
  const cid = String(c.campaign_id ?? "");
  return `${gid}:${cid}`;
}

export async function POST(req: NextRequest) {
  const secret = process.env.IOS_CPA_SECRET?.trim();
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const reportDateRaw = body?.report_date as string | undefined;
  const campaigns = (Array.isArray(body?.campaigns) ? body.campaigns : []) as CampIn[];

  if (!reportDateRaw || !isValidIndiaDate(reportDateRaw)) {
    return NextResponse.json({ error: "invalid report_date (expect YYYY-MM-DD, India calendar)" }, { status: 400 });
  }
  const reportD = toIndiaDate(reportDateRaw);

  const names = [
    ...new Set(
      campaigns.map((c) => String(c.campaign_name ?? "").trim()).filter(Boolean)
    ),
  ];
  if (names.length === 0) {
    return NextResponse.json({
      by_key: {},
      note: "no campaign_name in request; Ads AI must send campaign name to match CSV/Supabase",
    });
  }

  const { data: adsAll, error: adsErr } = await admin
    .from("ads_metrics")
    .select("date,campaign_name,spend")
    .in("campaign_name", names);

  if (adsErr) {
    return NextResponse.json({ error: `ads_metrics: ${adsErr.message}` }, { status: 500 });
  }

  let paidRows: { date: unknown; campaign_name: unknown; new_ios_jid_users?: unknown }[] | null = null;
  const full = await admin
    .from("server_paid_data")
    .select("date,campaign_name,new_ios_jid_users")
    .in("campaign_name", names);
  if (!full.error) {
    paidRows = full.data ?? [];
  } else {
    const legacy = await admin.from("server_paid_data").select("date,campaign_name,new_jid_users").in("campaign_name", names);
    if (legacy.error) {
      return NextResponse.json(
        { error: `server_paid_data: ${full.error.message} / ${legacy.error.message}` },
        { status: 500 }
      );
    }
    paidRows = (legacy.data ?? []).map((r) => ({
      ...r,
      new_ios_jid_users: r.new_jid_users,
    }));
  }

  const perName = new Map<string, Map<string, DayAgg>>();

  function bucket(name: string) {
    if (!perName.has(name)) perName.set(name, new Map());
    return perName.get(name)!;
  }

  for (const r of adsAll ?? []) {
    const n = String(r.campaign_name ?? "");
    const d = toIndiaDate(String(r.date ?? ""));
    const m = bucket(n);
    const cur = m.get(d) ?? { spend: 0, ios: 0 };
    cur.spend += Number(r.spend ?? 0);
    m.set(d, cur);
  }

  for (const r of paidRows ?? []) {
    const n = String(r.campaign_name ?? "");
    const d = toIndiaDate(String(r.date ?? ""));
    const m = bucket(n);
    const cur = m.get(d) ?? { spend: 0, ios: 0 };
    cur.ios = Number(r.new_ios_jid_users ?? 0);
    m.set(d, cur);
  }

  function statsForName(campaignName: string) {
    const m = perName.get(campaignName);
    if (!m) {
      return { cur: null as number | null, lo: null as number | null, hi: null as number | null };
    }

    const cpas: number[] = [];
    for (const agg of m.values()) {
      const v = iosCpaUsd(agg.spend, agg.ios);
      if (v != null) cpas.push(v);
    }

    const day = m.get(reportD);
    const cur = day ? iosCpaUsd(day.spend, day.ios) : null;

    if (cpas.length === 0) {
      return { cur, lo: null, hi: null };
    }
    return { cur, lo: Math.min(...cpas), hi: Math.max(...cpas) };
  }

  const by_key: Record<string, { ios_cpa?: number; ios_cpa_min?: number; ios_cpa_max?: number }> = {};

  for (const c of campaigns) {
    const name = String(c.campaign_name ?? "").trim();
    if (!name) continue;
    const key = rowKey(c);
    if (!key.includes(":") || key.startsWith(":")) continue;

    const { cur, lo, hi } = statsForName(name);
    const entry: { ios_cpa?: number; ios_cpa_min?: number; ios_cpa_max?: number } = {};
    if (cur != null) entry.ios_cpa = cur;
    if (lo != null) entry.ios_cpa_min = lo;
    if (hi != null) entry.ios_cpa_max = hi;
    if (Object.keys(entry).length > 0) {
      by_key[key] = entry;
    }
  }

  return NextResponse.json({ by_key });
}
