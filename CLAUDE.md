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

## PR 2 第一次尝试（回退）

第一次尝试实现 credit system，在配置环节遇到多处阻塞：

- backend/.env 变量命名不一致（SNAPCUE\_ 前缀 vs 无前缀）
- backend/.env 缺 Supabase 凭证
- dev 模式下 API key 配置不对称
- Supabase JWT 验证卡住（未完全定位）

最终回退所有代码，计划在新 session 重新设计实现路径：

- 更明确的 env 变量命名约定
- 环境变量 schema 在代码里用 zod 校验
- dev 模式和 prod 模式的配置差异明确文档化

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
- 6.3 ⬜ Stripe 支付（周卡 $5.99 / 月卡 $12.99 / credit 包三档）
- 6.4 ⬜ 产品官网（独立项目 snapcue-web/，Next.js + Tailwind，landing page + pricing + download）

**阶段 7 — 打包发布**

- 7.1 代码签名 + Apple 公证
- 7.2 最终检查（lint、test、README、.env.example、.gitignore）

## 定价方案

- 免费：新用户 5 次分析
- 周卡 $5.99 — 7 天无限使用
- 月卡 $12.99 — 30 天无限使用
- Credit 包：30 credits $4.99 / 100 credits $12.99 / 300 credits $29.99
- 1 credit = 1 次截图分析（不管图中几道题）
- 订阅用户每日上限 50 次分析（防滥用）

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
│   └── src/
│       ├── server.ts      # Fastify app 入口（bodyLimit 10MB）
│       └── routes/
│           ├── analyze.ts # POST /analyze（GPT-5 mini，7 种题型，max_completion_tokens 4096）
│           └── health.ts  # GET /health
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
