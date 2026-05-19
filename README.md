# Sangfor NMS Next

基于旧版 `sangfor` 项目重构的网络管理系统。新项目保留旧系统里的核心数据和外部接口配置，去掉 OpenVPN 相关功能，并把配置统一迁移到环境变量。

## 当前功能

- 登录、登出、当前用户资料
- 用户管理：新增、编辑、重置密码、锁定、解锁
- 设备列表：搜索、分类筛选、新增、编辑、删除、状态检测、CSV 导入导出
- 客户端列表：分页、搜索、姓名解析
- 缓存管理：姓名缓存、设备系统缓存状态
- 无线控制器状态：AP、SSID、在线用户等固定 Prometheus label 查询数据
- 外部接口状态检查：深信服 AC、无线 Prometheus 查询、用户名 Metrics、钉钉、联软准入
- 旧数据迁移：用户、设备、姓名缓存、设备系统缓存

## 技术栈

- Python 3.9+
- Flask
- Flask-Login
- Flask-Session
- Flask-SQLAlchemy
- SQLite 默认本地存储
- 原生 JavaScript + CSS

## 目录结构

```text
app/
  common/          通用响应、校验、错误处理
  models/          SQLAlchemy 数据模型
  modules/         业务模块和接口
static/            前端 CSS/JS
templates/         页面模板
scripts/           初始化、迁移、冒烟测试脚本
instance/          本地数据库和会话文件，不提交 Git
```

## 快速开始

```bash
cd sangfor-next

python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
python scripts/init_db.py
python main.py
```

默认访问地址：

```text
http://127.0.0.1:5001
```

如果没有设置 `ADMIN_PASSWORD`，初始化脚本会生成一个临时管理员密码并打印到终端。

## Docker 部署

项目已提供 `Dockerfile`、`docker-compose.yml` 和 `.dockerignore`。Docker 部署默认使用 gunicorn 启动 Flask，SQLite 数据库和 session 文件会保存在宿主机 `./instance` 目录。

1. 准备环境变量：

```bash
cp .env.example .env
```

至少修改这些值：

```env
HOST=0.0.0.0
PORT=5001
HOST_PORT=5001
DEBUG=false
SECRET_KEY=replace-with-a-random-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-admin-password
```

生产或内网环境还需要按实际情况填写：

```env
SANGFOR_AC_HOST=
SANGFOR_AC_PORT=9999
SANGFOR_AC_SHARED_SECRET=
DINGTALK_APPKEY=
DINGTALK_APPSECRET=
PROMETHEUS_QUERY_URL=http://172.16.80.125:9090/api/v1/query
PROMETHEUS_METRICS_URL=http://172.16.80.125:9191/metrics
WIRELESS_INSTANCE=172.16.100.7
WIRELESS_AUTH=nac
WIRELESS_MODULE=mgmt,private
ACCESS_CONTROL_API_URL=
ACCESS_CONTROL_API_USERNAME=
ACCESS_CONTROL_API_PASSWORD=
```

2. 构建并启动：

```bash
docker compose up -d --build
```

如果服务器上没有 `docker compose` 插件，但有旧版 `docker-compose` 命令，把后续命令里的 `docker compose` 替换成 `docker-compose`。

3. 查看启动日志：

```bash
docker compose logs -f web
```

容器启动时会自动执行：

```bash
python scripts/init_db.py
```

如果数据库不存在，会自动建表并初始化管理员。如果管理员已经存在，不会覆盖密码；需要重置管理员密码时，在 `.env` 中临时设置：

```env
RESET_ADMIN_PASSWORD=1
ADMIN_PASSWORD=new-admin-password
```

然后执行：

```bash
docker compose up -d
docker compose logs -f web
```

确认重置完成后，建议把 `RESET_ADMIN_PASSWORD` 改回 `0`。

4. 访问系统：

```text
http://服务器IP:5001
```

如果需要把宿主机端口改成 `8080`，只改 `.env` 里的 `HOST_PORT=8080`，容器内 `PORT` 保持 `5001`。

5. 常用维护命令：

```bash
docker compose ps
docker compose restart web
docker compose logs --tail=200 web
docker compose down
```

6. 备份本地 SQLite 数据：

```bash
tar -czf sangfor-nms-backup-$(date +%F).tar.gz instance/
```

如果需要从旧项目迁移数据，建议先把旧库复制到 `./instance/legacy-network_management.db`，然后在 `.env` 中设置：

```env
LEGACY_DATABASE_PATH=/app/instance/legacy-network_management.db
```

再在容器里执行：

```bash
docker compose exec web python scripts/migrate_legacy_data.py
```

## 环境变量

项目启动时会自动读取根目录 `.env`，系统环境变量优先级高于 `.env`。上传 GitHub 时不要提交 `.env`。

