# Lessons Learned

## 1. Tailwind CSS 与 PostCSS 版本不匹配导致构建失败

### 问题现象
- **报错信息**：`Error: It looks like you're trying to use tailwindcss directly as a PostCSS plugin. The PostCSS plugin has moved to a separate package, so to continue using Tailwind CSS with PostCSS you'll need to install @tailwindcss/postcss and update your PostCSS configuration.`
- **触发场景**：在 `package.json` 中使用 `"tailwindcss": "latest"`，安装时拉取到 Tailwind v4；项目仍使用旧版 PostCSS 配置（在 `postcss.config.mjs` 里直接写 `tailwindcss: {}`），与 v4 的拆分架构不兼容。

### 导致问题的模式
- 对 **tailwindcss** 使用 **未锁定的最新版**（`"latest"` 或 `"*"`），在 Tailwind 主版本升级后，旧配置会突然失效。
- 未在文档或规范中约定「本项目使用 Tailwind v3 + 经典 PostCSS 配置」，导致后续维护者或 AI 误用 v4 或混用配置方式。

### 防止规则
1. **锁定 Tailwind 主版本**：若使用经典 PostCSS 配置（`postcss.config.mjs` 中 `plugins: { tailwindcss: {}, autoprefixer: {} }`），在 `package.json` 中固定为 v3，例如：
   - `"tailwindcss": "^3.4.17"`（推荐），或
   - `"tailwindcss": "~3.4.0"`
2. **避免对核心样式/构建依赖使用 `latest`**：对 `tailwindcss`、`postcss`、`autoprefixer` 等与构建强相关的 devDependencies 使用明确的主版本范围，便于复现构建。
3. **在 TECH_STACK 或 README 中写明**：本项目使用 Tailwind CSS v3 + PostCSS；若将来升级 v4，需同步改为使用 `@tailwindcss/postcss` 并更新配置。

---

## 2. 根布局中 "use client" 与 metadata 不能同时存在

### 问题现象
- **报错信息**：`You are attempting to export "metadata" from a component marked with "use client", which is disallowed. Either remove the export, or the "use client" directive.`
- **触发场景**：`src/app/layout.tsx` 文件顶部写了 `"use client"`，同时又 `export const metadata = { title, description }`。Next.js App Router 规定 `metadata` 只能在**服务端组件**中导出。

### 导致问题的模式
- 根布局被误标为客户端组件（`"use client"`），但根布局只渲染 `<html>`、`<body>` 和 `children`，并不需要 useState、useEffect 等客户端能力；同时为了 SEO/标题又导出了 `metadata`，二者冲突。

### 防止规则
1. **根布局默认不加 "use client"**：`app/layout.tsx` 除非确实需要客户端 API（如 theme provider 的 useState），否则保持为服务端组件，以便正常导出 `metadata`。
2. **需要 metadata 的页面/布局不要加 "use client"**：若某 layout 或 page 要 `export const metadata`，该文件不能包含 `"use client"`；可将需要客户端的部分拆到子组件，子组件单独加 `"use client"`。

---

## 3. 字符串被错误转义导致解析失败（Unterminated string constant）

### 问题现象
- **报错信息**：`Parsing ecmascript source code failed`、`Unterminated string constant`，指向文件第一行 `\"use client\";` 附近。
- **触发场景**：`dashboard/page.tsx`（或其它 TSX 文件）中大量引号被错误写成了 `\"`（反斜杠+引号），例如 `\"use client\"`、`\"react\"`。解析器把 `\"` 当作“字符串内的转义引号”，导致字符串边界错乱。

### 导致问题的模式
- 对整份文件或大段代码做“引号替换”时，把正常代码里的 `"` 误替换成了 `\"`（例如在 JSON 或某些生成流程中多了一层转义）。
- 未在编辑后做一次语法/构建检查，导致错误上线到本地运行才暴露。

### 防止规则
1. **源码中指令和 import 使用正常引号**：`"use client"`、`from "react"` 等应是普通 ASCII 双引号 `"`，不要写成 `\"`。
2. **批量替换引号时限定范围**：只替换真正需要转义的场景（例如字符串内容里的引号），不要对整文件做 `"` → `\"` 的全局替换。
3. **编辑后跑一次构建**：执行 `npm run build` 或保存后依赖 dev 的自动编译，确保无 Parsing / Unterminated string 类错误。

---

## 4. next.config 中过期的 experimental 选项

### 问题现象
- **报错/警告**：`Invalid next.config.mjs options detected: Unrecognized key(s) in object: 'appDir' at "experimental"`。
- **触发场景**：在 `next.config.mjs` 中写了 `experimental: { appDir: true }`。Next.js 13+ 已默认启用 App Router，Next.js 16 中 `appDir` 不再是合法配置项。

### 导致问题的模式
- 沿用旧版 Next 文档或模板中的配置，未随主版本升级清理已废弃的 experimental 选项。

