# SnapCue

macOS menu bar AI study assistant — 截图 → AI 分析 → 显示答案。
纯 menu bar app，无主窗口，无 Dock 图标。

## 产品简介

用户按快捷键截图（⌃⌥S 静默截前台窗口，⌃⌥A 区域选择），截图自动发送到后端，后端代理调用 AI API 分析选择题，返回答案+置信度+一句话解释，显示在 menu bar 的 dropdown panel 里。

核心价值：把传统的 "截图→切到AI聊天→上传→等待→阅读→切回" 的 7 步流程缩减到 2 步。

## Architecture

三层架构：Electron 桌面端 → Node.js 后端 API → AI API（当前 GPT-5 mini，未来可切换 Gemini Flash / Claude）

- **Electron main process**: 截图捕获、全局快捷键、tray icon 管理、向后端发 API 请求（所有网络调用都在 main process）
- **Electron renderer**: React UI，仅负责 dropdown panel 展示（不发网络请求）
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

## Code Style

- Strict TypeScript（no `any`）
- Functional React + hooks only
- Named exports（除 React 页面组件外不用 default export）
- 文件名 kebab-case，组件 PascalCase
- IPC channel 命名：`模块:动作`（如 capture:start, settings:get）

## Key Decisions

- 截图发送前 downscale 到 max 1200px 长边（省 token + 降延迟）
- API 超时 30 秒（GPT-5 mini 有推理过程，需要更多时间）
- 隐蔽模式：截图+分析全程静默，dropdown 永不自动弹出，仅点击 tray icon 主动查看结果
- 截图失败/用户取消区域选择时静默忽略，不弹出任何 UI
- 快捷键默认 ⌃⌥S（静默）/ ⌃⌥A（区域），用户可在 Settings 页自定义，持久化到 JSON 文件
- Dropdown 用户主动 dismiss（click outside / Esc / 切换 app）
- 设置持久化用 app.getPath('userData')/settings.json，无额外 npm 依赖
- Tray icon 支持 4 种样式（dot/book/bolt/square），通过 SVG→sharp→nativeImage 动态生成
- app.dock.hide() — 纯 menu bar app
- IPC 类型定义在 shared/types.ts，main 和 renderer 共享
- window.snapcue 作为 preload 暴露的 API 命名空间
- ⌃⌥S 静默截图已知限制：截取的是前台窗口，可能截到非题目窗口（如 Terminal），尝试过截鼠标所在窗口和截鼠标所在显示器方案均不稳定，已回退到基础方案。⌃⌥A 区域选择是更可靠的截图方式
- setContentProtection(true) 可用于屏幕共享隐藏，但 macOS 15 ScreenCaptureKit 和 Zoom 原生客户端可能绕过，未来如需更深层隐藏需用 Swift/Metal 原生渲染
- ⌃⌥D toggle panel 功能已尝试并回滚，tray destroy/recreate 存在重复创建 bug，暂不实现

## UI/UX 设计规范

追求原生 macOS vibrancy menu 的质感，紧凑、隐蔽、小字。

### Dropdown 整体

- 宽度 200px，高度动态自适应，max-height 400px
- 背景 `rgba(30,30,30,0.92)` + `backdrop-filter: blur(20px)`
- 圆角 8px，边框 `rgba(255,255,255,0.06)`
- 隐藏滚动条（`::-webkit-scrollbar { display: none }`），内容仍可滚动
- use-auto-height 防抖（阈值 > 2px + debounce 100ms）防止 resize 循环闪烁
- 页面切换（main ↔ settings）fade 过渡动画 150ms ease

### Idle 空闲态

- 三个装饰圆点（5px，`rgba(255,255,255,0.15)`，横排 gap 6px）
- 下方两行快捷键提示（从 settings:get 动态读取），11px monospace，`rgba(255,255,255,0.25)`
- 居中布局，padding `20px 14px`

### Analyzing 加载态

- 三个白色圆点脉冲动画（依次延迟 0.2s，opacity 0.15↔0.6，周期 1.4s）
- 下方 "analyzing" 文字，11px，`rgba(255,255,255,0.3)`
- 居中布局，padding `24px 14px`

### AnswerPanel 行样式

