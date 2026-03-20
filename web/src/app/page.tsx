import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200">
          AdsDataHub · 广告聚合分析
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          聚合广告成本，<span className="text-sky-700">一眼看到真实 CPA</span>
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          上传 Ads 指标表 + 新 JID 付费表，系统自动按「日期 + 广告系列」对齐，并以 USD 视角展示每条系列的真实获客成本。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/dashboard"
          className="col-span-2 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm hover:shadow-md"
        >
          <p className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
            OVERVIEW
          </p>
          <div className="space-y-2">
            <p className="text-sm">
              按产品线拆分 ft / pu / ppt，支持日期范围、产品日汇总、系列明细、备注与 CSV 导出。
            </p>
            <button className="inline-flex items-center rounded border border-sky-200 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50">
              进入看板 →
            </button>
          </div>
        </Link>

        <Link
          href="/upload"
          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm hover:shadow-md"
        >
          <p className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
            DATA IN
          </p>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">上传 CSV</h2>
            <p className="text-xs text-slate-600">
              指标表 + 新 JID 付费表，一次性导入 7–30 天数据，系统自动对齐 key。
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>支持中文表头 · 自动跳过坏行</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
              快速开始
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}

