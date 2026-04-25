# SnapCue

macOS menu bar AI study assistant — 截图 → AI 分析 → 显示答案。
纯 menu bar app，无主窗口，无 Dock 图标。

## 产品简介

用户按快捷键截图（⌃⌥S 静默截前台窗口，⌃⌥A 区域选择），截图自动发送到后端，后端代理调用 AI API 分析选择题，返回答案+置信度+一句话解释，显示在 menu bar 的 dropdown panel 里。

核心价值：把传统的 "截图→切到AI聊天→上传→等待→阅读→切回" 的 7 步流程缩减到 2 步。

## Architecture

三层架构：Electron 桌面端 → Node.js 后端 API → AI API（当前 GPT-5 mini，未来可切换 Gemini Flash / Claude）

- **Electron main process**: 截图捕获、全局快捷键、tray icon 管理、向后端发 API 请求（所有网络调用都在 main process）
- **Electron renderer**: React UI，dropdown panel 展示 + onboarding 窗口（不发网络请求）
- **IPC 边界**: main process 通过 IPC push 结果给 renderer，renderer 通过 IPC invoke/send 请求 main process 执行操作
- **Backend (Fastify)**: AI API 代理，未来加认证和 credit 管理
- **External**: AI API (GPT-5 mini), 未来加 Supabase (auth + DB), Stripe (支付)

## Tech Stack

- Electron 30+, React 18+, TypeScript strict, Vite + electron-vite
- Tailwind CSS (renderer)
- sharp (npm) — 图片缩放到 max 1200px 长边
- Fastify — 后端 API
- openai (npm) — GPT-5 mini API（当前），未来抽象为多模型支持

## Commands

- `npm run dev` — 启动 Electron 开发模式（hot reload）
- `npm run build` — 生产构建
- `npm run lint` — ESLint + Prettier
- `npm test` — vitest
- `cd backend && npm run dev` — 后端开发服务器（端口 3001）
- `cd backend && npm test` — 后端测试
- `npm run pack` — 生产构建 + 打包 .dmg（输出到 dist/）
- `rm ~/Library/Application\ Support/snapcue/settings.json && npm run dev` — 重置设置并重启（重新触发 onboarding）

## Code Style

- Strict TypeScript（no `any`）
- Functional React + hooks only
- Named exports（除 React 页面组件外不用 default export）
- 文件名 kebab-case，组件 PascalCase
- IPC channel 命名：`模块:动作`（如 capture:start, settings:get）
- UI 语言统一英文

## Key Decisions

- 截图发送前 downscale 到 max 1200px 长边（省 token + 降延迟）
- API 超时 30 秒（GPT-5 mini 有推理过程，需要更多时间）
- 隐蔽模式：截图+分析全程静默，dropdown 永不自动弹出，仅点击 tray icon 主动查看结果
- 截图失败/用户取消区域选择时静默忽略，不弹出任何 UI
- 快捷键默认 ⌃⌥S（静默）/ ⌃⌥A（区域）/ ⌃⌥D（toggle dropdown），用户可在 Settings 页自定义，持久化到 JSON 文件
- Dropdown 用户主动 dismiss（click outside / Esc / 切换 app）
- 设置持久化用 app.getPath('userData')/settings.json，无额外 npm 依赖
- Tray icon 支持 8 种样式（ghost/dot/book/bolt/square/input/shield/cn），ghost 默认使用 logo 原图 PNG template image，其余 SVG→sharp→nativeImage 动态生成
- 截图只存内存（lastScreenshot 变量），不写磁盘，下次截图覆盖，app 退出即丢弃
- Tray icon 状态反馈：idle（正常）→ analyzing（降低 opacity 变暗淡）→ done（恢复正常，3 秒后回到 idle）
- app.dock.hide() — 纯 menu bar app（onboarding 期间临时显示 dock）
- IPC 类型定义在 shared/types.ts，main 和 renderer 共享
- window.snapcue 作为 preload 暴露的 API 命名空间
- 快捷键录入使用 e.code（物理按键）而非 e.key，避免 macOS Alt 修饰符产生特殊字符（如 Alt+S → Å）
- 权限检测使用 systemPreferences.getMediaAccessStatus('screen')，但 macOS 15 开发模式下不可靠（总是返回 granted），onboarding 中不做检测，永远显示引导
- ⌃��S 静默截图已知限制：截取的是前台窗口，可能截到非题目窗口（如 Terminal），尝试过截鼠标所在窗口和截鼠标所在显示器方案均不稳定，已回退到基础方案。⌃⌥A 区域选择是更可靠的截图方式
- setContentProtection(true) 可用于屏幕共享隐藏，但 macOS 15 ScreenCaptureKit 和 Zoom 原生客户端可能绕过，未来如需更深层隐藏需用 Swift/Metal 原生渲染
- ⌃⌥D toggle dropdown 已重新实现：直接对 dropdown BrowserWindow 做 show/hide，不操作 tray，避开之前 tray destroy/recreate 的 bug
- Onboarding 不做权限检测，永远显示引导页（首次安装用户 99% 没有授权，且 macOS 15 检测 API 不可靠）
- Onboarding 完成标记仅在用户点击 "Continue" 时写入，点击 "Open System Settings" 不标记（防止 macOS 强制重启后用户看不到任何窗口）
- 后端部署平台选择 Railway（自动部署、免费额度够 beta、不需要 Dockerfile）
- API 认证：x-api-key header，SNAPCUE_API_KEY 环境变量，未设置时跳过验证（本地开发兼容）
- 环境变量通过 Vite envPrefix 'SNAPCUE\_' 在构建时注入，import.meta.env.SNAPCUE_API_URL / SNAPCUE_API_KEY
- electron-builder 打包：sharp 和 @img 需要 asarUnpack，mac.identity 设为 null 跳过签名
- App icon: 白色背景 + 深色幽灵角色，macOS 自动应用 squircle 蒙版
- 全题型支持后 answer 字段不再限于字母，前端根据 answer 长度自适应展示（scrollWidth 检测截断）
- 判断题从 T/F 改为 True/False 完整单词，避免与选项字母混淆
- 填空题多个空用 " | " 分隔
- 简答题 reason 为空字符串，answer 本身就是完整可提交的回答
- Sign-in 独立窗口：Paywall 触发 / Settings signed-out 统一走 440×420 modal（electron/signin.ts）承载 SignInForm，全局单一路径（`auth:openSignin` 无参数分叉）。独立窗口相对 dropdown 内嵌的好处：(a) 尺寸 / 视觉可独立设计，不受 200px 宽度约束；(b) 用户去邮箱点 magic link 回来可 cmd+tab 切回窗口；(c) deep link 回调统一关闭窗口 + 刷新 footer
- 业务失败响应契约：后端 402 / 429 等"用户能通过操作解决"的失败响应 body 必须带 CreditsMeta。前端依赖 meta 渲染付费引导面板（no_credits → Upgrade，daily_limit → Daily limit reached），零二次请求。Electron main 把 meta 转存内存并推 credits:update，footer 与 Settings 自动同步

