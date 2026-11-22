# TokenBar

一个只活在 macOS 菜单栏里的 AI 订阅额度查看器。自动读取本机已登录的 AI 编码工具，显示会话、每周、每月额度和重置时间。

> 纯原生 Swift / AppKit + SwiftUI，无 Dock 图标、无主窗口、无数据库、无云同步。点击菜单栏图标查看额度弹窗。

## 支持的本机订阅

| 来源 | 自动读取的本地凭据 | 额度接口 |
| --- | --- | --- |
| Claude Code | `~/.claude/.credentials.json` 或 tokenbar 配置文件 | `api.anthropic.com/api/oauth/usage` |
| OpenAI Codex | `~/.codex/auth.json` | `chatgpt.com/backend-api/wham/usage` |
| Antigravity | `agy` CLI 本地登录（PATH 或 `ANTIGRAVITY_CLI_PATH`） | 本机执行 `agy -p /usage --output-format json` |
| Cursor | `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` | `cursor.com/api/usage-summary` |
| GitHub Copilot | `GH_TOKEN` / `GITHUB_TOKEN`、`~/.config/gh/hosts.yml` 或 tokenbar 配置文件 | `api.github.com/copilot_internal/user` |
| Kimi Code | `~/.kimi-code/credentials/kimi-code.json` | `api.kimi.com/coding/v1/usages` |
| Nous Portal | `~/.hermes/auth.json`、`~/.hermes/shared/nous_auth.json` | `portal.nousresearch.com/api/oauth/account` |
| Windsurf | `~/Library/Application Support/Windsurf/.../state.vscdb` 本地缓存 | 无网络请求 |

登录哪个工具，菜单栏就显示哪个；未登录的来源会自动隐藏。若一个都没检测到，弹窗会列出对应的登录命令。

## 界面

- **菜单栏**：动态小柱状图 + 当前最高已用 / 最低剩余百分比（跟随视角）。已用超过 90% 变红。悬停可看所有来源。
- **菜单栏配置**：齿轮 →「菜单栏显示…」，三根柱子和右侧百分比可分别选择「自动」或具体来源/窗口；“自动”会按额度紧张程度填充。
- **左键弹窗**：右上角切换「剩余 / 已用」视角（默认剩余）；按来源显示套餐、各额度窗口、百分比、重置倒计时、余额/额外用量。**只展示能正常获取额度的来源，登录过期或获取失败不会占位**。
- **右键菜单**：刷新、刷新间隔（1/5/15/30/60 分钟）、开机启动、退出。
- **刷新**：每次打开弹窗都会重新拉取数据；默认每 5 分钟自动刷新；从睡眠唤醒后自动刷新。
- 没有任何设置窗口。登录状态由各工具自己的 CLI/App 管理。

## 构建与运行

要求 macOS 14+、Swift 6.0+（Xcode 16+）。

```bash
swift build
swift run TokenBar
```

打包成 `.app`（菜单栏应用，无 Dock 图标）：

```bash
./scripts/package_app.sh
open dist/TokenBar.app
```

### 命令行探测

用于确认本机检测和额度接口是否正常。**不会输出 token、邮箱或对话内容**：

```bash
swift run TokenBar --probe
swift run TokenBar --probe --json
swift run TokenBar --probe --provider codex
swift run TokenBar --dump
```

## 配置文件（可选）

TokenBar **不读取 macOS 钥匙串**，因此不会出现系统授权弹窗。若某个工具的凭据只在钥匙串里（常见于 Claude Code 和 `gh`），可以把它写进普通配置文件：

`~/.config/tokenbar/config.json`（或 `$XDG_CONFIG_HOME/tokenbar/config.json`）

示例见 [`config.example.json`](config.example.json)。

```json
{
  "claudeAccessToken": "sk-ant-oat...",
  "claudeRefreshToken": "...",
  "githubToken": "gho_...",
  "kimiAccessToken": "...",
  "nousAccessToken": "..."
}
```

- 只需要填你要用的字段，其余可省略。
- 文件里是明文 token，建议 `chmod 600 ~/.config/tokenbar/config.json`。
- Copilot：先在终端运行 `gh auth token`，把输出粘贴为 `githubToken`。
- Claude：如果 `~/.claude/.credentials.json` 不存在，可以把 Claude Code OAuth 登录信息中的 access token 填入 `claudeAccessToken`；TokenBar 不会从钥匙串读取它。
- 修改配置后点击菜单栏弹窗里的刷新按钮即可，无需重启。

## 权限与隐私

- 只读取已知文件、环境变量和 tokenbar 配置文件，不遍历磁盘、不读取浏览器 Cookie、不读取对话正文。
- **TokenBar 不读取 macOS 钥匙串**，不会触发 TokenBar 自己的钥匙串授权弹窗。
- Antigravity 通过官方 `agy` CLI 读取额度；`agy` 自己的登录凭据由 Antigravity 管理，TokenBar 不读取、不改写。
- 网络请求只发往各服务商的官方额度接口；不发送提示词、回复、文件内容或会话日志。
- 刷新得到的 Claude OAuth 令牌只缓存在 `~/Library/Application Support/TokenBar/credentials.json`，文件权限 `0600`，目录 `0700`；不会回写 Claude Code 自己的凭据文件。
- Kimi、Codex、Copilot、Cursor 的凭据只读，TokenBar 不刷新、不改写。
- 无遥测、无云同步、无后台 daemon。
- 所有额度查询使用各产品自己的非公开/半公开接口，服务商调整后可能失效；这不是官方 API。