### 防止规则
1. **升级 Next 后检查 next.config**：对照 Next.js config 文档移除已废弃的 `experimental` 键（如 `appDir`）。
2. **新项目不写无必要的 experimental**：若使用默认的 App Router，可不写 `experimental`；需要时只保留当前版本支持的选项。

---

## 5. next dev 锁冲突与端口占用

### 问题现象
- **报错信息**：`Unable to acquire lock at .../web/.next/dev/lock, is another instance of next dev running?` 或 `Port 3000 is in use by process xxxxx, using available port 3001 instead.`
- **触发场景**：多次运行 `npm run dev` 未关旧终端；或修改 `next.config.mjs` 后 Next 自动重启，新进程与旧进程抢同一把锁；或其它程序已占用 3000 端口。

### 导致问题的模式
- 在多个终端或多次启动 dev 而未先终止旧进程。
- 修改 next.config 后未意识到会触发自动重启，导致“重启中的新进程”与“尚未退出的旧进程”同时存在。

### 防止规则
1. **启动新 dev 前先关旧进程**：在已运行 `npm run dev` 的终端里按 **Ctrl+C** 终止，再在新终端执行 `npm run dev`。
2. **遇到锁报错时清理再起**：执行 `rm -rf .next/dev .next/cache`，并结束占用端口的进程（例如 `lsof -ti:3000 | xargs kill -9`、`lsof -ti:3001 | xargs kill -9`），然后只启动一次 `npm run dev`。
3. **修改 next.config 后如遇异常**：若自动重启后出现锁错误，先 Ctrl+C 停掉当前 dev，再按上面步骤清理并重新启动。
4. **文档中注明**：在 README 或 lessons 中写明「同一项目不要同时起多个 next dev；改 next.config 后若报锁错误，先停进程、删 .next/dev 再起」。

---

## 6. 外部 API 复杂时，可以先用 CSV 简化流程

### 背景
- 直接接入 Google Ads API 需要配置 developer token、OAuth 凭据、账号权限等，开发与调试门槛较高。
- 在早期探索阶段，我们更关注「指标数据 + 真实新 JID 付费人数」的对齐与分析，而不是实时性。

### 决策
- 当前版本不直接调用 Google Ads API，而是采用 **双 CSV 流**：
  - 指标表 CSV：日期/天 + 广告系列 + 预算 + 费用。
  - 新 JID 付费 CSV：日期 + 广告系列 + 新 JID 付费数量。
- 所有 CPA 计算都基于这两张表在数据库中的对齐结果完成。

### 防止未来踩坑的规则
1. 若后续要引入 Google Ads API：
   - 先在 PRD 和 TECH_STACK 中显式写出「API 是可选增强层」，并保留 CSV 作为兜底方案。
   - 不要在完全依赖 API 的前提下设计核心数据流，保证一旦 API 授权或限额出问题，仍可通过 CSV 保持产品可用。
2. 在产品早期验证阶段，优先采用「从平台导出 CSV → 后台导入」的模式，减少因为外部 API 配置导致的开发阻力。 

---

## 7. 复杂看板布局要先固化“数据透视结构”和汇总逻辑

### 背景
- 早期看板实现采用经典的“行即记录”的列表视图（每行 = `date + campaign`），在信息密度较高时横向对比不直观。
- 迭代后切换为「左日期 + 右多列 Campaign Group」的透视表布局，并在日期右侧增加“产品日汇总三列”（总花费 / 总 JID 付费数量 / 总体 CPA），再往右才是具体 Campaign 明细。

### 经验
- 在 UI 层做透视表前，先在代码里明确一层稳定的 reduce 逻辑：
  - 按 `date` 聚合当前产品线的 `totalSpend` / `totalPaid`，在 HKD 空间里计算，再用统一的 `toUsd()` 转成 USD 渲染。
  - 汇总代码与单行 CPA 使用同一套常量（如 `HKD_PER_USD`、`GOOD_CPA`、`BAD_CPA`），避免多处“写死汇率/阈值”导致视图不一致。
- 视觉上，把“日汇总列”与“明细列”之间用一条固定宽度（例如 40px）的透明列彻底隔开，能有效降低信息噪音，让用户一眼区分「今天整体表现」和「具体系列表现」。

### 防止规则
1. 任何涉及汇总/透视的 UI 迭代，先在 PRD/FRONTEND_GUIDELINES 中写清：
   - 聚合粒度（例如按 `date` / `product_line` / 两者组合）；
   - 汇总字段公式（包括 0 / 缺失时的表现）；
   - 与原始金额/币种的关系（例如统一在 HKD 中计算，再前端转换为 USD）。
2. 在代码中集中封装：
   - 汇总计算（例如 `buildDailySummaryMap`）；
   - 金额转换（单一 `toUsd()` 函数 + 固定汇率常量），避免在多个组件中重复写 `x / 7`。
3. 做透视表类布局时，提前确定：
   - Sticky 列（例如左侧日期）与阴影效果；
   - 列组之间的“物理间隔”实现方式（透明 gap 列，而不是随意 padding），从一开始就保证可扩展性和视觉一致性。