## Backend env 配置约定

PR 2 第一次尝试 credit system 时配置环节翻车（变量命名不一致、Supabase 凭证缺、dev/prod 不对称、JWT 验证卡住）后，定下以下约定：

- ✅ **命名约定**：第三方原生名用其原生形式（`OPENAI_API_KEY` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / 未来 `STRIPE_*`），SnapCue 自有变量加 `SNAPCUE_` 前缀（如 `SNAPCUE_API_KEY`）。前端 Vite 全部 `SNAPCUE_` 前缀（envPrefix 过滤要求）
- ✅ **zod schema 校验**：`backend/src/lib/env.ts` 启动时校验全部必需变量，包含 anon-key 误用检测（`sb_publishable_` 前缀直接 reject）。任何模块要读 env 必须 import `env` object，禁止裸 `process.env['X']`
- ✅ **fail-fast**：`server.ts` 第一行 import env.ts，缺值或格式错时启动直接 throw，错误信息聚合在一处
- ✅ **测试 env 用 vi.mock**：测试要替换 env 值时用 `vi.mock('../lib/env.js', () => ({ env: { ... } }))`，**不要**用 `process.env['X'] = 'y'`。原因：`backend/.env` 通过 dotenv 在 env.ts 加载时就读完了，且 dotenv 不覆盖已有值；测试里改 process.env 会被真实 .env 值覆盖（task 4 webhook 测试就踩过这个坑——真实 `STRIPE_PRICE_MONTHLY` 把 fake 测试值挡掉，导致 `priceIdToType` 永远返回 null）。`stripe-webhook.test.ts` 是范本。
- ⬜ **dev / prod 配置差异文档**：还没补，6.3 拍板前不急

JWT 验证 401 问题最终定位是 `backend/.env` 里的 `SUPABASE_SERVICE_ROLE_KEY` 写成了 anon/publishable key，service_role 才有验证 JWT 的权限。zod schema 的 anon-key 检测从此防止此类回归

## Onboarding 流程

首次启动时显示 400×480px 居中窗口（titleBarStyle: hiddenInset），4 页引导：

1. **Welcome**：SnapCue 品牌 + "screenshot. analyze. answer." + 流程可视化（截图图标 → 箭头 → 答案字母 A + 绿色置信度点）+ "Get Started" 按钮
2. **Shortcuts**：两个并排卡片展示 ⌃⌥S（silent capture）和 ⌃⌥A（area select），附带 "any language · any subject" 标语 + "Continue" 按钮
3. **Permission**：永远显示权限引导（不检测）。红色警告图标 + 说明文字 + monospace 路径提示（System Settings → Privacy & Security → Screen Recording）+ "Open System Settings" 按钮 + "Continue" 链接
4. **Sign In**：标题 "Sign in to sync credits across devices" + 副标 "We'll email you a magic link. No password needed." + 复用 SignInForm 组件（email input + Send Magic Link + Resend 15s cooldown）+ 底部 "Skip for now" 链接（未登录也能完成引导，idle-view 会再引导登录）

- 页面 2/3/4 有 ← back 按钮可回退
- 底部 4 个页面指示点，当前页有辉光效果
- 渲染方式：同一 renderer，通过 URL hash `#onboarding` 区分模式
- Page 4 监听 `auth:signedIn`：magic link deep link 成功登录后自动 `completeOnboarding()`，用户可停留在邮箱 tab 无需切回引导窗口
- 完成后设置 `hasOnboarded: true`，关闭窗口，隐藏 dock

## UI/UX 设计规范

追求原生 macOS vibrancy menu 的质感，紧凑、隐蔽、小字。

### Brand Color

付费引导入口使用 emerald 作为唯一品牌色：`#10b981`（RGB 16, 185, 129）。派生透明度用于不同权重的 UI 元素：

- `rgba(16,185,129,0.9)` — 按钮 / 链接文字（高对比）
- `rgba(16,185,129,0.75)` — 低权重链接（如 "Manage subscription →"）
- `rgba(16,185,129,0.25)` — 按钮 hover 背景
- `rgba(16,185,129,0.15)` — 按钮静态背景

