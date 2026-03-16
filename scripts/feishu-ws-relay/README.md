# Feishu Long Connection Relay

这个方案不使用公网回调 URL，改为飞书官方推荐的“长连接”模式：

1. 本地/服务器进程通过 WebSocket 长连接接收飞书事件
2. 收到事件后调用 GitHub `repository_dispatch`
3. 触发仓库工作流 `.github/workflows/feishu-readmydock-sync.yml`
4. 更新 `assets/feishu-sync-status.json`

## 适用场景

- 飞书“请求地址”保存时一直 3 秒超时
- 无法稳定提供可被飞书访问的公网回调地址
- 可以保持一个常驻进程在线（本机、云主机、NAS 均可）

## 文件

- `relay.mjs`: 长连接中继主脚本
- `.env.example`: 环境变量模板
- `package.json`: 依赖与启动命令

## 1) 安装依赖

```bash
cd scripts/feishu-ws-relay
npm install
```

如果你环境里默认 npm 缓存目录不可写，可以这样：

```bash
NPM_CONFIG_CACHE=/tmp/.npm-cache npm install
```

## 2) 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少填这些：

- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_EVENT_TYPES`（逗号分隔，必须和飞书后台已订阅事件类型一致）
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_TOKEN`

默认 `GITHUB_EVENT_TYPE=feishu_wiki_sync`，与当前仓库 workflow 匹配。

## 3) 启动长连接中继

```bash
npm run start:env
```

看到类似日志即表示连接成功并开始监听：

- `starting Feishu long-connection relay`
- SDK 输出 `connected to wss://...`

## 4) 飞书后台操作（关键）

1. 进入 `开发配置 > 事件与回调 > 事件配置`
2. 订阅方式改为 `使用长连接接收事件`
3. 保存（要求此时你的 relay 进程已在线）
4. 添加需要的事件（建议先加 1 个易触发事件做联调）
5. 发布应用让配置生效

## 5) 验收

1. 在飞书触发一次已订阅事件
2. 查看 GitHub Actions 是否出现 `Feishu Readmydock Sync`
3. 查看 `assets/feishu-sync-status.json` 是否更新
4. 打开 `readmydock.html` 看“飞书同步状态”

## 6) 常见问题

- 保存长连接订阅方式时报错
  - 先确认 `npm run start:env` 正在运行，且日志无报错
- 收到事件但 Actions 未触发
  - 检查 `.env` 中 `GITHUB_TOKEN` 权限（至少可调用 repository_dispatch）
  - 检查 `GITHUB_OWNER/GITHUB_REPO` 是否正确
- 一次事件触发多次
  - 飞书存在重试机制；脚本内已按 `event_id` 做内存去重（进程重启后缓存会清空）

## 7) 持久运行（可选）

```bash
nohup npm run start:env > /tmp/feishu-ws-relay.log 2>&1 &
```

建议最终使用 `systemd` / `pm2` 做守护。