收起状态每行三个元素：题号 + 答案字母 + 置信度圆点

```
1  A                        ●
2  C                        ●
3  B                        ●
```

- 题号：纯数字（无 "Q" 前缀），11px monospace，`rgba(255,255,255,0.35)`，22px 宽
- 答案字母：14px font-weight 600 monospace，`rgba(255,255,255,0.95)`，letter-spacing 0.5px，22px 宽
- 置信度圆点：5px 直径，opacity 0.8，绿(high)/黄(mid)/红(low)，flex 靠右
- 行布局：padding `5px 10px`，hover `rgba(255,255,255,0.05)` + border-radius 5px
- 容器 padding：`6px 4px`

展开状态：点击某行展开 reason，同一时间只展开一行

- 展开 reason：11px，`rgba(255,255,255,0.35)`，padding-left 34px 对齐答案字母
- 展开收起动画：150ms ease

### 错误状态

- 11px 文字，`rgba(255,255,255,0.35)`，padding `8px 10px`
- 错误类型：network_error / timeout / no_questions / parse_error / unknown
- Retry 按钮：全宽，`rgba(255,255,255,0.06)` 背景，11px，border-radius 4px
- 复用缓存截图重试，无需重新截图

### Dropdown Footer（主面板）

```
10                          ⚙
```

- 左侧 credits 数字（无 "credits" 文字，无绿点），11px，`rgba(255,255,255,0.25)`
- 右侧齿轮 SVG stroke icon，13px，`rgba(255,255,255,0.25)`
- 无 ✕ 关闭按钮（Quit 移到设置页）
- padding `5px 10px`，顶部边线 `0.5px solid rgba(255,255,255,0.06)`
- Settings 页面时隐藏此 footer（settings 有自己的底栏）

### Settings 页面（dropdown 内 inline 切换）

点击齿轮 → view 切换到 settings，fade 过渡。

**返回按钮**：`← back`，SVG chevron 11px + 文字 11px `rgba(255,255,255,0.4)`，padding `8px 10px 4px`

**SHORTCUTS 区块**：
- section 标题 "SHORTCUTS"，11px uppercase，letter-spacing 0.5px，`rgba(255,255,255,0.3)`
- 两行 flex space-between：左侧 label 12px `rgba(255,255,255,0.6)`，右侧快捷键 pill（`rgba(255,255,255,0.06)` 背景，padding `2px 8px`，border-radius 4px，11px monospace `rgba(255,255,255,0.4)`）
- 录入模式：点击 pill → "press keys..." 闪烁（CSS blink animation），按下组合键保存
- 冲突检测：与另一个快捷键相同时 pill 背景闪红 600ms，不保存
- Esc 取消录入

**ICON 区块**：
- section 标题 "ICON"，同上样式
- 4 个预设横排（dot 圆点 / book 书本 / bolt 闪电 / square 方块），每个 36×30px，border-radius 5px
- 选中项 `rgba(255,255,255,0.08)` 背景，点击切换并通过 IPC 更新 tray icon

**底部 footer**：
- 左侧 "v0.1.0"，11px，`rgba(255,255,255,0.25)`
- 右侧 "Quit" 文字按钮，11px，`rgba(255,255,255,0.2)` → hover `rgba(255,255,255,0.5)`
- 顶部边线 `0.5px solid rgba(255,255,255,0.06)`，padding `5px 10px`

## IPC Channel 清单

| Channel | 方向 | 类型 | 用途 |
|---------|------|------|------|
| capture:start | renderer → main | invoke | 请求截图 |
| capture:loading | main → renderer | push | 正在分析 |
| capture:result | main → renderer | push | 分析结果（AnswerItem[]） |
| capture:error | main → renderer | push | 错误信息（CaptureError: type + message + canRetry） |
| capture:retry | renderer → main | invoke | 用缓存截图重试分析 |
| credits:update | main → renderer | push | 余额更新 |
| settings:get | renderer → main | invoke | 读取设置 |
| settings:set | renderer → main | invoke | 写入设置 |
| permission:status | main → renderer | push | 权限状态 |
| permission:openSettings | renderer → main | invoke | 打开系统设置 |
| permission:recheck | renderer → main | invoke | 重新检测权限 |
| dropdown:hide | renderer → main | send | 关闭 dropdown |
| dropdown:resize | renderer → main | send | 上报内容高度 |