**原则**：emerald 仅用于"付费相关"入口（Upgrade 按钮、Manage subscription 链接、no_credits paywall），其它交互一律白色半透明。这保证视觉上一眼就能定位付费 CTA。

### Neutral Button Colors

次要按钮统一使用以下派生值。按语义分两档：

**Neutral（一级）**：引导用户主动操作的次要按钮（Sign in / Back / Resend 等）。和主 CTA 区分度明显，但依然需要被用户看到。

- Button text: `rgba(255, 255, 255, 0.7)`
- Button bg: `rgba(255, 255, 255, 0.08)`
- Hover bg: `rgba(255, 255, 255, 0.12)`

**Subtle（二级）**：被动 dismiss 或恢复类按钮（OK / Retry / Cancel dismiss 等）。视觉权重明显低于 Neutral，避免和付费 CTA 争夺注意力。

- Button text: `rgba(255, 255, 255, 0.5)`
- Button bg: `rgba(255, 255, 255, 0.06)`
- Hover bg: `rgba(255, 255, 255, 0.10)`

**原则**：如果按钮的行为是"用户需要决定往哪走"（主动），用 Neutral；如果按钮的行为是"确认我看到了"或"恢复到出错前"（被动），用 Subtle。

### Dropdown 整体

- 宽度 200px（CSS + BrowserWindow 双重约束），高度动态自适应，max-height 400px
- 背景 `rgba(30,30,30,0.92)` + `backdrop-filter: blur(20px)`
- 圆角 8px，边框 `rgba(255,255,255,0.06)`
- 隐藏滚动条（`::-webkit-scrollbar { display: none }`），内容仍可滚动
- use-auto-height 防抖（阈值 > 2px + debounce 30ms）防止 resize 循环闪烁
- html/body 背景色 `rgba(30,30,30,0.92)` 防止 resize 时白色闪烁
- 页面切换（main ↔ settings）fade 过渡动画 150ms ease

### Idle 空闲态

**首次使用态**（hasFirstCapture 为 false）：

- "ready to go"，13px，font-weight 500，`rgba(255,255,255,0.6)`
- "open a question and press ⌃⌥A"（读取用户实际设置的快捷键），11px，`rgba(255,255,255,0.3)`
- 首次截图分析成功后自动切换到正常态，hasFirstCapture 持久化到 settings.json

**正常态**（hasFirstCapture 为 true）：

- 三个装饰圆点（5px，`rgba(255,255,255,0.15)`，横排 gap 6px）
- 主快捷键用 key cap 风格展示：[⌃ ctrl] [⌥ opt] [A]，修饰键 44px 双行（符号+文字），字母键 28px 单行，圆角 5px，立体边框
- 下方 "area select" 标签，9px
- 分隔线后用 9px monospace 列出 ⌃⌥S silent capture 和 ⌃⌥D show / hide
- 所有快捷键从 settings 动态读取
- 居中布局，padding `16px 12px`

### Analyzing 加载态

- 三个白色圆点脉冲动画（依次延迟 0.2s，opacity 0.15↔0.6，周期 1.4s）
- 下方文字 11px，`rgba(255,255,255,0.3)`
- 默认显示 "analyzing"，8 秒后切换为 "taking longer than usual..."
- 居中布局，padding `16px 12px`

### AnswerPanel 行样式

收起状态每行三个元素：题号 + 答案字母 + 置信度圆点

```
1  A                        ●
2  C                        ●
3  B                        ●
```

- 题号：纯数字（无 "Q" 前缀），11px monospace，`rgba(255,255,255,0.35)`，22px 宽
- 答案字母：13px font-weight 600 monospace，`rgba(255,255,255,0.95)`，letter-spacing 0.5px，22px 宽
- 置信度圆点：5px 直径，opacity 0.8，绿(high)/黄(mid)/红(low)，flex 靠右
- 行布局：padding `4px 10px`，hover `rgba(255,255,255,0.05)` + border-radius 5px
- 容器 padding：`6px 4px`

展开状态：点击某行展开 reason，同一时间只展开一行

- 展开 reason：10px，`rgba(255,255,255,0.35)`，padding-left 34px 对齐答案字母，paddingTop 2px，paddingBottom 4px
- 展开收起动画：150ms ease

空答案状态（answers 为空数组）：显示 "no questions detected" + "try ⌃⌥A to select the question area"

### 错误状态

- 11px 文字，`rgba(255,255,255,0.35)`，padding `6px 10px`
- 错误类型：network_error / timeout / no_questions / parse_error / unknown
- Retry 按钮：全宽，`rgba(255,255,255,0.06)` 背景，11px，border-radius 4px，padding `4px 0`
- 复用缓存截图重试，无需重新截图
- no_questions 不显示 Retry（同一张图重试结果相同，浪费 token），改为提示 "try ⌃⌥A to select the question area"

### Dropdown Footer（主面板）

```
                        ⚙  Quit
```

- 左侧预留未来 credits 显示（当前为空）
- 右侧齿轮 SVG stroke icon，13px，`rgba(255,255,255,0.25)` → hover `rgba(255,255,255,0.5)`
- 右侧 Quit 文字按钮（齿轮右边），11px，`rgba(255,255,255,0.2)` → hover `rgba(255,255,255,0.5)`
- padding `4px 10px`，顶部边线 `0.5px solid rgba(255,255,255,0.06)`
- Settings 页面时隐藏此 footer（settings 有自己的底栏）

### Settings 页面（dropdown 内 inline 切换）

