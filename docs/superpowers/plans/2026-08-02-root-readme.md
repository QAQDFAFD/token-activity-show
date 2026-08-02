# Root Usage Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Chinese-first root README that explains how to install, run, validate, build, and package Token Activity Show while stating its current limitations and privacy guarantees accurately.

**Architecture:** This is a documentation-only change. The README derives every executable command and version requirement from `package.json` and summarizes the current source-adapter behavior without changing application code.

**Tech Stack:** Markdown, Node.js 22.23.1, pnpm 10.17.1, Electron 43.2, electron-vite 5.0, Vitest 4.1.

## Global Constraints

- Create only the root `README.md` during implementation.
- Write explanatory text in Simplified Chinese while preserving command names, paths, and error codes verbatim.
- Document macOS as the current target platform.
- Recommend Node.js 22.23.1 and require Node.js 22 or newer.
- Document only scripts that currently exist in `package.json`.
- State that real Claude Code, Codex, and Hermes formats are not established and currently report `FORMAT_NOT_ESTABLISHED`.
- Do not claim that unsupported source adapters currently produce activity statistics.
- State that conversation bodies are not collected and data remains local.

---

### Task 1: Add the root usage guide

**Files:**
- Create: `README.md`
- Reference: `package.json`
- Reference: `docs/superpowers/specs/2026-08-02-root-readme-design.md`

**Interfaces:**
- Consumes: the scripts and engine requirements declared in `package.json`
- Produces: a root-level developer and user entry point named `README.md`

- [ ] **Step 1: Confirm the documented commands**

Verify that `package.json` declares these commands and versions:

```text
Node.js: >=22
pnpm: 10.17.1
pnpm dev
pnpm build
pnpm test
pnpm test:unit
pnpm lint
pnpm typecheck
pnpm package:mac
```

Expected: every command is present; no undocumented script is added to the README.

- [ ] **Step 2: Write `README.md`**

Create a Chinese-first README with these exact sections:

```markdown
# Token Activity Show

Token Activity Show 是一款面向 macOS 的本地桌面应用，用于汇总 Claude Code、OpenAI Codex 和 Nous Research Hermes Agent 的原生会话活动。

> 当前项目仍处于开发阶段。真实会话格式尚未建立，三个来源目前会明确返回 `FORMAT_NOT_ESTABLISHED`，不会猜测数据格式或伪造统计结果。

## 功能与原则

- 本地发现和保存编码代理会话元数据
- 按来源隔离 Claude Code、Codex 和 Hermes 会话
- 不读取或保存对话正文
- 缺失指标显示为未知，而不是零
- 自动刷新仅在应用运行期间执行，默认间隔为 10 分钟
- Electron renderer 无法直接访问文件系统或 SQLite

## 环境要求

- macOS
- Node.js 22 或更高版本，推荐 `22.23.1`
- pnpm `10.17.1`

检查版本：

```bash
node --version
pnpm --version
```

## 安装

```bash
pnpm install
```

## 开发运行

```bash
pnpm dev
```

该命令会启动 Electron 开发环境并打开 Token Activity Show 窗口。关闭应用窗口即可结束本次运行。

## 测试与质量检查

```bash
pnpm test
pnpm test:unit
pnpm typecheck
pnpm lint
```

提交变更前建议执行：

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## 生产构建

```bash
pnpm build
```

构建结果位于 `out/`：

- `out/main/`
- `out/preload/`
- `out/renderer/`

## macOS 本地打包

```bash
pnpm package:mac
```

当前打包配置用于本地生成未签名的 macOS 安装产物，不包含 Apple Developer 签名或 notarization 配置。

## 命令速查

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动 Electron 开发环境 |
| `pnpm test` | 运行全部测试 |
| `pnpm test:unit` | 运行单元测试 |
| `pnpm typecheck` | 运行 TypeScript 类型检查 |
| `pnpm lint` | 运行 ESLint |
| `pnpm build` | 创建生产构建 |
| `pnpm package:mac` | 构建并打包 macOS 应用 |

## 当前限制

- Claude Code、Codex 和 Hermes 的真实本地会话格式尚未通过脱敏 fixture 建立。
- 三个来源当前返回 `FORMAT_NOT_ESTABLISHED`，因此暂时不会产生真实活动统计。
- 当前只面向 macOS；Windows 支持尚未实现。
- 不包含 AI 摘要、云同步、quota 推测、后台 daemon 或对话内容分析。
- macOS 安装产物尚未签名或 notarize，不适合直接公开发布。

## 隐私与安全

Token Activity Show 采用本地优先设计：

- 收集的数据保存在本机 SQLite 数据库中。
- 不读取或保存 prompt、回复和其他对话正文。
- 不读取浏览器 cookie，不拦截网络流量，也不调用未公开的私有 API。
- Electron 使用 `contextIsolation: true`、`nodeIntegration: false` 和 sandbox。
- renderer 仅能通过经过校验的白名单 IPC API 请求数据。

## 常见问题

### `better-sqlite3` 加载失败或 Node 进程崩溃

确认正在使用 Node.js 22.23.1：

```bash
node --version
```

如果版本不正确，请切换 Node 版本后重新安装依赖：

```bash
rm -rf node_modules
pnpm install
```

### 为什么页面没有真实统计数据？

当前 source adapter 只支持已经由真实、脱敏 fixture 证明的格式。由于三个目标工具的格式尚未建立，应用会报告 `FORMAT_NOT_ESTABLISHED`，而不是猜测字段或将未知指标显示为零。
```

- [ ] **Step 3: Review documentation accuracy**

Compare the README against `package.json` and verify:

```text
- every command exists
- Node and pnpm versions match
- no real-source support is claimed
- no conversation-body collection is claimed
- unsigned macOS packaging is described accurately
- no Windows support is claimed
```

Expected: all statements match the repository state and approved design.

- [ ] **Step 4: Validate Markdown and whitespace**

Run:

```bash
git diff --check
git diff -- README.md
```

Expected: `git diff --check` exits successfully, the README has no trailing whitespace, and the diff contains only the intended root documentation.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add project usage guide"
```