## 当前开发进度

### ✅ 已完成

**阶段 1 — 项目脚手架**
- electron-vite + React + TypeScript + Tailwind 项目初始化

**阶段 2 — Electron 核心功能**
- Tray icon + dropdown BrowserWindow（200px，frameless，dark blur 背景）
- 全局快捷键 + 截图捕获（⌃⌥S 静默 / ⌃⌥A 区域选择 + sharp 缩放）
- macOS 屏幕录制权限检测和引导页面
- IPC 通信桥梁（shared/types.ts，window.snapcue API）
- Dropdown footer（credits 数字 + 齿轮设置，Quit 移到设置页）
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
- 4.2 ✅ Settings 页面（快捷键录入+冲突检测，tray icon 四选一，JSON 文件持久化，Quit 移入设置页）
- 4.3 ✅ 视觉重构（200px 窄 dropdown，macOS vibrancy 风格，紧凑排版）
- 4.4 ✅ UI 状态完善（idle 空闲态快捷键提示、analyzing 脉冲动画、隐藏滚动条、页面切换 fade 动画、settings 页隐藏公共 footer）

**阶段 5 — 后端功能完善（部分完成）**
- 5.1 ✅ System prompt 优化（角色定义、JSON 输出格式、多语言 reason、忽略浏览器 UI 元素）
- 5.2 ❌ 模型抽象层 — 跳过（YAGNI，当前只用一个模型）
- 5.3 ❌ 流式响应 — 跳过（分析耗时短，投入产出比低）
- 5.4 ❌ 历史记录 — 砍掉（核心场景不需要）

### ⬜ 下一步开发计划

> 开发原则：先把核心体验打磨到位，再接入付费系统。

**阶段 6 — 认证 + 付费系统**

- 6.1 用户认证（Supabase Auth，JWT + refresh token rotation，Electron safeStorage）
- 6.2 Credit 管理（扣减逻辑：1-3题=1credit, 4-6题=2, 7-9题=3, 10+=4）
- 6.3 Stripe 支付（Checkout + Webhook，三档套餐，新用户送 10 free credits）

**阶段 7 — 打包发布**

- 7.1 electron-builder 打包 .dmg
- 7.2 代码签名 + Apple 公证
- 7.3 最终检查（lint、test、README、.env.example、.gitignore）

## 项目结构

```
snapcue/
├── electron/              # Electron main process
│   ├── main.ts            # App 生命周期 + hotkeys
│   ├── tray.ts            # Tray icon + dropdown window
│   ├── screenshot.ts      # 截图捕获 + sharp 缩放
│   ├── ipc.ts             # 所有 IPC handler 注册 + 快捷键管理
│   ├── preload.ts         # contextBridge → window.snapcue
│   ├── store.ts           # JSON 文件设置持久化（app.getPath('userData')）
│   └── tray-icons.ts      # SVG→sharp→nativeImage 生成 4 种 tray 图标
├── shared/                # 前后端共享类型
│   └── types.ts           # IPC channel 定义、AnswerItem、AppSettings
├── src/                   # React renderer（dropdown UI）
│   ├── App.tsx
│   ├── answer-panel.tsx   # 答案面板（accordion 展开/收起）
│   ├── env.d.ts           # SnapCueAPI + Window.snapcue 类型
│   ├── use-auto-height.ts # 自动高度 + 防抖
│   └── components/
│       ├── footer-bar.tsx
│       ├── idle-view.tsx       # 空闲态（装饰圆点 + 快捷键提示）
│       ├── loading-view.tsx    # 加载态（脉冲圆点动画）
│       ├── permission-guide.tsx
│       └── settings-view.tsx   # 设置页（快捷键录入 + icon 选择 + Quit）
├── backend/               # SnapCue API 服务端
│   └── src/
│       ├── server.ts      # Fastify app 入口（bodyLimit 10MB）
│       └── routes/
│           ├── analyze.ts # POST /analyze（GPT-5 mini，max_completion_tokens 4096）
│           └── health.ts  # GET /health
├── package.json
└── CLAUDE.md              # ← 本文件
```