点击齿轮 → view 切换到 settings，fade 过渡。

**返回按钮**：`← back`，SVG chevron 11px + 文字 11px `rgba(255,255,255,0.4)` → hover `rgba(255,255,255,0.7)`，padding `6px 10px 4px`

**SHORTCUTS 区块**：

- section 标题 "SHORTCUTS"，11px uppercase，letter-spacing 0.5px，`rgba(255,255,255,0.3)`
- 三行 flex space-between（silent capture / area select / toggle answers）：左侧 label 11px `rgba(255,255,255,0.6)`，右侧快捷键 pill（`rgba(255,255,255,0.06)` 背景，padding `2px 8px`，border-radius 4px，11px monospace `rgba(255,255,255,0.4)`）
- 录入模式：点击 pill → "press keys..." 闪烁（CSS blink animation），按下组合键保存
- 保存成功：pill 背景短暂闪绿 `rgba(34,197,94,0.2)` 持续 800ms
- 冲突检测：与另一个快捷键相同时 pill 背景闪红 600ms + 显示 "already in use" 文字提示，不保存
- Esc 取消录入

**ICON 区块**：

- section 标题 "ICON"，同上样式
- 4 个预设横排（dot 圆点 / book 书本 / bolt 闪电 / square 方块），每个 32×26px，border-radius 5px
- 选中项 `rgba(255,255,255,0.08)` 背景，点击切换并通过 IPC 更新 tray icon

**底部 footer**：

- 左侧 "v0.1.0"，11px，`rgba(255,255,255,0.25)`
- 右侧 "Quit" 文字按钮，11px，`rgba(255,255,255,0.2)` → hover `rgba(255,255,255,0.5)`
- 顶部边线 `0.5px solid rgba(255,255,255,0.06)`，padding `4px 10px`

## IPC Channel 清单

| Channel                 | 方向            | 类型   | 用途                                                |
| ----------------------- | --------------- | ------ | --------------------------------------------------- |
| capture:start           | renderer → main | invoke | 请求截图                                            |
| capture:loading         | main → renderer | push   | 正在分析                                            |
| capture:result          | main → renderer | push   | 分析结果（AnswerItem[]）                            |
| capture:error           | main → renderer | push   | 错误信息（CaptureError: type + message + canRetry） |
| capture:retry           | renderer → main | invoke | 用缓存截图重试分析                                  |
| credits:update          | main → renderer | push   | 余额更新                                            |
| settings:get            | renderer → main | invoke | 读取设置                                            |
| settings:set            | renderer → main | invoke | 写入设置                                            |
| permission:status       | main → renderer | push   | 权限状态                                            |
| permission:openSettings | renderer → main | invoke | 打开系统设置                                        |
| permission:recheck      | renderer → main | invoke | 重新检测权限                                        |
| dropdown:hide           | renderer → main | send   | 关闭 dropdown                                       |
| dropdown:resize         | renderer → main | send   | 上报内容高度                                        |
| onboarding:complete     | renderer → main | invoke | 标记 onboarding 完成，关闭窗口                      |
| app:quit                | renderer → main | invoke | 退出应用                                            |
| auth:getCurrentUser     | renderer → main | invoke | 读当前登录用户（AuthUser \| null）                  |
| auth:signIn             | renderer → main | invoke | 发送 Magic Link 邮件                                |
| auth:signOut            | renderer → main | invoke | 登出（清 session + 通知后端）                       |
| auth:openPricing        | renderer → main | invoke | 默认浏览器打开定价页                                |
| auth:openSignin         | renderer → main | invoke | 打开独立 sign-in 窗口（440×420）                    |
| auth:closeSignin        | renderer → main | send   | 关闭独立 sign-in 窗口                               |
| auth:signedIn           | main → renderer | push   | 登录成功事件（payload: { email }）                  |
| auth:signedOut          | main → renderer | push   | 登出事件                                            |
| credits:get             | renderer → main | invoke | 读当前 credits meta（内存缓存）                     |
| credits:refresh         | renderer → main | invoke | 强制从 /me 刷新 credits                             |

## Response Meta Contract

后端业务性失败响应（402 / 429）和分析成功响应，body 必须携带 `CreditsMeta`，前端据此渲染付费引导 / 余额信息，无需二次请求。

| HTTP | 场景           | body.meta                       | UI 呈现                      |
| ---- | -------------- | ------------------------------- | ---------------------------- |
| 200  | 分析成功       | 扣费后最新 meta                 | footer 刷新 "N left"         |
| 401  | 未登录         | —                               | paywall: Sign in             |
| 402  | credits 耗尽   | `credits_remaining: 0`          | paywall: Upgrade             |
| 429  | 当日 50 次上限 | `daily_usage_count` + plan 信息 | paywall: Daily limit reached |
| 500  | 服务端错误     | —                               | 通用 Retry                   |

**Rule of thumb**：任何"业务性"失败（用户能通过操作解决的）响应必须带 meta；Electron main 收到后存内存 + 推 `credits:update`，footer 与 Settings 同步更新。系统性错误（500 / 网络失败）不带 meta，走通用 Retry 路径。

## Session 续接指引

> 此小节供 AI agent 续接 session 时快速定位状态；内容会随 phase 推进滚动更新。

- **当前 phase**：Phase 6.3 进行中 — tasks 1-5 ✅（定价 / Stripe 账号 / Products / webhook endpoint / customer_id writeback 双重兜底），task 6 (checkout flow) Block 2 已完成（后端路由 + web stub 页），下一步 **Block 3+** Electron pricing window + IPC + paywall 替换

