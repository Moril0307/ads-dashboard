AdsDataHub 前端视觉规范

## 1. Dark Mode（旧版透视表，仅作参考）
- 结构：左侧日期 Sticky，右侧深色玻璃风 Campaign Group，多列数据。
- 颜色：背景使用深色（`bg-slate-950`）、表头 `bg-slate-900`，行斑马纹 `bg-slate-900/40` 与 `bg-slate-900/60`。
- 本模式已完成一版实现，后续以 Light Mode 为主。

## 2. Light Mode（当前主视觉 · Excel 办公风）

### 2.1 全局色彩系统
- 页面背景：统一使用纯白 `#FFFFFF`（Tailwind：`bg-white`）。
- 正文文字：默认深灰 `#1E293B`（Tailwind：`text-slate-800` / `text-slate-900`）。
- 表格边框：所有单元格边框使用极浅灰 `#E2E8F0`（Tailwind：`border-slate-200`）。
- 错误提示：浅红背景 + 深红文字（例如 `bg-rose-50 text-rose-700 border-rose-200`）。

### 2.2 布局与留白
- 透视表仍然采用「左侧日期 Sticky + 右侧多列 Campaign Group」结构。
- 任意两个 Campaign Group 之间插入宽度约 16px 的透明隔离列（Tailwind：`w-4 bg-transparent border-none`），不参与条纹与边框，只露出白色背景，形成自然断句。
- 每个 Campaign Group 的数据单元格视作一个整体条带：左右边缘使用轻微圆角（`rounded-sm`），整条内部背景比页面略浅（如 `bg-slate-50` / `bg-slate-100`）。

### 2.3 字体与对齐（Excel 风）
- 除日期列外，所有数据单元格：
  - 使用等宽字体 `font-mono`（浏览器默认等宽族即可）。
  - 字号统一为约 13px（Tailwind：`text-[13px]`）。
  - 文本居中对齐（`text-center`），上下左右内边距统一（例如 `px-2 py-1.5`）。
- 日期列：
  - 固定在左侧（`position: sticky; left: 0`）。
  - 文本左对齐、加粗（`font-semibold`），使用高亮蓝绿文字（如 `text-sky-700` 或 `text-cyan-700`）。
  - 与右侧数据区之间通过一条竖向阴影区分。

### 2.4 广告系列标题（Campaign Header）
- 每个 Campaign 名称显示在顶部一行，覆盖其所有子列（使用 `colSpan`）。
- 标题背景使用浅蓝色 `bg-sky-100`，边角带轻微圆角（例如 `rounded-t-md`），与下方数据区有清晰区分。
- 标题文字使用深蓝 `text-sky-900`，字号略小但加粗，方便快速定位系列。
- 标题行下方一行为子列名称（备注 / 预算 / 消耗 / 付费 / 新JID用户数 / 新JID CPA / 新IOS JID数量 / 新IOS 用户CPA / 新安卓 JID数量 / 新增IOS付费用户占比），背景使用白色或极浅灰。

### 2.5 Sticky 日期列与阴影
- 日期列的表头与数据单元格都采用 Sticky 方案，并在右侧添加一条向右的淡淡阴影：
  - 示例：`shadow-[4px_0_6px_rgba(15,23,42,0.08)] bg-white z-20`.
- 阴影的作用是：当横向滚动时，右侧数据看起来从日期列“后面”滑过，提升层次感。

### 2.6 数据与条件格式
- 所有数据单元格：
  - 使用 `border border-slate-200` 勾勒网格。
  - 字体为 `font-mono`，居中对齐。
- 关键字段：
  - 「消耗 (Spend)」、「新JID CPA (Real CPA)」与「新IOS 用户CPA」使用加粗 `font-semibold`，文本颜色稍深（例如 `text-slate-900`）。
- CPA 条件格式（Excel 风）：
  - 优秀：CPA ≤ GOOD_CPA（如 20 USD）。单元格背景用浅绿 `bg-emerald-50`，文字用深绿 `text-emerald-700`。
  - 不佳：CPA ≥ BAD_CPA（如 40 USD）。单元格背景用浅红 `bg-rose-50`，文字用深红 `text-rose-700`。
  - 中间区间：使用默认浅灰背景（如 `bg-slate-50` 或白色）与 `text-slate-800`。
  - CPA 不可用（`-`）时，使用中性样式，不加任何警示色。

### 2.7 交互与悬停
- 单元格 Hover 效果要轻：背景可以从 `bg-white` 过渡到 `bg-slate-50`，同时保留边框，不做强烈高亮。
- 备注列：
  - 点击备注单元格时弹出编辑交互（浏览器 prompt 或后续内嵌编辑），保存后立刻回写。
  - 备注的文本保持 11–12px，颜色稍淡（`text-slate-600`），避免抢占指标视觉权重。

### 2.8 产品日汇总列（Daily Summary Columns）
- 在日期列右侧插入一组“产品日汇总”固定列，仅针对当前选中产品线（Tab）：
  - **总花费 (USD)**：该产品线在该日期下所有 Campaign 的 `spend` 之和；计算在 HKD 空间完成，渲染时统一通过全局的 `toUsd()`（基于 `HKD_PER_USD = 7`）转换为 USD，使用 `text-[13px] font-mono font-semibold text-slate-800`。
  - **总JID付费数量**：该产品线在该日期下所有 Campaign 的 `new_jid_users` 之和（仅计入 `> 0` 的值），使用 `font-semibold` 呈现。
  - **总体CPA (USD)**：若总人数 > 0，则以 HKD 计算 `totalSpend / totalPaid` 后统一用 `toUsd()` 转为 USD，保留两位小数；若总人数 = 0，则显示 `-`。条件格式与单行 CPA 相同：优秀为 `bg-emerald-50 text-emerald-700`，预警为 `bg-rose-50 text-rose-700`。
- 若某天该产品线完全没有消耗和付费（总花费 = 0，总人数 = 0），汇总列统一显示 `0.00 / 0 / -`，并使用中性色样式。
- 日汇总列右侧必须有一列固定宽度约 40px 的透明 gap 列（`w-[40px] border-0 bg-transparent`），用来在视觉上将“整体表现”与后续每个 Campaign 的明细区完全分隔开。

### 2.9 日期排序与每周空行分割
- 透视表中的日期列按**升序**排序：最早的日期显示在上方，最新的日期显示在下方，符合“从过去到现在”的阅读习惯。
- 在日期渲染时，根据印度时区的星期几信息（`0 = 周日, 1 = 周一, ...`）在以下位置插入空白分割行：
  - 当上一条记录是周日 (`weekday(prevDate) === 0`)，当前记录是周一 (`weekday(currentDate) === 1`) 时，在周一所在行之前渲染一条**空白行**。
  - 该空白行：
    - `colSpan` 覆盖整张表（日期 + 日汇总 + gap + 所有 Campaign 列）。
    - 使用白色背景、不绘制任何边框。
    - 行高与普通数据行接近（例如通过内部 `div.h-[38px]` 实现），从视觉上形成“每周块”之间的明显断层。
- 在选定日期范围内的最后一条数据行之后，同样插入一条同样高度的空白行，用于在底部留出缓冲空间，避免用户在滚动/选择最后一行时被浏览器底部遮挡该行内容。

