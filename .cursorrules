Google Ads 聚合分析后台 - 核心决策准则
1. 业务逻辑核心
时区标准: 全系统强制使用 GMT+05:30 (Asia/Kolkata)。所有 CSV 解析、数据库存储必须统一该时区。

匹配逻辑: 核心关联键为 campaign_name。

产品映射:

Fachat: 前缀 ft (不区分大小写)

Parau: 前缀 pu (不区分大小写)

Pinkpinkchat: 前缀 ppt (不区分大小写)

2. 技术栈锁定
框架: Next.js 14 (App Router), TypeScript (Strict)。

存储: Supabase (PostgreSQL) 用于存储指标 CSV 与新 JID 付费 CSV 解析后的数据。

库: papaparse (CSV解析), dayjs (时区处理)。

3. 日期与时区陷阱（必须遵守，避免“今天的数据显示在昨天”）
- 本系统所有业务日期均为「印度时区自然日」YYYY-MM-DD，仅日粒度、无时间部分。
- 禁止对「纯日期字符串」使用 dayjs(str) 或 new Date(str) 再格式化：在非印度时区（如中国、美西）会被当作本地午夜解析，导致日期少一天。
- 正确做法：对 YYYY-MM-DD 字符串必须用 dayjs.tz(str, "YYYY-MM-DD", "Asia/Kolkata") 解析/格式化；对“当前时刻”再用 toIndiaDate(new Date())。
- 从 Supabase 读出的 date 列可能是字符串 "YYYY-MM-DD" 或 ISO 带时区；归一化时必须按上一条处理，保证展示与存储一致。

4. AI 执行行为
数据对齐: 计算 CPA 时，若 CSV 中不存在该 campaign_name，则 CPA 显示为 "-"。

进度管理: 任务完成后必须自动更新 progress.txt。