- **新 session 开头**：`git status` + `git log --oneline -5` 验证当前状态。本仓库 push 节奏由用户主动控制，AI 不要擅自 push。

- **`backend/.env` 当前状态**（gitignored，新 session 不可见，列在这里供 AI agent 心里有数）：
  - ✅ OPENAI_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 全部已填
  - ✅ 4 个 `STRIPE_PRICE_*` 已填（test mode 真实 ID）
  - ✅ `STRIPE_SECRET_KEY=sk_test_...` 已填
  - ✅ `STRIPE_WEBHOOK_SECRET=whsec_...` 已填（来自 `stripe listen` 输出）

- **本地 webhook 联调**：`stripe listen --forward-to localhost:3001/webhooks/stripe` 在用户终端常驻；`stripe trigger checkout.session.completed` 等命令可手动触发 fixtures 给后端发事件。后端 dev 服务器需要同时跑（`cd backend && npm run dev`）。

- **task 4-5 已完成的范围**：
  - `POST /webhooks/stripe`（`backend/src/routes/stripe-webhook.ts`）：encapsulated raw-body parser、Stripe-Signature 校验、`webhook_events` 表 dedup（PK = event.id）、三个 handler（`checkout.session.completed` 写 stripe_customer_id + 加 paid_credits_balance；`customer.subscription.updated` 同步 status/type/expires_at — **注意 Stripe API 2025+ 把 `current_period_end` 移到了 subscription item 级别**；`customer.subscription.deleted` set canceled）
  - 6 个 webhook 单元测试 + migration `backend/supabase/migrations/20260424_webhook_events.sql`（用户已手跑）
  - **task 5 `stripe_customer_id` writeback**：双重保障 —— webhook handler 在 checkout.session.completed 时 writeback / checkout 路由在 customer 创建时 writeback。任一失败另一边兜底。

- **task 6 Block 2 已完成的范围**（2026-04-25）：
  - **后端 `POST /checkout`**（`backend/src/routes/checkout.ts`）：requireAuth、入参 `{ product: 'weekly'|'monthly'|'pack_30'|'pack_100' }`、按 product 选 mode (`subscription` / `payment`) 和 priceId、若 profile 没 stripe_customer_id 则 `stripe.customers.create({ email, metadata: { user_id } }, { idempotencyKey: 'customer-create-${user_id}' })` 写回 profile、`metadata.user_id` + `metadata.product` 注入 session、subscription mode 同时塞 `subscription_data.metadata.user_id`、success/cancel 跳 snapcue-web stub 页
  - 6 个 checkout 单元测试（401 缺 auth / 400 invalid product / 400 缺 product / pack happy / 订阅 happy + 创 customer / customer 创建失败 500）
  - `env.ts` 收紧 4 个 `STRIPE_PRICE_*` 为 required（路由真用了，必须 fail-fast）
  - **snapcue-web** 加 `/checkout-success`（绿 ✓ + "Open SnapCue" + `snapcue://checkout-success` deep link）和 `/checkout-cancel`（灰 × + 同上 + 回 /pricing 链接）两个 stub 页，build 通过

- **下次 session 第一步**（task 6 Block 3+ — Electron 端）：
  1. **Electron pricing window**（仿 signin window 模式）：`electron/pricing.ts` 新建 BrowserWindow（约 440×400），renderer 复用 React 通过 hash route `#pricing` 区分。展示 4 个产品卡片（weekly/monthly/pack_30/pack_100），点击 → 调后端 `POST /checkout` → `shell.openExternal(session.url)` → 关闭 pricing window
  2. **新 IPC channels**：`auth:openCheckout` (renderer→main, invoke, args: `{ product }`, return: `void` — main 端调后端拿 URL 再 openExternal) / `auth:closePricing` (renderer→main, send) / 也可直接复用 openCheckout 走单一路径
  3. **替换现有 `auth:openPricing` 调用**：App.tsx no_credits paywall + settings-view ManageLink 改成开 pricing window 而非 `openExternal('/pricing')`
  4. **后端 `POST /billing-portal`**（小，建议 Block 3 顺手做）：requireAuth、查 profile.stripe_customer_id、`stripe.billingPortal.sessions.create({ customer, return_url })`、ManageLink 走这个路由让用户管理已有订阅
  5. **Credits 刷新**：dropdown hidden → visible 时触发 `credits:refresh`（一次 `/me`），同时 main 端注册 `snapcue://checkout-success` deep link handler 也推一次 refresh
  6. **端到端联调**：Electron 点 Upgrade → pricing window 选产品 → openExternal Stripe Checkout → 用 `4242 4242 4242 4242` 测试卡付款 → success 页面 → 重开 dropdown 看 credits 更新

- **已知技术债账本**：
  - 打包版自测（`npm run pack` → .dmg 安装 → 端到端 sanity check）在 6.2 未做，建议 6.3 中后期补
  - 上 live mode 之前要把 `.env` 的 test 值替换为 live 值（Stripe / Supabase 都是同一规则：测试和生产的 keys 完全不同）。注意 webhook endpoint 也要在 Stripe Dashboard live mode 单独配（test mode 的 endpoint 仅对 test 流量生效）。
  - Stripe webhook idempotency 选用 "insert webhook_events 行 → 跑 handler" 模型；handler 抛异常后行已落库，dashboard "Resend webhook" 会被 dedup 短路。恢复手段：手动删 webhook_events 行 + dashboard 重发。详见 stripe-webhook.ts 顶部注释。
  - `STRIPE_PRICE_*` 4 个变量目前 optional，task 6 用到时收紧成 required。

