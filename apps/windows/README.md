# LocoWiki Windows 客户端

LocoWiki 官网（<https://locowiki.com>）的 Windows 桌面外壳：**在线优先 + 本地离线缓存**。

- 技术栈：.NET 8（WPF）+ Microsoft Edge WebView2
- 内容永远优先从线上读取；网络不可用时自动回落到本机缓存
- 首次运行时若完全离线，使用随安装包分发的站点快照作为兜底
- 不修改网站仓库的任何线上内容，只做客户端封装

## 目录结构

```
apps/windows/
  build.ps1                        构建 / 发布脚本
  NuGet.config                     NuGet 源（国内镜像）
  src/LocoWiki.Desktop/
    LocoWiki.Desktop.csproj
    App.xaml(.cs)                  应用入口
    MainWindow.xaml(.cs)           窗口、状态栏、离线错误页
    Services/
      SiteCache.cs                 网络优先 + 磁盘缓存 + 内置快照回落
      WebResourceInterceptor.cs    通过 WebView2 拦截站点请求
      NetworkGate.cs               断网快速失败，避免每个资源都等超时
      Diagnostics.cs               失败与回落日志
    Assets/                        应用图标
    offline-site/                  站点静态快照（离线兜底）
```

`offline-site/` 由 `scripts/sync-offline-site.mjs` 从仓库根目录生成，可随时刷新：

```powershell
node scripts/sync-offline-site.mjs apps/windows/src/LocoWiki.Desktop/offline-site
```

## 构建

前置条件：

1. Windows 10/11 x64
2. .NET 8 SDK
3. Microsoft Edge WebView2 Runtime（Windows 11 通常已内置）

本仓库提供工具链安装脚本（安装到 `%USERPROFILE%\.locowiki-toolchain`，不会写入仓库）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-build-tools.ps1 -DotNet
```

构建并发布到 `artifacts/windows`：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File apps/windows/build.ps1
```

生成自包含版本（目标机器无需安装 .NET 运行时，体积更大）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File apps/windows/build.ps1 -SelfContained
```

运行 `artifacts/windows/LocoWiki.exe` 即可测试。

生成一键安装包（Inno Setup 6，内含自包含 .NET 运行时）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File apps/windows/build-installer.ps1
```

产物：`artifacts/LocoWiki-Setup-0.1.0.exe`，安装后自动创建桌面和开始菜单快捷方式；目标机器只需 WebView2 Runtime。

## 缓存策略

| 场景 | 行为 |
| --- | --- |
| 有网络 | 每次请求先访问线上，成功后写入磁盘缓存 |
| 主站返回 404 | 自动回落到 `locowiki.github.io` 同名路径（例如 `papers.html`），再写缓存 |
| 断网 / 请求超时 | 使用该 URL 最近一次成功响应的磁盘缓存 |
| 从未访问过且断网 | 使用 `offline-site/` 内置快照（仅站点骨架与静态页） |
| 手动刷新 | 状态栏「刷新」或 F5 / Ctrl+R，会重置断网退避并重新联网 |

- 缓存目录：`%LOCALAPPDATA%\LocoWiki\WebCache`
- 上限 256 MB，超出后按最久未使用顺序清理
- 拦截范围：`locowiki.com`、`www.locowiki.com`、`locowiki.github.io`、`raw.githubusercontent.com/LocoWiki/*`
- 文档正文来自 `raw.githubusercontent.com`，同样会被缓存，因此读过的文档可离线阅读
- 诊断日志：`%LOCALAPPDATA%\LocoWiki\logs\app.log`

## 测试辅助

- 强制离线（验证缓存）：启动前设置环境变量 `LOCOWIKI_FORCE_OFFLINE=1`
- 直接打开指定页面：`LocoWiki.exe https://locowiki.com/papers.html`
- 查看缓存占用：状态栏右侧会实时显示

## 已知限制

- 评论区（giscus）依赖 GitHub 登录与网络，离线时不可用
- 外部链接（GitHub、飞书等）交由系统默认浏览器打开
- 内置快照不包含远程 Markdown 正文，只保证离线时站点可打开

## 分支说明

本实现位于 `feature/windows-app` 分支，待测试通过后再进行正式打包（签名、安装包）。`main` 分支不做任何修改。

