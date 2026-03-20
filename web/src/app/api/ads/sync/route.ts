import { NextRequest, NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabase";
import { inferProductLine } from "@/lib/productLine";
import { INDIA_TZ, toIndiaDate, getIndiaDateRange, accountDateToIndiaDate } from "@/lib/date";
import { GoogleAdsApi } from "google-ads-api";

// 环境变量由用户在部署时配置
const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const customerIdsEnv = process.env.GOOGLE_ADS_CUSTOMER_IDS; // 逗号分隔
/** 账户报表时区，与 Google Ads 后台一致；若非印度则会把 segments.date 转为印度日再入库，默认 Asia/Kolkata */
const accountTimezone = process.env.GOOGLE_ADS_ACCOUNT_TIMEZONE ?? INDIA_TZ;

function buildClient() {
  if (!developerToken || !clientId || !clientSecret || !refreshToken || !customerIdsEnv) {
    throw new Error("Google Ads 环境变量未配置完整");
  }

  const api = new GoogleAdsApi({
    developer_token: developerToken,
    client_id: clientId,
    client_secret: clientSecret
  });

  const customerIds = customerIdsEnv.split(",").map((id) => id.trim()).filter(Boolean);

  return { api, customerIds };
}

export async function POST(req: NextRequest) {
  if (!supabaseClient) {
    return NextResponse.json(
      { ok: false, error: { code: "SUPABASE_NOT_CONFIGURED", message: "Supabase 环境变量未配置" } },
      { status: 500 }
    );
  }

  let days = 1;
  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body.days === "number" && body.days > 0 && body.days <= 30) {
      days = body.days;
    }
  } catch {
    // ignore
  }

  let client;
  try {
    client = buildClient();
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: { code: "GOOGLE_ADS_CONFIG_ERROR", message: e.message } },
      { status: 500 }
    );
  }

  const { api, customerIds } = client;

  const endDate = toIndiaDate(new Date());
  const ranges = getIndiaDateRange(
    toIndiaDate(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000)),
    endDate
  );

  const accountResults: { customerId: string; ok: boolean; error?: string }[] = [];
  const rowsToUpsert: {
    date: string;
    campaign_name: string;
    product_line: string;
    spend: number;
    budget: number;
    ads_conversions: number;
  }[] = [];

  for (const customerId of customerIds) {
    try {
      const customer = api.Customer({
        customer_id: customerId,
        refresh_token: refreshToken,
        login_customer_id: customerId
      });

      // 以印度时区的日期范围进行查询
      const from = ranges[0];
      const to = ranges[ranges.length - 1];

      const query = `
        SELECT
          segments.date,
          campaigns.name,
          metrics.cost_micros,
          metrics.conversions,
          campaign_budget.amount_micros,
          campaigns.status
        FROM campaign
        WHERE
          segments.date BETWEEN '${from}' AND '${to}'
          AND campaigns.status = 'ENABLED'
      `;

      // 实际运行时，用户需要确保 google-ads-api SDK 可用
      // 这里假设 query 返回数组
      const gaRows = await customer.query(query, {
        // 指定客户时区
        // @ts-ignore google-ads-api 类型中可能没有 tz 字段，这里只作示意
        timezone: INDIA_TZ
      });

      for (const r of gaRows as any[]) {
        const segmentDate = (r.segments?.date ?? "") as string;
        const date = accountDateToIndiaDate(segmentDate, accountTimezone);
        const campaignName = r.campaigns.name as string;
        const spend = (r.metrics.cost_micros ?? 0) / 1_000_000;
        const budget = (r.campaign_budget.amount_micros ?? 0) / 1_000_000;
        const conversions = Number(r.metrics.conversions ?? 0);

        rowsToUpsert.push({
          date,
          campaign_name: campaignName,
          product_line: inferProductLine(campaignName),
          spend,
          budget,
          ads_conversions: conversions
        });
      }

      accountResults.push({ customerId, ok: true });
    } catch (e: any) {
      accountResults.push({ customerId, ok: false, error: e.message ?? String(e) });
    }
  }

  const anyFailed = accountResults.some((r) => !r.ok);

  if (anyFailed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "ADS_SYNC_PARTIAL_FAILURE",
          message: "部分或全部 Google Ads 账号拉取失败，今天的数据视为失败。",
          details: accountResults
        }
      },
      { status: 500 }
    );
  }

  if (rowsToUpsert.length === 0) {
    return NextResponse.json({
      ok: true,
      data: { upserted: 0, accounts: accountResults }
    });
  }

  const { error } = await supabaseClient.from("ads_metrics").upsert(
    rowsToUpsert.map((r) => ({
      date: r.date,
      campaign_name: r.campaign_name,
      product_line: r.product_line,
      spend: r.spend,
      budget: r.budget,
      ads_conversions: r.ads_conversions
    })),
    {
      onConflict: "date,campaign_name"
    }
  );

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "SUPABASE_ERROR", message: "写入 ads_metrics 失败", details: error.message }
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: { upserted: rowsToUpsert.length, accounts: accountResults }
  });
}