## 当前开发进度

### ✅ 已完成

**阶段 1 — 项目脚手架**

- electron-vite + React + TypeScript + Tailwind 项目初始化

**阶段 2 — Electron 核心功能**

- Tray icon + dropdown BrowserWindow（200px，frameless，dark blur 背景）
- 全局快捷键 + 截图捕获（⌃⌥S 静默 / ⌃⌥A 区域选择 + sharp 缩放）
- macOS 屏幕录制权限检测（systemPreferences API）和引导页面
- IPC 通信桥梁（shared/types.ts，window.snapcue API）
- Dropdown footer（齿轮设置，Quit 移到设置页）
- 纯 menu bar app（无主窗口，app.dock.hide()）

**阶段 3 — 后端 API（基础版）+ 端到端联调**

- Fastify 后端脚手架（backend/，独立 package.json）
- POST /analyze 路由（截图 → GPT-5 mini → JSON 答案数组）
- GET /health 健康检查
- Electron main process 对接后端（net.fetch → localhost:3001/analyze → IPC）
- AnswerPanel 简洁化重构（收起/展开 accordion，置信度彩色圆点，150ms 动画）
- 隐蔽模式（截图+分析全程静默，dropdown 永不自动弹出，仅 tray icon 查看）
- Dropdown resize 防抖（阈值 + debounce + main 侧过滤，防止闪烁循环）
- 截图 → 分析 → 显示答案的完整流程已跑通

**阶段 4 — UI/UX 打磨**

- 4.1 ✅ 错误状态（CaptureError 类型分类 + 重试按钮 + 缓存截图复用）
- 4.2 ✅ Settings 页面（快捷键录入+冲突检测+保存确认反馈，tray icon 四选一，JSON 文件持久化，Quit 移入设置页）
- 4.3 ✅ 视觉重构（200px 窄 dropdown，macOS vibrancy 风格，紧凑排版）
- 4.4 ✅ UI 状态完善（idle 空闲态快捷键提示、analyzing 脉冲动画+超时提示、空答案提示、隐藏滚动条、页面切换 fade 动画、settings 页隐藏公共 footer）
- 4.5 ✅ Tray icon 状态反馈（analyzing 降低 opacity、done 恢复正常、3 秒 timer）
- 4.6 ✅ Onboarding 3 页引导（Welcome → Shortcuts → Permission，支持回退，hasOnboarded 持久化）
- 4.7 ✅ Dropdown resize 白色闪烁修复（html/body 背景色匹配 + debounce 降至 30ms）
- 4.8 ✅ 交互细节修复（footer 齿轮 hover、back 按钮 hover、快捷键冲突文字提示、e.code 修复 macOS Alt 字符问题）

**阶段 4.9 — 体验优化**

- 4.9.1 ✅ 首次使用引导（hasFirstCapture 设置 + idle-view 条件渲染，首次截图成功前显示 "ready to go" 提示）
- 4.9.2 ✅ no_questions 错误不显示 Retry（同一张图重试浪费 token，改为提示用 ⌃⌥A）
- 4.9.3 ✅ ⌃⌥D toggle dropdown 快捷键（直接 show/hide dropdown BrowserWindow，不操作 tray，Settings 可自定义，三键冲突检测）
- 4.9.4 ✅ 主面板 footer 增加 Quit 按钮（齿轮右侧）
- 4.9.5 ✅ System prompt 优化（"most likely answers"、reason 1-2 句、支持非选择题返回 "—"）
- 4.9.6 ✅ Idle view key cap 重设计（主快捷键用键盘按键视觉风格展示，次要快捷键简化文字）
- 4.9.7 ✅ Tray icon 扩展至 8 种（新增 input/shield/cn/ghost）

**阶段 5 — 后端功能完善**

- 5.1 ✅ System prompt 扩展为支持全部题型（单选、多选、判断、填空、简答、计算、排序），简答题去 AI 味指令（禁止套话 "Furthermore/In conclusion" 等、学生语气、长度自适应 2-4 句、不重复问题），reason 1 句上限，计算题 reason 用公式紧凑记法
- 5.2 ❌ 模型抽象层 — 跳过（YAGNI，当前只用一个模型）
- 5.3 ❌ 流式响应 — 跳过（分析耗时短，投入产出比低）
- 5.4 ❌ 历史记录 — 砍掉（核心场景不需要）

**阶段 5.5 — 部署后端 + 打包 beta（已完成）**

- 5.5.1 ✅ 后端部署到 Railway（snapcue-production.up.railway.app），端口自动分配（PORT 环境变量）
- 5.5.2 ✅ Electron 指向远程后端（.env.development / .env.production，Vite envPrefix 注入 import.meta.env）
- 5.5.3 ✅ electron-builder 打包 .dmg（arm64，未签名未公证，sharp asarUnpack 处理）
- 5.5.4 ✅ API key 防滥用（x-api-key header，后端 onRequest hook，GET /health 跳过验证）

**阶段 5.6 — Answer Panel 重构 + 品牌打磨**

- 5.6.1 ✅ Answer Panel 自适应答案长度（CSS truncation 检测，长答案展开全文+reason 分隔显示，copy 按钮+checkmark 反馈）
- 5.6.2 ✅ Onboarding 布局重构（按钮+dots 提取到共享底部区域，三页位置一致，Welcome 页加 logo）
- 5.6.3 ✅ App icon 制作（build/icon.png → sharp trim+resize → sips iconset → iconutil .icns）
- 5.6.4 ✅ Tray icon 品牌化（ghost 默认 icon 使用 logo 原图生成 PNG template image，替代手绘 SVG）
- 5.6.5 ✅ Settings icon 预览更新（ghost 选项使用 logo-white.png，排序第一位）
- 5.6.6 ✅ Onboarding timer 内存泄漏修复（ShortcutsPage 每个 cycle 清理上一批 timers）