常用配置：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `HOST` | 本地监听地址 | `127.0.0.1` |
| `PORT` | 本地监听端口 | `5001` |
| `HOST_PORT` | Docker 部署时宿主机暴露端口 | `5001` |
| `DEBUG` | 调试模式 | `false` |
| `SECRET_KEY` | Flask 会话密钥，生产环境必须替换 | 无 |
| `DATABASE_URL` | 数据库连接地址 | `sqlite:///instance/network_management_next.db` |
| `GUNICORN_WORKERS` | Docker 下 gunicorn worker 数量 | `2` |
| `GUNICORN_THREADS` | Docker 下 gunicorn 每个 worker 线程数 | `4` |
| `GUNICORN_TIMEOUT` | Docker 下 gunicorn 请求超时秒数 | `120` |
| `SANGFOR_AC_HOST` | 深信服 AC 地址 | 空 |
| `SANGFOR_AC_PORT` | 深信服 AC 端口 | `9999` |
| `SANGFOR_AC_SHARED_SECRET` | 深信服 AC 共享密钥 | 空 |
| `DINGTALK_APPKEY` | 钉钉应用 AppKey | 空 |
| `DINGTALK_APPSECRET` | 钉钉应用 AppSecret | 空 |
| `PROMETHEUS_QUERY_URL` | Prometheus 查询接口，无线 AP/SSID/在线用户主数据使用此接口 | `http://172.16.80.125:9090/api/v1/query` |
| `PROMETHEUS_METRICS_URL` | Prometheus metrics 文本接口，仅用于 `/api/statistics/user-names` 解析用户名 | `http://172.16.80.125:9191/metrics` |
| `WIRELESS_INSTANCE` | 无线固定查询 `instance` label | `172.16.100.7` |
| `WIRELESS_JOB` | 无线固定查询 `job` label | `ND` |
| `WIRELESS_AUTH` | 无线固定查询 `auth` label | `nac` |
| `WIRELESS_MODULE` | 无线固定查询 `module` label | `mgmt,private` |
| `HUAWEI_SNMP_URL` | 华为防火墙 SNMP exporter 接口，Dashboard 带宽卡片使用 | `http://172.16.80.125:9116/snmp` |
| `HUAWEI_SNMP_AUTH` | 华为防火墙 SNMP exporter auth 参数 | `secure_v3` |
| `HUAWEI_SNMP_MODULE` | 华为防火墙 SNMP exporter module 参数 | `hw_health` |
| `HUAWEI_FIREWALL_TARGET` | 华为防火墙 SNMP 目标地址 | `172.16.100.3` |
| `HUAWEI_PROMETHEUS_JOB` | 华为防火墙 Prometheus 查询使用的 `job` label | `USG` |
| `HUAWEI_TOTAL_BANDWIDTH_MBPS` | 防火墙总带宽容量，Dashboard 计算占用率使用 | `450` |
| `ACCESS_CONTROL_API_URL` | 联软准入接口地址 | 空 |
| `ACCESS_CONTROL_API_USERNAME` | 联软准入账号 | 空 |
| `ACCESS_CONTROL_API_PASSWORD` | 联软准入密码 | 空 |
| `ACCESS_CONTROL_FILTER_DEPARTMENT` | 客户端列表过滤部门 | `LDAP` |
| `DEVICE_STATUS_CHECK_INTERVAL` | 设备状态检测间隔秒数 | `300` |
| `DEVICE_STATUS_PING_TIMEOUT` | 单台设备 Ping 超时秒数 | `1` |

初始化管理员相关变量：

| 变量 | 说明 |
| --- | --- |
| `ADMIN_USERNAME` | 初始化管理员用户名，默认 `admin` |
| `ADMIN_PASSWORD` | 初始化管理员密码 |
| `ADMIN_FULL_NAME` | 初始化管理员姓名 |
| `ADMIN_EMAIL` | 初始化管理员邮箱 |
| `RESET_ADMIN_PASSWORD` | 设为 `1` 时重置管理员密码 |

## 旧数据迁移

从旧项目迁移本地 SQLite 数据：

```bash
python scripts/migrate_legacy_data.py
```

默认读取同级目录：

```text
../sangfor/instance/network_management.db
```

也可以用 `LEGACY_DATABASE_PATH` 指定旧库路径：

```bash
LEGACY_DATABASE_PATH=/path/to/network_management.db python scripts/migrate_legacy_data.py
```

迁移内容包括用户、设备列表、用户姓名缓存和设备 OS 缓存。OpenVPN 相关历史表不会迁入。

## 设备 CSV 导入

设备列表支持 CSV 导入。推荐表头：

```csv
username,ip_address,mac_address,category,details
```

也兼容常见中文表头：

```csv
名称,IP地址,MAC地址,分类,备注
```

导入时以 `ip_address` 判断是否已存在：存在则更新，不存在则新增。

## 本地验证

```bash
python -m compileall app scripts
node --check static/js/app.js
python scripts/smoke_test.py
```

如果 macOS 本地 Python 缓存目录没有权限，可以这样跑编译检查：

```bash
PYTHONPYCACHEPREFIX=/private/tmp/sangfor-next-pycache python -m compileall app scripts
```

## 上传 GitHub 前检查

- 不提交 `.env`
- 不提交 `instance/`
- 不提交本地数据库、会话文件、日志
- 使用 `.env.example` 说明配置项
- 确认 `SECRET_KEY`、外部接口账号、密码、Token 没有写进代码或 README
- 上传前运行 `scripts/smoke_test.py`
