# train-kline（LocoWiki 工具页）

把 TensorBoard 训练标量画成股票式 K 线的本地看板。本目录同时是网站组件和单文件工具。

- 页面：<https://locowiki.com/tools/train-kline/>
- 单文件：`train-kline.pyz`（约 33 KB）

## 目录

```
tools/train-kline/
├── index.html            # 站点页面（连接面板 + 看板）
├── assets/               # 页面脚本与样式
├── train-kline.pyz       # 单文件发行版
├── src/train_kline/      # 源码
├── scripts/build_zipapp.py
├── tests/
└── pyproject.toml
```

## 页面如何工作

1. 页面本身是静态资源，托管在 LocoWiki。
2. 用户在本机启动 `train-kline`，默认监听 `127.0.0.1:8791`。
3. 页面请求 `http://127.0.0.1:8791/api/*`，服务按白名单返回 CORS 头。
4. 训练数据由本地服务读取 tfevents，网页只负责画图。

TensorBoard 的 6006 端口不能被网页跨域读取；页面连接的是 train-kline 的 8791。

## 本地启动

```bash
python3 train-kline.pyz --logdir /path/to/logs --tensorboard
```

或从源码：

```bash
PYTHONPATH=src python3 -m train_kline --logdir /path/to/logs --tensorboard
```

## 修改后同步

本目录的 `assets/` 与 `src/train_kline/static/` 是同一套前端，修改后需要：

```bash
cd tools/train-kline
python3 scripts/build_zipapp.py
cp dist/train-kline.pyz ./train-kline.pyz
chmod +x train-kline.pyz
# 如果改了 app.js / chart.js / style.css，再同步一次：
cp src/train_kline/static/{app.js,chart.js,style.css} assets/
```

`scripts/build_zipapp.py` 输出到 `dist/`，需要手动复制到本目录根。

## 测试

```bash
cd tools/train-kline
PYTHONPATH=src python3 -m unittest discover -s tests
```

## CORS

服务默认允许：

- `https://locowiki.github.io`
- `https://locowiki.com`
- `https://www.locowiki.com`
- `http://127.0.0.1:*`、`http://localhost:*`、`https://127.0.0.1:*`、`https://localhost:*`

其他站点用 `--allow-origin` 追加。服务只监听回环地址，只有 GET 接口。

## License

MIT，见 [LICENSE](./LICENSE)。