### ⬜ 下一步开发计划

> 开发原则：先把核心体验打磨到位，再接入付费系统。

**阶段 6 — 认证 + 付费系统**

- 6.1 ✅ 用户认证（Supabase Magic Link）
  - 实现：Electron auth.ts + 官网 /auth/callback + snapcue:// deep link
  - 打包 app 通过 lsregister 正确注册协议（com.snapcue.app）
  - Session 持久化到 userData/auth.json
  - Onboarding 第 4 页 + Settings ACCOUNT 区块
  - 非强制登录，未登录用户仍可使用

- 6.2 ✅ 使用额度管理（免费 5 次 + 订阅无限 + credit 扣减）
  - Task 2 (597fdef) — 后端 requireAuth + credit gating + GET /me
  - Task 3 (fc8ebf7) — Electron JWT header + credits meta 消费 + ErrorType 扩展（auth_required / no_credits / daily_limit）
  - 契约补丁 (f71bb48) — 402 / 429 响应 body 必须带 CreditsMeta
  - Task 4a (e10c82e) — footer credits 显示 + 三种 paywall ErrorPanel
  - Task 4b (49b9dc9) — 独立 signin 窗口（440×420）+ SignInForm 抽象 + 15s Resend cooldown
  - Task 4c (本次) — Settings ACCOUNT 补 plan/credits/Manage + idle 文案登录态分支 + 文档同步
- 6.3 ⬜ Stripe 支付 — **起手 checklist**
  1. ✅ **定价正式拍板**（2026-04-24，详见 `## 定价方案`）—— 免费 5 credits + 周卡 $5.99 + 月卡 $12.99 + 30/$4.99 + 100/$9.99，订阅 50/day cap
  2. ✅ **Stripe 账号准备**（2026-04-24）— test mode keys 拿到（用户密码管理器）；secret key 占位符已写入 `backend/.env`
  3. ✅ **Stripe Products / Prices 创建**（2026-04-24）— 4 个 Product 已建在 test mode，price IDs 写入 `backend/.env`：`STRIPE_PRICE_WEEKLY` / `MONTHLY` / `PACK_30` / `PACK_100`。zod schema 在 `lib/env.ts` 添加 optional 校验（含 `price_` / `sk_test|live_` 前缀检测），routes 接入时再收紧成 required
  4. ✅ **Webhook endpoint**（2026-04-25）— `POST /webhooks/stripe` 全套：encapsulated raw body parser、`Stripe-Signature` 校验、`webhook_events` 表 dedup（PK = event.id，"insert-first" idempotency 模型）、三个 handler 真业务逻辑（`checkout.session.completed` 写 stripe_customer_id + credit pack 加 paid_credits_balance；`customer.subscription.updated` 同步 status/type/expires_at；`customer.subscription.deleted` set canceled）。6 个单元测试 + env.ts 收紧 STRIPE_SECRET_KEY/WEBHOOK_SECRET 为 required。本地联调用 Stripe CLI（`stripe listen --forward-to localhost:3001/webhooks/stripe`）。
  5. ✅ **profiles.stripe_customer_id 写回**（2026-04-25）— webhook 那半（checkout.session.completed handler）+ checkout 路由那半（customers.create + idempotency key + writeback）双重保障，任一失败另一边兜底。
  6. 🟡 **Checkout flow** — Block 2 已完成（2026-04-25）：后端 `POST /checkout`（requireAuth + 4 product → priceId/mode + Stripe customer 创建 + writeback + idempotency key + subscription_data.metadata.user_id 注入）+ 6 单元测试 + 4 个 STRIPE_PRICE_* 收紧成 required + snapcue-web 新增 `/checkout-success` 和 `/checkout-cancel` stub 页（含 `snapcue://checkout-*` deep link）。剩下：Electron pricing window + IPC + paywall 替换（详见 ## Session 续接指引）。
  7. ⬜ **设计并实现 credits 刷新机制** — 最轻方案：dropdown 从 hidden → visible 时调 `credits:refresh`（webhook 已落库，前端只需重新拉一次 `/me`）。和 task 6 剩余 block 一起做。
- 6.4 ⬜ 产品官网（独立项目 snapcue-web/，Next.js + Tailwind，landing page + pricing + download）

**阶段 7 — 打包发布**

- 7.1 代码签名 + Apple 公证
- 7.2 最终检查（lint、test、README、.env.example、.gitignore）

## 定价方案

2026-04-24 拍板（Phase 6.3 task 1 完成）。

- **免费**：注册一次性 5 credits（不重置，不续；用完必须付费）
- **周卡** $5.99 / 7 天，up to 50 captures/day
- **月卡** $12.99 / 30 天，up to 50 captures/day
- **Credit 包**：
  - 30 credits / $4.99（单价 $0.166，"小额不承诺"档）
  - 100 credits / $9.99（单价 $0.100，对 30 包 -40%，对月卡 -23%，"我用得多但不想订阅"档）
- **1 credit = 1 次截图分析**（不管图中几道题，绝不按题数计费）
- **订阅每日 50 次上限**（防滥用，UI 文案明示 "up to 50/day"，不写 unlimited 避免误导）

