# LocoWiki Android 客户端

LocoWiki 官网（<https://locowiki.com>）的 Android 外壳：**在线优先 + 本地离线缓存**。

- 技术栈：原生 Android（Java）+ WebView，无第三方运行时依赖
- 内容优先从线上读取；断网时回落到本机缓存
- 首次运行且完全离线时，使用随 APK 打包的站点快照兜底
- 最小系统：Android 7.0（API 24），目标 API 35

## 目录结构

```
apps/android/
  build.ps1                         构建脚本
  settings.gradle.kts               Gradle 配置（AGP 8.7.3 / JDK 17）
  app/
    build.gradle.kts
    src/main/
      AndroidManifest.xml
      java/com/locowiki/app/
        MainActivity.java            WebView、离线错误页、外链处理
        SiteCache.java               网络优先 + 磁盘缓存 + assets 快照回落
        NetworkGate.java             断网快速失败
      res/                           图标、主题、启动页
      assets/offline-site/           站点静态快照（离线兜底）
```

`assets/offline-site/` 由仓库根目录生成，可随时刷新：

```powershell
node scripts/sync-offline-site.mjs apps/android/app/src/main/assets/offline-site
```

## 构建

前置条件（可用 `scripts/setup-build-tools.ps1 -Android` 一键安装）：

1. JDK 17
2. Android SDK：`platforms;android-35`、`build-tools;35.0.0`、`platform-tools`
3. Gradle 8.11.1（或使用仓库自带 wrapper）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-build-tools.ps1 -Android
powershell -NoProfile -ExecutionPolicy Bypass -File apps/android/build.ps1
```

产物：`artifacts/android/LocoWiki-0.1.0-debug.apk`

安装到已连接的设备：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File apps/android/build.ps1 -Install
```

或手动：

```powershell
adb install -r artifacts/android/LocoWiki-0.1.0-debug.apk
```

## 缓存策略

| 场景 | 行为 |
| --- | --- |
| 有网络 | 每个请求先访问线上，成功后写入应用缓存目录 |
| 主站返回 404 | 自动回落到 `locowiki.github.io` 同名路径（例如 `papers.html`） |
| 断网 / 请求超时 | 使用该 URL 最近一次成功响应的磁盘缓存 |
| 从未访问过且断网 | 使用 APK 内置的 `offline-site/` 快照 |
| 重试 | 离线错误页「重试」会重置断网退避并重新联网 |

- 缓存目录：应用私有 `cache/webcache`（系统可在存储紧张时清理）
- 缓存上限 256 MB，超出后按最久未使用顺序清理
- 拦截范围：`locowiki.com`、`www.locowiki.com`、`locowiki.github.io`、`raw.githubusercontent.com/LocoWiki/*`
- 文档正文（GitHub raw Markdown）同样会缓存，读过的文档可离线阅读
- 所有内容均走 HTTPS，明文流量被禁止

## 已知限制

- 评论区（giscus）需要网络与 GitHub 登录，离线不可用
- 外部链接（GitHub、飞书等）通过系统浏览器打开
- 内置快照不包含远程 Markdown 正文，只保证离线时站点可打开
- 当前仅提供 debug APK 用于测试；正式发布需配置签名与 AAB

## 调试

缓存命中与回落情况可通过 logcat 查看：

```powershell
adb logcat -s LocoWikiCache:I
```

## 分支说明

本实现位于 `feature/android-app` 分支，待测试通过后再进行正式打包（签名、AAB/APK）。`main` 分支不做任何修改。

