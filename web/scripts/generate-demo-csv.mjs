import fs from "node:fs";
import path from "node:path";

function getIndiaTodayYmd() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function toDateUtc(ymd) {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function toYmdUtc(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function eachDate(startYmd, endYmd) {
  const out = [];
  const start = toDateUtc(startYmd);
  const end = toDateUtc(endYmd);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(toYmdUtc(d));
  }
  return out;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function main() {
  const startDate = process.argv[2] ?? "2026-04-01";
  const endDate = process.argv[3] ?? getIndiaTodayYmd();
  const dates = eachDate(startDate, endDate);
  if (dates.length === 0) {
    throw new Error(`日期范围无效：${startDate} -> ${endDate}`);
  }

  const campaigns = [
    "ft_demo_a",
    "ft_demo_b",
    "pu_demo_a",
    "pu_demo_b",
    "ppt_demo_a",
    "ppt_demo_b",
  ];

  const metricsRows = [["日期", "广告系列", "预算", "费用"]];
  const paidRows = [["日期", "广告系列", "新 JID 付费数量", "新IOS JID数量", "新安卓 JID数量"]];

  dates.forEach((date, di) => {
    campaigns.forEach((campaign, ci) => {
      const budget = round2(480 + ci * 95 + di * 16 + (di % 3) * 10);
      const spend = round2(Math.max(50, budget * (0.58 + ((di + ci) % 5) * 0.06)));

      const newJidUsers = Math.max(1, Math.round(spend / (28 + (ci % 3) * 6 + (di % 2) * 2)));
      const iosShare = 0.45 + ((di + ci) % 4) * 0.05;
      const newIos = Math.max(0, Math.min(newJidUsers, Math.round(newJidUsers * iosShare)));
      const newAndroid = Math.max(0, newJidUsers - newIos);

      metricsRows.push([date, campaign, String(budget), String(spend)]);
      paidRows.push([date, campaign, String(newJidUsers), String(newIos), String(newAndroid)]);
    });
  });

  const outputDir = path.resolve(process.cwd(), "demo-data");
  fs.mkdirSync(outputDir, { recursive: true });

  const metricsPath = path.join(outputDir, `metrics-${startDate}-to-${endDate}.csv`);
  const paidPath = path.join(outputDir, `paid-${startDate}-to-${endDate}.csv`);

  fs.writeFileSync(metricsPath, metricsRows.map((r) => r.join(",")).join("\n"), "utf8");
  fs.writeFileSync(paidPath, paidRows.map((r) => r.join(",")).join("\n"), "utf8");

  console.log(`已生成：${metricsPath}`);
  console.log(`已生成：${paidPath}`);
  console.log(`共 ${dates.length} 天，${campaigns.length} 个演示广告系列。`);
}

main();