## 当前限制

- **Claude Code / GitHub Copilot**：macOS 上这两个工具的凭据默认放在钥匙串。为避免反复弹出系统授权，TokenBar **不读取钥匙串**；请把 token 写入 `~/.config/tokenbar/config.json`（见上文），或使用已有的普通凭据文件。
- **Antigravity**：通过 `agy -p /usage --output-format json` 读取额度；需要先在终端运行 `agy` 登录。TokenBar 会禁用 `agy` 的自动更新，并在未登录时阻止它自动打开浏览器。`agy` 冷启动约 5–8 秒，弹窗会先显示上次数据，刷新完成后再更新。
- **Cursor**：目前支持明文 JWT 登录令牌；Cursor 新版本的 `cursor-safe-storage:` 加密令牌暂不支持，会提示重新登录。
- **Kimi Code**：CLI 的 access token 很短（约 15 分钟）。TokenBar 不会刷新它（避免让 CLI 的 refresh token 失效）；过期后该来源不再展示，运行一次 `kimi` 后刷新即可恢复。
- **Windsurf**：只读本地缓存，数据可能不是最新；需要先在 Windsurf 中登录并启动过一次。
- **Nous Portal**：access token 约 1 小时有效；过期后运行一次 `hermes` 命令刷新。
- 暂未支持：Zed、OpenCode Go、JetBrains AI、Qwen、MiniMax、z.ai 等。架构上可以继续加 provider。
- 未做代码签名和 notarization；`dist/TokenBar.app` 仅适合本机使用。

## 测试与质量检查

所有改动都必须通过对应测试；完整规则见 [`AGENTS.md`](AGENTS.md)。

| 场景 | 命令 |
| --- | --- |
| 全部 Swift 测试 | `swift test` / `make test` |
| 单元、解析、配置测试 | `swift test --skip EndToEndTests` / `make test-unit` |
| 全链路 E2E | `swift test --filter EndToEndTests` / `make test-e2e` |
| 菜单栏配置解析 | `swift test --filter MenuBarLayoutTests` |
| 完整门禁（测试 + 打包 + 隔离 HOME 冒烟） | `./scripts/e2e.sh` / `make e2e` |

E2E 测试使用临时 HOME、隔离的 SQLite 数据库、模拟 HTTP 响应和 fake `agy` CLI，覆盖：

`本地凭据 → 8 个来源的检测 → HTTP/CLI 拉取 → 解析 → UsageStore 刷新 → 菜单栏三柱/百分比解析 → 配置持久化`

不会读取真实 token 或真实会话数据。Fixture 位于 `Tests/TokenBarCoreTests/EndToEndTests.swift`。CI 配置位于 `.github/workflows/tests.yml`。

改动后至少执行：

```bash
swift test
```

涉及 provider、菜单栏、打包或发布前执行：

```bash
./scripts/e2e.sh
```

## 开发

```bash
swift test
swift build
```

代码结构：

```text
Sources/TokenBarCore/
  Models.swift                 额度窗口、来源状态、排序
  ProviderCatalog.swift        来源元数据（名称、图标、颜色、登录提示）
  ProviderRegistry.swift       已支持来源的注册表
  MenuBarLayout.swift          菜单栏三根柱/百分比的配置与解析
  UsageStore.swift             自动发现、并发刷新、定时器（每次展开刷新）
  ProbeRunner.swift            --probe 脱敏输出
  Providers/                   每个来源的检测、凭据读取、接口请求、解析
  Net/HTTPClient.swift         无 Cookie、无缓存、跨域重定向拦截、可注入测试 transport
  Security/                    OAuth 令牌缓存（不读钥匙串）
Sources/TokenBar/
  TokenBarMain.swift           入口与 CLI
  AppDelegate.swift            生命周期
  StatusItemController.swift   菜单栏图标、浮层面板、右键菜单
  PopoverView.swift            浮层布局
  MenuBarSettingsView.swift    菜单栏三柱/百分比设置
  ProviderCardView.swift       来源卡片与额度进度条
Tests/TokenBarCoreTests/
  EndToEndTests.swift          临时 HOME + 模拟 HTTP + fake agy + SQLite 全链路
  MenuBarLayoutTests.swift     三柱/百分比解析与配置
  ProviderParsingTests.swift   各来源响应解析
scripts/package_app.sh         生成 dist/TokenBar.app
scripts/e2e.sh                 完整测试、打包与启动冒烟
```

## 致谢

接口行为和本地凭据位置参考了 [CodexBar](https://github.com/steipete/CodexBar)（MIT）。TokenBar 是独立实现，只保留“读取本机额度 + 菜单栏展示”这一条最小路径。

Provider 图标来自 CodexBar 的 MIT 资源及各产品官方品牌标识；相关商标归各自所有者。

## License

MIT
