# 接入与运维

## 1. 数据契约

train-kline 只解析 TensorBoard 的标量记录：

```
<logdir>/<run>/events.out.tfevents.<timestamp>.<host>.<pid>
```

- 一个包含 tfevents 的目录视为一次运行；`<logdir>` 下可以有多层实验目录。
- 同一目录允许多个事件文件（断点续训、重启），按 step 合并。
- 只读取已写完的记录；训练正在写入的半条记录会在下一次刷新时补上。
- 文件被截断或重建时自动从头读取。

不需要修改训练代码。TensorBoard 的 `add_scalar`、rsl_rl 的 logger、SB3 的 `tensorboard_log` 都满足该约定。

## 2. 常见框架

### rsl_rl / mjlab / Isaac Lab

目录结构：

```
logs/rsl_rl/<experiment>/<timestamp>/{events...,params/agent.yaml,params/env.yaml,model_*.pt}
```

```bash
train-kline --logdir logs/rsl_rl
```

会自动读取 `num_envs`、`max_iterations`、`save_interval`，用于进度条和 ETA。

### Stable-Baselines3

```python
model = PPO("MlpPolicy", env, tensorboard_log="./tb_logs")
model.learn(total_timesteps=1_000_000)
```

```bash
train-kline --logdir tb_logs
```

SB3 会写 `tb_logs/PPO_1/`，递归扫描可以直接识别。

### PyTorch SummaryWriter

```python
from torch.utils.tensorboard import SummaryWriter

writer = SummaryWriter("runs/exp1")
for step in range(total):
    writer.add_scalar("train/reward", reward, step)
```

```bash
train-kline --logdir runs
```

### 自研框架

把每个实验写进独立目录，step 单调递增，标量用 `add_scalar` 写入即可。

## 3. 可选的 run.json

在运行目录放 `run.json` 可以补全看板信息：

```json
{
  "name": "Origo AMP walk",
  "num_envs": 4096,
  "max_iterations": 20000,
  "save_interval": 500,
  "notes": "曲线含义说明"
}
```

字段都可省略。rsl_rl 的 `params/*.yaml` 优先于同名 `run.json` 字段。

## 4. 与训练并行启动

### 终端 / tmux

```bash
python3 train-kline.pyz --logdir ./logs/rsl_rl --tensorboard --no-open
```

`--wait 3600` 可以让看板先起，等训练创建日志后再自动进入。

### systemd

```bash
sudo cp examples/systemd/train-kline.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now train-kline
```

按实际路径修改 `User`、`WorkingDirectory`、`ExecStart` 与 `--logdir`。

### SSH 隧道

训练在远程机器：

```bash
ssh -L 8791:127.0.0.1:8791 user@training-host
```

本地打开 `http://127.0.0.1:8791/`，或在网页版里连接 `127.0.0.1:8791`。

## 5. TensorBoard 并列与链接

```bash
# 自动拉起 6006
train-kline --logdir logs/rsl_rl --tensorboard

# 已有 TensorBoard
train-kline --logdir logs/rsl_rl --tensorboard-url http://127.0.0.1:6006/

# 多日志目录：TensorBoard 使用 --logdir_spec
train-kline --logdir exp_a --logdir exp_b --tensorboard
```

TensorBoard 进程由 train-kline 启动时，退出看板会一并结束；复用已有实例时不会动它。

## 6. 网页版连接

网页版（`https://locowiki.com/tools/train-kline/`）通过跨域请求读取本地服务：

- 服务默认监听 `127.0.0.1:8791`；
- 默认允许 `locowiki.github.io`、`locowiki.com`、`www.locowiki.com` 与本地回环来源；
- 自定义域名用 `--allow-origin https://your.site` 追加；
- 浏览器会先发 `OPTIONS` 预检，服务返回 `Access-Control-Allow-Private-Network: true`；
- 只提供 GET，没有写入或删除接口。

## 7. 排错

| 现象 | 原因 | 处理 |
|---|---|---|
| 启动提示没有 tfevents | `--logdir` 层级不对 | 指向包含 `events.out.tfevents*` 的父目录 |
| 网页版连接失败 | 本地服务没起、端口不对、CORS 被拒 | 先访问 `http://127.0.0.1:8791/api/health` 自检 |
| 输入 6006 连不上 | 那是 TensorBoard 端口 | 改连 train-kline 的 8791 |
| 曲线不更新 | 看板刷新关闭或训练未写新记录 | 检查右上角刷新间隔与 `LIVE` 状态 |
| 指标太多 | 训练记录了长尾标量 | 右侧搜索，或点击快捷指标 |
| 端口被占用 | 已有实例 | `--port` 换端口，或关闭旧进程 |
