技术栈规范
1. 核心框架
Framework: Next.js 14 (App Router)

Language: TypeScript

UI: shadcn/ui + Tailwind CSS

2. 存储与工具
Database: Supabase (PostgreSQL)

CSV 处理: papaparse

时区处理: dayjs (锁定 Asia/Kolkata)

3. 外部接入
当前版本不直接调用外部 API，广告数据与新 JID 付费人数均通过手动导出的 CSV 上传。

部署: Vercel

4. 前端视觉与主题
- 全站采用 **Light Mode** 办公风：
  - 页面背景统一使用白色（`bg-white`），正文文字为深灰（`text-slate-800/900`）。
  - 看板视图使用 Excel 式透视表布局：左侧 Sticky 日期列，右侧为产品日汇总三列 + 多个 Campaign 列组。
  - 颜色与对齐等细节规范统一见 `FRONTEND_GUIDELINES.md`（特别是 USD 转换、CPA 条件格式、40px 透明 gap 列等规则）。