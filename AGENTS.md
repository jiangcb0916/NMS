# AGENTS.md

## 项目定位

这是一个内网网络管理系统，项目名为 `Sangfor NMS Next`。后端是 Flask，前端是原生 JavaScript + CSS + Jinja 模板，默认使用 SQLite 存储本地数据和会话文件。

默认本地访问地址：

```text
http://127.0.0.1:5001
```

核心目标是把多个网络/安全系统的数据汇总到一个轻量运维界面中，包括设备、无线控制器、交换机、华为防火墙、联软准入客户端、WANFlow OSDWAN、深信服 AC 流量分析和姓名缓存。

## 开发原则

- 先读代码再改。优先查看 `app/modules/*/routes.py`、`templates/index.html`、`static/js/app.js`、`static/css/app.css` 和 `app/config.py`。
- 保持改动小而准。不要顺手重构无关模块，不要改动用户没有要求的页面。
- 尊重现有工作区和服务器改动。看到未提交修改时先理解来源，不要用 `git reset --hard` 或 `git checkout --` 覆盖。
- Git 本地操作和 GitHub 同步要分开处理。除非用户明确要求 `push`、同步 GitHub 或服务器部署，不要自动执行 `git push`、远端同步或部署动作。
- 不提交 `.env`、`instance/`、数据库、会话文件、真实 token、真实密码或共享密钥。
- 新增配置时同步检查 `app/config.py`、`.env.example`、`README.md` 和 `docs/server-docker-deploy.md` 是否需要更新。
- 外部接口可能不稳定，页面应能显示“未配置/异常/暂无数据”，不能让一个接口失败拖垮整个页面。
- 搜索、分页、筛选尽量沿用项目已有模式，不另造一套交互。

## 常用命令

本地启动：

```bash
/private/tmp/sangfor-next-venv/bin/python main.py
```

健康检查：

```bash
curl -sS http://127.0.0.1:5001/api/health
```

前端语法检查：

```bash
node --check static/js/app.js
```

Python 语法检查：

```bash
env PYTHONPYCACHEPREFIX=/private/tmp/sangfor-pycache /private/tmp/sangfor-next-venv/bin/python -m py_compile app/modules/dashboard/routes.py scripts/smoke_test.py
```

冒烟测试：

```bash
/private/tmp/sangfor-next-venv/bin/python scripts/smoke_test.py
```

空白/格式检查：

```bash
git diff --check
```

查看 5001 端口进程：

```bash
lsof -iTCP:5001 -sTCP:LISTEN -n -P
```

Docker 常用操作：

```bash
docker compose up -d --build
docker compose restart web
docker compose logs --tail=200 web
docker compose ps
```

服务器部署细节参考：

```text
docs/server-docker-deploy.md
```

## 模块地图

- `app/modules/dashboard/routes.py`：仪表盘汇总接口，聚合设备、无线、交换机、防火墙、OSDWAN、深信服 AC 等摘要数据。
- `app/modules/firewall/routes.py`：华为防火墙 SNMP 与 Prometheus 带宽历史，首页首屏速率可用 Prometheus 补齐。
- `app/modules/osdwan/routes.py`：WANFlow OSDWAN 用户、部门、出口 IP、出口连通性、整体带宽和 SaaS 流量。
- `app/modules/sangfor_ac/client.py`、`app/modules/sangfor_ac/routes.py`：深信服 AC 用户流速排行、应用明细、流量分析页面。
- `app/modules/switches/routes.py`：交换机 Prometheus targets、端口过滤、端口状态、端口速率和历史流量。
- `app/modules/wireless/routes.py`：无线控制器 Prometheus 查询、AP/SSID/无线用户列表和 Top 统计。
- `app/modules/access_control/routes.py`：联软准入客户端列表、在线/离线筛选、姓名解析。
- `app/modules/access_control/name_cache.py`：手机号到姓名的缓存与后台补全。
- `app/modules/users/routes.py`、`app/modules/devices/routes.py`、`app/modules/cache/routes.py`：系统用户、设备、缓存管理。
- `templates/index.html`：主要单页模板，包含仪表盘和各功能区 DOM。
- `static/js/app.js`：主要前端状态、请求、渲染和事件逻辑。
- `static/css/app.css`：全局 UI 样式。

## 外部系统约定

