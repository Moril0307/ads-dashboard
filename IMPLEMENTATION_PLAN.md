施工计划 (Implementation Plan)
第一阶段：基础建设
[ ] 1.1 初始化项目并安装依赖 (dayjs, papaparse)。

[ ] 1.2 封装时区工具：确保日期查询支持“起始日期”到“结束日期”的范围逻辑。

第二阶段：历史数据处理
[ ] 2.1 指标表 CSV 模块：支持解析包含不同日期、广告系列、预算、费用的多行数据，并批量写入 ads_metrics（按日期 + 广告系列 upsert）。

[ ] 2.2 新 JID 付费 CSV 模块：支持解析包含不同日期、广告系列、新 JID 付费数量的多行数据，并批量写入 server_paid_data（按日期 + 广告系列 upsert）。

第三阶段：动态看板开发
[ ] 3.1 增加日期筛选器 (Date Range Picker) 组件。

[ ] 3.2 编写聚合查询 SQL：支持根据选定日期范围从 Supabase 提取每日明细。

[ ] 3.3 实现 DataTable 的分页与排序，确保查看历史长周期数据时不卡顿。

[ ] 3.4 透视表布局与产品日汇总：
    - 在前端将 `GET /api/dashboard?view=pivot&product_line=...` 返回的 `rows` 先按 `date` 升序排序。
    - 使用 reduce 按 `date` 聚合出该产品线的产品日汇总：
      - `totalSpend`：同一天所有系列的 `spend`（HKD）累加。
      - `totalPaid`：同一天所有系列的 `new_jid_users`（仅累加 > 0 的行）累加。
      - `overallCpa`：若 `totalPaid > 0`，则 `totalSpend / totalPaid`（HKD 空间内计算），否则为 `null`。
    - 渲染时统一使用全局 `toUsd()`（基于固定汇率 1 USD = 7 HKD）将 `totalSpend` 与 `overallCpa` 转为 USD，并保留两位小数。
    - 在日期右侧插入三列「总花费 (USD) / 总 JID 付费数量 / 总体 CPA (USD)」，再插入一个 40px 透明 gap，然后才是各 Campaign 列组。

[ ] 3.5 每周视觉分割（Weekly Break Row）：
    - 在透视表渲染阶段，对已经升序排列的日期数组 `pivotDates` 进行遍历。
    - 对于当前日期 `date` 和前一个日期 `prevDate`：
      - 使用 `parseIndiaDate(date).getDay()` 计算星期几（0 = 周日，1 = 周一，…，6 = 周六）。
      - 当 `prevDate` 存在且 `weekday(prevDate) === 0` 且 `weekday(date) === 1` 时，说明从周日跨到了下周一。
    - 在这种情况下，在当前数据行之前插入一条“空白行 (Empty Row)`：
      - 使用 `<tr><td colSpan={totalColumns} className="h-4 border-0 bg-white p-0" /></tr>` 形式，不包含任何数据单元格。
      - `totalColumns` 由前端按照「日期 + 日汇总三列 + 日汇总与第一个 Campaign 之间的 gap + 所有 Campaign 列 + Campaign 之间的 gap」计算，确保空白行横跨整张表。
      - 该行高度约为 12–16px，背景为纯白、无边框，以形成每周之间的视觉断层。

第四阶段：备注与映射
[ ] 4.1 确保备注功能能准确对应到历史长河中的具体某一天。