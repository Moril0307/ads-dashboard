# 小白从零部署到 Vercel（让领导用浏览器看数据）

把这套流程想象成：**把代码放到 GitHub → 让 Vercel 从 GitHub 自动打包网站 → 把数据库密码告诉 Vercel**。  
你只需要按顺序做，**不要求你会写代码**。

---

## 你会得到什么？

部署成功后，会有一个类似下面的网址（示例）：

- `https://xxxx.vercel.app`

你可以把下面两个链接发给领导：

- **数据看板**：`https://xxxx.vercel.app/dashboard`
- **上传 CSV**：`https://xxxx.vercel.app/upload`

（把 `xxxx` 换成你项目真实的名字即可。）

---

## 第 0 步：先确认你本地有这两个东西

1. **你的项目文件夹**  
   路径里应该有 **`web`** 这个文件夹（里面是 Next.js 网站）。

2. **Supabase 账号里已经建好的项目**  
   你本地 `web/.env.local` 里应该已经有（或你曾经配置过）类似：
   - `NEXT_PUBLIC_SUPABASE_URL=...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`  
   **部署时要把这两项填到 Vercel**，网站才能读写数据。

> 说明：本仓库的 `.gitignore` 已经忽略了 `.env*`，**密钥不会被推到 GitHub**，这是正常的、也是安全的。

---

## 第 1 步：注册 GitHub（放代码用）

1. 打开：**https://github.com**
2. 点 **Sign up** 注册（用邮箱即可）。
3. 注册好后登录进去。

---

## 第 2 步：在 Mac 上确认能用「终端」和 Git

1. 在 Mac 上打开 **「终端」**（Spotlight 搜索 “终端” 或 “Terminal”）。
2. 输入下面命令后按回车：

```bash
git --version
```

- 若显示版本号（例如 `git version 2.x`），说明 **Git 可用**，跳到 **第 3 步**。
- 若提示「找不到命令」或弹出安装，按系统提示 **安装「命令行开发者工具」**（Command Line Tools），装完再试一次 `git --version`。

---

## 第 3 步：在 GitHub 上新建一个「空仓库」

1. 登录 GitHub 后，右上角 **「+」** → **「New repository」**。
2. **Repository name**：随便取，例如 `ads-dashboard`。
3. 选 **Public**（公开）或 **Private**（私有）都可以；小白可先选 **Private**，只有你能看到代码。
4. **不要**勾选 *Add a README*（保持空仓库，后面第一次推送更省事）。
5. 点 **Create repository**。

创建完成后，页面会出现一段地址，形如：

- `https://github.com/你的用户名/ads-dashboard.git`  
把这个 **`.git` 结尾的地址** 复制下来，**第 5 步**要用。

---

## 第 4 步：在你的电脑上，把项目变成 Git 仓库并提交

1. 打开 **终端**，进入你的项目根目录（**注意**：是包含 `web` 的那一层，不是 `web` 里面）：

```bash
cd "/Users/yinjiafeng/Desktop/vibe coding/ads vibe coding"
```

2. 初始化 Git（若从来没做过）：

```bash
git init
```

3. 把所有文件加入暂存区：

```bash
git add .
```

4. 做第一次提交：

```bash
git commit -m "第一次提交，准备部署"
```

若提示 **「Please tell me who you are」**，按它提示执行两条（把名字和邮箱改成你的）：

```bash
git config user.name "你的名字"
git config user.email "你的邮箱@example.com"
```

然后再执行一次：

```bash
git commit -m "第一次提交，准备部署"
```

---

## 第 5 步：把代码推送到 GitHub

1. 把下面命令里的地址换成 **第 3 步**你复制的仓库地址：

```bash
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

2. 第一次 `git push` 时，浏览器可能会让你 **登录 GitHub 授权**。按提示做即可。

3. 成功后，回到 GitHub 网页刷新仓库，应能看到你的代码文件。

**若 `git remote add` 报错说 remote 已存在**，改用：

```bash
git remote set-url origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

---

## 第 6 步：注册 / 登录 Vercel（用 GitHub 登录最省事）

1. 打开：**https://vercel.com**
2. 点 **Sign Up**，选择 **Continue with GitHub**，授权 Vercel 访问你的 GitHub。

---

## 第 7 步：在 Vercel 里导入项目（最重要：Root Directory）

1. 登录 Vercel 后，点 **Add New…** → **Project**。
2. 在 **Import Git Repository** 里选中你第 3 步建的仓库 → **Import**。
3. 进入配置页后，**一定要做这一件事**：
   - 找到 **「Root Directory」**
   - 点 **Edit**
   - 填：**`web`**
   - 保存 / 确认  

   **原因**：Next.js 项目在 `web` 文件夹里；不填的话 Vercel 会在根目录找项目，**会部署失败**。

4. **Framework Preset** 一般会自动是 **Next.js**，不用改。

---

## 第 8 步：在 Vercel 里配置环境变量（连上 Supabase）

在 **Environment Variables** 区域，新增两行（名字必须完全一致）：

| Name（变量名） | Value（值） |
|----------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | 打开 Supabase → **Project Settings** → **API** → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同一页里的 **anon** **public** 密钥（**不要**填 `service_role`） |

填好后，勾选应用到 **Production**（以及 Preview 若存在，可一并勾选）。

---

## 第 9 步：点击 Deploy（部署）

1. 点 **Deploy**。
2. 等待几分钟，出现 **Congratulations** 或绿色成功页面。
3. 点 **Visit** 或复制上面的 **域名**。

先打开：

- `https://你的域名.vercel.app/dashboard`

若报错「Supabase 未配置」之类：回到 Vercel → 项目 → **Settings → Environment Variables** 检查两项是否填对，然后在 **Deployments** 里对最新部署点 **⋯ → Redeploy**。

---

## 第 10 步：发给领导

把实际域名替换进去即可，例如：

- 看板：`https://你的域名.vercel.app/dashboard`  
- 上传：`https://你的域名.vercel.app/upload`  

---

## 你以后改代码、怎么看最新版？

1. 在电脑上改好代码后，在终端进入项目根目录：

```bash
cd "/Users/yinjiafeng/Desktop/vibe coding/ads vibe coding"
git add .
git commit -m "更新某某功能"
git push
```

2. Vercel 通常会自动再部署一次；一两分钟后刷新网页即可。

---

## 仍卡住时，把这两样东西发给别人帮你看

1. Vercel 里 **最后一次部署**的 **Build Log**（报错那几行）。  
2. 浏览器打开看板时，若失败，按 F12 → **Network** → 点开失败的请求，把 **状态码** 和 **返回内容** 截图。

---

## 可选：再读一份略短的清单

仓库里还有 **`DEPLOY_VERCEL.md`**，适合已经会一点 Git 的人当 checklist 用。  
你是小白的话，**以本文件为准从头到尾做一遍**即可。
