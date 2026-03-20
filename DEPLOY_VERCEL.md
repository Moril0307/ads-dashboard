# 部署到 Vercel（领导可通过链接访问看板）

## 你需要准备的东西

1. **GitHub / GitLab / Bitbucket 账号**（任意一个即可，用于把代码交给 Vercel 拉取）。
2. **Vercel 账号**（可用 GitHub 一键登录：[vercel.com](https://vercel.com)）。
3. **Supabase 项目**里的两项（与本地 `web/.env.local` 一致即可）：
   - **Project URL** → 对应环境变量 `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** 密钥 → 对应 `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   （在 Supabase：**Project Settings → API**）

> 看板、上传 CSV 主要依赖上面两个变量。若你还使用「Google Ads 自动同步」接口，再在 Vercel 里补 `GOOGLE_ADS_*` 等变量（见 `web/src/app/api/ads/sync/route.ts`），不影响领导只看网页上传的数据。

---

## 第一步：把代码放到 Git 远程仓库

在项目根目录（包含 `web` 文件夹的那一层）执行（若尚未初始化）：

```bash
cd "/Users/yinjiafeng/Desktop/vibe coding/ads vibe coding"
git init
git add .
git commit -m "chore: initial commit for Vercel"
```

在 GitHub 新建一个 **空仓库**（不要勾选自动加 README，避免冲突），按页面提示：

```bash
git remote add origin https://github.com/你的用户名/你的仓库名.git
git branch -M main
git push -u origin main
```

**不要提交 `web/.env.local`**（含密钥）。若被 `git add` 进去了，先把它加入 `.gitignore` 再 `git rm --cached web/.env.local`。

---

## 第二步：在 Vercel 导入项目

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard) → **Add New… → Project**。
2. **Import** 你刚推送的 Git 仓库。
3. 关键配置：
   - **Framework Preset**：`Next.js`（一般会自动识别）。
   - **Root Directory**：点开 **Edit**，填 **`web`**（必须！仓库根目录不是 Next 应用，`web` 才是）。
4. **Environment Variables**（在部署前或部署后在 Settings 里补全均可）新增：

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |

5. 点击 **Deploy**，等待构建完成。

---

## 第三步：把地址发给领导

部署成功后 Vercel 会给一个域名，例如：

- `https://你的项目名.vercel.app`

让领导打开：

- **看板**：`https://你的项目名.vercel.app/dashboard`
- **上传 CSV**：`https://你的项目名.vercel.app/upload`

（若你绑定了自定义域名，则用你的域名替换。）

---

## 常见问题

### 1. 打开看板报 Supabase / 查询失败

- 检查 Vercel **Environment Variables** 是否与 Supabase 控制台一致（不要多空格、不要复制错成 `service_role`）。
- 改完变量后：**Deployments → 某次部署右侧 ⋮ → Redeploy** 让新变量生效。

### 2. Supabase Row Level Security (RLS)

若表开了 RLS 且没有允许 **anon** **读/写** 对应表，线上会查不到或上传失败。需在 Supabase 为 `ads_metrics`、`server_paid_data` 等表配置与你的业务匹配的策略（开发与线上使用同一套库时，本地能通、线上一般也能通）。

### 3. 代码更新后领导看不到最新功能

把新代码 `git push` 到主分支；Vercel 默认会自动重新部署。也可在控制台手动 **Redeploy**。

---

## 安全说明（给领导看数据时）

- `NEXT_PUBLIC_*` 会打进前端包，**相当于公开配置**；真正的权限应由 **Supabase RLS** 与密钥类型（只用 **anon**，不要把 **service_role** 填进前端变量）保证。
- 若有更高保密要求，再考虑登录态、IP 限制、Vercel Password Protection（付费功能）等。