定价心理学要点（决策依据）：
- 100 包定 $9.99 而非 $12.99 — 后者和月卡同价会让用户决策瘫痪 / 100 包卖不动
- 删 300 包 — SKU 简化，决策树更清
- 月卡 $12.99 上线后看转化率，必要时降到 $9.99（破 $10 学生心理线）
- 5 free 偏紧（vs 10 free 选项）— 用户拍板选 5，trade-off 是更早的转化压力 vs 更高的初期流失风险，看真实数据再调

## 项目结构

```
snapcue/
├── electron/              # Electron main process
│   ├── main.ts            # App 生命周期 + hotkeys + onboarding 窗口启动
│   ├── tray.ts            # Tray icon + dropdown window + tray 状态管理 + toggleDropdown
│   ├── tray-icons.ts      # SVG→sharp→nativeImage 生成 tray 图标 + ghost 使用 logo PNG template image
│   ├── screenshot.ts      # 截图捕获 + sharp 缩放 + 权限检测
│   ├── ipc.ts             # 所有 IPC handler 注册 + 快捷键管理 + 截图→分析流程
│   ├── config.ts          # API baseUrl + apiKey 配置（import.meta.env，按 mode 加载）
│   ├── env.d.ts           # import.meta.env 类型声明（SNAPCUE_API_URL/KEY）
│   ├── preload.ts         # contextBridge → window.snapcue
│   ├── store.ts           # JSON 文件设置持久化（app.getPath('userData')）
│   ├── signin.ts          # 独立 Sign-in BrowserWindow（440×420，paywall 触发）
│   └── onboarding.ts      # Onboarding BrowserWindow 创建/关闭
├── shared/                # 前后端共享类型
│   └── types.ts           # IPC channel 定义、AnswerItem、AppSettings、DEFAULT_SETTINGS
├── src/                   # React renderer（dropdown UI + onboarding）
│   ├── main.tsx           # 入口：hash 路由分发 dropdown vs onboarding
│   ├── App.tsx            # Dropdown 主组件（状态机 + ErrorPanel）
│   ├── answer-panel.tsx   # 答案面板（自适应长度、truncation 检测、展开全文、copy 按钮）
│   ├── assets/
│   │   └── logo-white.png # 白色透明底 logo（512px，onboarding + settings 预览用）
│   ├── env.d.ts           # SnapCueAPI + Window.snapcue 类型
│   ├── use-auto-height.ts # 自动高度 + 防抖（30ms）
│   ├── index.css          # 全局样式（动画 keyframes、滚动条隐藏）
│   └── components/
│       ├── footer-bar.tsx       # 主面板底栏（齿轮 icon + Quit 按钮）
│       ├── idle-view.tsx        # 空闲态（首次使用引导 / 装饰圆点 + 快捷键提示）
│       ├── loading-view.tsx     # 加载态（脉冲圆点 + 8s 超时提示）
│       ├── permission-guide.tsx # 权限引导（dropdown 内，英文）
│       ├── settings-view.tsx    # 设置页（快捷键录入+冲突检测+保存确认 + icon 选择 + ACCOUNT plan/credits/Manage + Quit）
│       ├── signin-form.tsx      # 可复用 Magic Link 表单（邮箱输入 + 15s Resend cooldown）
│       ├── signin-view.tsx      # 独立 sign-in 窗口入口（hash #signin，承载 SignInForm）
│       └── onboarding-view.tsx  # Onboarding 4 页（Welcome → Shortcuts → Permission → SignIn）
├── backend/               # SnapCue API 服务端
│   ├── src/
│   │   ├── server.ts      # Fastify 入口（bodyLimit 10MB），第一行 import env.ts fail-fast
│   │   ├── lib/
│   │   │   ├── env.ts     # zod env schema — 启动校验所有后端环境变量，含 anon-key 误用检测
│   │   │   ├── supabase.ts # supabaseAdmin client（service_role，绕 RLS）
│   │   │   └── credits.ts # reserve_credit / refund_credit / getCreditsMeta RPC 封装
│   │   ├── middleware/
│   │   │   └── auth.ts    # requireAuth preHandler — 验 JWT + 注入 request.user
│   │   └── routes/
│   │       ├── analyze.ts        # POST /analyze（credit gate + GPT-5 mini + 失败自动 refund）
│   │       ├── checkout.ts       # POST /checkout（requireAuth + product → priceId/mode + Stripe customer + session url）
│   │       ├── me.ts             # GET /me（user + CreditsMeta，dropdown 打开时拉一次）
│   │       ├── stripe-webhook.ts # POST /webhooks/stripe（raw body + sig 校验 + dedup + 三个 handler）
│   │       └── health.ts         # GET /health
│   └── supabase/
│       └── migrations/
│           ├── 20260423_credits.sql        # profiles + usage_logs + reserve/refund_credit RPC + 新用户 trigger
│           └── 20260424_webhook_events.sql # webhook_events 表 — Stripe event.id 做 idempotency dedup
├── build/                 # App icon
│   ├── icon.png           # 1024×1024 源图（ghost logo + 白底）
│   └── icon.icns          # macOS icon（由 icon.png 生成）
├── resources/             # Tray icon 资源
│   ├── trayIconGhost*.png # Ghost tray icon（logo 原图生成，22px + 44px@2x）
│   └── iconTemplate*.png  # 默认 tray icon template
├── .env.development       # 开发环境变量（localhost:3001，gitignored）
├── .env.production        # 生产环境变量（Railway URL + API key，gitignored）
├── package.json
└── CLAUDE.md              # ← 本文件
```

### 相关项目

- snapcue-web/（独立仓库）— 产品官网，Next.js + Tailwind，部署在 Vercel
