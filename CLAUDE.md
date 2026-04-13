# SnapCue

macOS menu bar AI study assistant — 截图 → AI 分析 → 显示答案。
纯 menu bar 应用，无主窗口，无 Dock 图标。

## 产品简介

用户按快捷键截图（⌃⌥S 静默截前台窗口，⌃⌥A 区域选择），截图自动发送到后端，后端代理调用 Anthropic Claude API 分析选择题，返回答案+置信度+一句话解释，显示在 menu bar 的 dropdown panel 里。

核心价值：把传统的 "截图→切到AI聊天→上传→等待→阅读→切回" 的 7 步流程缩减到 2 步。

## Architecture

三层架构：Electron 桌面端 → Node.js 后端 API → Anthropic Claude API

- **Electron main process**: 截图捕获、全局快捷键、tray icon 管理、向后端发 API 请求（所有网络调用都在 main process）
- **Electron renderer**: React UI，仅负责 dropdown panel 展示（不发网络请求）
- **IPC 边界**: main process 通过 IPC push 结果给 renderer，renderer 通过 IPC invoke/send 请求 main process 执行操作
- **Backend (Fastify)**: JWT 认证（Supabase）、credit 管理、Claude API 代理（streaming）
- **External**: Anthropic Claude API, Supabase (auth + DB), Stripe (支付)

## Tech Stack

- Electron 30+, React 18+, TypeScript strict, Vite + electron-vite
- Tailwind CSS (renderer)
- sharp (npm) — 图片缩放到 max 1200px 长边
- Fastify — 后端 API
- @anthropic-ai/sdk — Claude API (streaming)
- Supabase — Auth + PostgreSQL
- Stripe — 支付

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
- API 超时 12 秒，启用 streaming
- Credit 按检测到的题目数阶梯计费：1-3题=1credit, 4-6题=2, 7-9题=3, 10+=4
- 快捷键默认 ⌃⌥S（静默）/ ⌃⌥A（区域），用户可自定义
- Dropdown 无自动消失计时器，用户主动 dismiss（click outside / Esc / 切换 app）
- JWT refresh token rotation
- app.dock.hide() — 纯 menu bar app
- IPC 类型定义在 shared/types.ts，main 和 renderer 共享
- window.snapcue 作为 preload 暴露的 API 命名空间

## IPC Channel 清单

| Channel | 方向 | 类型 | 用途 |
|---------|------|------|------|
| capture:start | renderer → main | invoke | 请求截图 |
| capture:loading | main → renderer | push | 正在分析 |
| capture:result | main → renderer | push | 分析结果 |
| capture:error | main → renderer | push | 错误信息 |
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
- electron-vite + React + TypeScript + Tailwind 项目初始化完成

**阶段 2 — Electron 核心功能**
- 2.1 Tray icon + dropdown BrowserWindow（280px，frameless，dark blur 背景）
- 2.2 全局快捷键 + 截图捕获（⌃⌥S 静默 / ⌃⌥A 区域选择 + sharp 缩放）
- 2.3 macOS 屏幕录制权限检测和引导页面
- 2.4 IPC 通信桥梁（shared/types.ts 类型定义，window.snapcue API）
- Dropdown footer bar（credits 显示 + 齿轮设置 + 退出按钮）
- 状态流：idle → loading（"Analyzing..."）→ 等待后端响应
- 纯 menu bar app（无主窗口，app.dock.hide()）

### ⬜ 下一步 — 阶段 3：后端 API（当前任务）

**任务 3.1 — 后端脚手架 + AI 分析路由（最高优先级）**
在项目根目录创建 backend/ 子项目：
- Fastify + TypeScript，独立 package.json
- POST /analyze：接收 base64 图片 → 调用 Claude API (claude-sonnet-4-20250514) → 返回 JSON 答案数组
- System prompt: "You are a study assistant. Given a screenshot of quiz questions, identify all multiple choice questions and return a JSON array. Each item: {\"q\": <number>, \"answer\": \"<letter A-G or T/F>\", \"confidence\": \"high|mid|low\", \"reason\": \"<one sentence explanation>\"}. Return ONLY valid JSON. If no questions found, return []."
- max_tokens: 800, timeout: 12s
- GET /health 健康检查
- CORS 允许 localhost，端口 3001
- 环境变量 ANTHROPIC_API_KEY 从 .env 加载
- 然后修改 electron/api.ts 让截图 POST 到 http://localhost:3001/analyze
- 结果通过 IPC capture:result 发给 renderer 显示

**任务 3.2 — Credits 管理 + Stripe（3.1 之后）**

**任务 3.3 — 认证系统（3.2 之后）**

### ⬜ 后续阶段
- 阶段 4：Renderer UI（AnswerPanel 完善、Error 状态、Settings 页面）
- 阶段 5：集成串联（登录流程、完整端到端）
- 阶段 6：打磨打包（electron-builder .dmg）

## 项目结构

```
snapcue/
├── electron/          # Electron main process
│   ├── main.ts        # App 生命周期 + hotkeys
│   ├── tray.ts        # Tray icon + dropdown window
│   ├── screenshot.ts  # 截图捕获 + sharp 缩放
│   ├── ipc.ts         # 所有 IPC handler 注册
│   ├── preload.ts     # contextBridge → window.snapcue
│   └── store.ts       # 本地设置 + token 存储
├── shared/            # 前后端共享类型
│   └── types.ts       # IPC channel 定义、AppSettings 等
├── src/               # React renderer（dropdown UI）
│   ├── App.tsx
│   ├── env.d.ts       # SnapCueAPI + Window.snapcue 类型
│   ├── use-auto-height.ts
│   └── components/
│       ├── permission-guide.tsx
│       └── ...
├── backend/           # ⬜ 待创建 — SnapCue API 服务端
├── package.json
└── CLAUDE.md          # 本文件
```