- Prometheus 默认地址来自 `PROMETHEUS_QUERY_URL`、`PROMETHEUS_METRICS_URL`、`PROMETHEUS_TARGETS_URL`。
- 无线控制器查询使用固定 label：`WIRELESS_INSTANCE`、`WIRELESS_JOB`、`WIRELESS_AUTH`、`WIRELESS_MODULE`。
- 交换机监控读取 Prometheus targets，默认关注 `job=sw` 和 `pool-sw`。端口列表需过滤无业务意义端口，默认正则在 `SWITCH_PORT_EXCLUDE_PATTERNS`。
- 华为防火墙使用 SNMP exporter 地址 `HUAWEI_SNMP_URL`，目标默认 `HUAWEI_FIREWALL_TARGET=172.16.100.3`，总带宽默认 `HUAWEI_TOTAL_BANDWIDTH_MBPS=450`。
- WANFlow OSDWAN 使用 Bearer Token，配置项包括 `OSDWAN_API_BASE_URL`、`OSDWAN_CONSOLE_ORIGIN`、`OSDWAN_TOKEN`、`OSDWAN_NODE_ID`、`OSDWAN_NODE_NAME`、`OSDWAN_USER_CAPACITY`。
- OSDWAN 当前约定：带宽统计固定最近 1 天，SaaS 流量固定最近 6 小时；如果后台不支持某个 period，不要在 UI 暴露该选项。
- WANFlow 用户列表接口使用分页参数，例如 `/api/user?page=1&per_page=10&no_cache=1`。部门来自 `departments`，出口来自 `proxies`，出口实际 IP 通过 `/api/proxy/<id>/check-connectivity`。
- 深信服 AC 地址来自 `SANGFOR_AC_HOST`、`SANGFOR_AC_PORT`、`SANGFOR_AC_SHARED_SECRET`。流量分析默认 TopN 使用 `SANGFOR_AC_USER_RANK_TOP=10000`，并用 `SANGFOR_AC_USER_RANK_CACHE_SECONDS` 避免搜索频繁打 AC。
- 深信服 AC 用户名常见为手机号，姓名显示通过联软/钉钉姓名缓存转换。形如 `ea-ad-0b-ba-e6-09(26-a3-f1-d9-4d-4f)` 的用户名只保留括号前内容。
- 联软准入配置来自 `ACCESS_CONTROL_API_URL`、`ACCESS_CONTROL_API_USERNAME`、`ACCESS_CONTROL_API_PASSWORD`、`ACCESS_CONTROL_FILTER_DEPARTMENT`。
- 钉钉姓名解析配置来自 `DINGTALK_APPKEY`、`DINGTALK_APPSECRET`，不要在代码或文档中写真实值。

## 前端/UI 约定

- 仪表盘只展示关键状态，避免重复信息。已有顶部卡片展示的数据，不要在下方卡片再重复堆一遍。
- 仪表盘当前方向：顶部保留设备、无线用户、在线 AP、OSDWAN 用户、OSDWAN 出口；左侧看防火墙和 OSDWAN 带宽；右侧看健康检查和防火墙资源；下方展示无线用户 Top 与应用排行。
- 防火墙首页卡片聚焦链路带宽。CPU、内存、总带宽更适合放入健康检查或资源区。
- OSDWAN 首页卡片聚焦“带宽统计”和“SaaS 流量”。用户容量、出口状态已经在顶部卡片展示时，不要重复展示。
- 业务工具界面要克制、清晰、利于扫描。不要做营销式 hero，不要堆大面积装饰渐变，不要为了填满区域增加低价值信息。
- 分页样式、搜索框、筛选器要沿用现有项目模式。搜索时如果顶部统计表示整体数据，不应随搜索结果变化；如果统计表示筛选结果，文案必须明确。
- 列表页应有 `共 N 条，当前显示 M 条` 之类摘要；分页按钮用“上一页/下一页”和页码。
- 表格列要展示真实有意义字段。无意义字段应删除或替换，例如 OSDWAN 用户表中优先展示部门、出口 IP，而不是无实际用途的最后更新时间。
- 自动刷新要隔离搜索输入和分页状态，避免实时卡片刷新导致列表搜索被清空或显示“暂无数据”。
- 图表单位要准确。外部接口返回 bytes/s 时，换算成 bps 需乘 8；展示时用 Kbps/Mbps/Gbps。

## 验证清单

改前端 JS：

```bash
node --check static/js/app.js
git diff --check
```

改 Python 接口：

```bash
env PYTHONPYCACHEPREFIX=/private/tmp/sangfor-pycache /private/tmp/sangfor-next-venv/bin/python -m py_compile app/modules/dashboard/routes.py scripts/smoke_test.py
/private/tmp/sangfor-next-venv/bin/python scripts/smoke_test.py
```

改文档：

```bash
git diff --check
```

改完需要本地查看时：

```bash
/private/tmp/sangfor-next-venv/bin/python main.py
curl -sS http://127.0.0.1:5001/api/health
```

如果只改文档，不需要重启服务，也不需要跑完整烟测。

## 部署注意

- 本地代码更新到服务器的常规流程：本地提交并推送 GitHub，服务器执行 `git pull --ff-only`，然后重启或重建容器。这个流程只在用户明确要求同步/部署时执行。
- 本地验证不需要推送 GitHub。功能分支、本地提交、合并 `main`、推送 GitHub、服务器拉取和容器重启是独立步骤，按用户当次要求逐步执行。
- 服务器网络异常时，`git pull` 可能报 `Could not resolve host: github.com`，先排查 DNS/网络，不要盲目改代码。
- 服务器如果有本地修改，`git pull --ff-only` 可能提示文件会被覆盖。先执行 `git status` 和 `git diff`，确认是否为服务器专用改动。
- 服务器上的 `.env` 和 `instance/` 必须保留，不提交、不覆盖。SQLite 数据库和 Flask session 都在 `instance/`。
- 如果服务器为加速构建改过 `Dockerfile` 或 `docker-compose.yml`，先比较差异，再决定把改动纳入仓库、stash，或在服务器保留。
- Docker 生产部署默认用 gunicorn；本地 `python main.py` 只是开发/调试入口。
- 重置管理员密码只临时设置 `RESET_ADMIN_PASSWORD=1`，重置完成后改回 `0`。

## 安全边界

- 不把真实 `OSDWAN_TOKEN`、`SANGFOR_AC_SHARED_SECRET`、联软账号密码、钉钉 AppSecret、管理员密码写进代码、README、AGENTS 或提交记录。
- 示例配置使用占位符或变量名，不使用真实值。
- 调试外部接口时可以打印结构、字段和数量，但不要打印完整 token、cookie、密码或密钥。
- 线上问题优先通过日志、健康检查和只读接口定位，避免直接修改服务器数据文件。
