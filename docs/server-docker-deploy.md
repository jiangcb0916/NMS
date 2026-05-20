# 服务器 Docker 部署文档

本文档适用于在 x86 Linux 服务器上直接构建并部署 `sangfor-next` 项目。服务器负责拉取代码、构建镜像、启动容器；应用数据通过服务器本地 `instance` 目录挂载保存。

## 1. 部署结构

推荐服务器目录：

```text
/opt/sangfor-next
├── Dockerfile
├── docker-compose.yml
├── .env
└── instance/
    ├── network_management_next.db
    └── flask_session/
```

挂载关系：

```text
服务器 /opt/sangfor-next/instance
        ↓
容器   /app/instance
```

因此数据库实际保存在服务器：

```text
/opt/sangfor-next/instance/network_management_next.db
```

`instance` 和 `.env` 不提交 GitHub，也不打进镜像。

## 2. 服务器准备

安装 Docker 和 Docker Compose 插件后确认：

```bash
docker version
docker compose version
```

如果只有旧版命令，后续命令中的 `docker compose` 可替换为 `docker-compose`。

确认服务器架构：

```bash
uname -m
```

x86 服务器通常输出：

```text
x86_64
```

## 3. 拉取代码

首次部署：

```bash
cd /opt
git clone 你的仓库地址 sangfor-next
cd /opt/sangfor-next
```

如果已经部署过：

```bash
cd /opt/sangfor-next
git pull
```

## 4. 准备环境变量

在服务器项目目录创建 `.env`：

```bash
cd /opt/sangfor-next
cp .env.example .env
vim .env
```

至少修改：

```env
HOST=0.0.0.0
PORT=5001
HOST_PORT=5001
DEBUG=false

SECRET_KEY=替换成随机长字符串

ADMIN_USERNAME=admin
ADMIN_PASSWORD=替换成管理员密码
ADMIN_FULL_NAME=系统管理员
ADMIN_EMAIL=
RESET_ADMIN_PASSWORD=0
```

生成 `SECRET_KEY`：

```bash
openssl rand -hex 32
```

外部接口按实际环境填写：

```env
PROMETHEUS_QUERY_URL=http://172.16.80.125:9090/api/v1/query
PROMETHEUS_METRICS_URL=http://172.16.80.125:9191/metrics
PROMETHEUS_TARGETS_URL=http://172.16.80.125:9090/api/v1/targets

WIRELESS_INSTANCE=172.16.100.7
WIRELESS_JOB=ND
WIRELESS_AUTH=nac
WIRELESS_MODULE=mgmt,private

SWITCH_PROMETHEUS_JOB=sw
SWITCH_TARGET_GROUP=pool-sw
SWITCH_TRAFFIC_RATE_WINDOW=5m
SWITCH_PORT_EXCLUDE_PATTERNS=^(InLoopBack|LoopBack|NULL|Console|MEth|Vlanif|Vlan-interface|Stack-Port|Aux|Tunnel)

HUAWEI_SNMP_URL=http://172.16.80.125:9116/snmp
HUAWEI_SNMP_AUTH=secure_v3
HUAWEI_SNMP_MODULE=hw_health
HUAWEI_FIREWALL_TARGET=172.16.100.3
HUAWEI_PROMETHEUS_JOB=USG
HUAWEI_TOTAL_BANDWIDTH_MBPS=450

OSDWAN_API_BASE_URL=https://api.wanflow.com
OSDWAN_CONSOLE_ORIGIN=https://console.wanflow.com
OSDWAN_TOKEN=
OSDWAN_NODE_ID=2168
OSDWAN_NODE_NAME=办公开发
OSDWAN_NODE_STATS_PERIOD=6hours
OSDWAN_NODE_VIEW_TYPE=total

SANGFOR_AC_HOST=
SANGFOR_AC_PORT=9999
SANGFOR_AC_SHARED_SECRET=

DINGTALK_APPKEY=
DINGTALK_APPSECRET=

ACCESS_CONTROL_API_URL=
ACCESS_CONTROL_API_USERNAME=
ACCESS_CONTROL_API_PASSWORD=
ACCESS_CONTROL_FILTER_DEPARTMENT=LDAP
```

如果服务器 `5001` 端口已被占用，只改宿主机端口：

```env
HOST_PORT=8080
```

容器内 `PORT=5001` 保持不变。

## 5. 准备数据目录

如果是全新部署：

```bash
cd /opt/sangfor-next
mkdir -p instance
```

系统第一次启动会自动初始化数据库。

如果要使用本地已有数据，先在本地 Mac 停止项目服务，避免 SQLite 写入中复制：

```bash
lsof -nP -iTCP:5001 -sTCP:LISTEN
kill 对应PID
```

本地打包：

```bash
cd /Users/jiangcb/Desktop/技术/app/sangfor-next
tar -czf /tmp/sangfor-next-instance.tar.gz instance
```

上传到服务器：

```bash
scp /tmp/sangfor-next-instance.tar.gz 用户名@服务器IP:/tmp/
```

服务器解压：

```bash
cd /opt/sangfor-next
docker compose down
tar -xzf /tmp/sangfor-next-instance.tar.gz -C /opt/sangfor-next
ls -lh instance
```

确认存在：

```text
instance/network_management_next.db
```

## 6. 构建镜像

服务器本地构建：

```bash
cd /opt/sangfor-next
docker compose build web
```

这里的 `web` 是 `docker-compose.yml` 里的服务名：

```yaml
services:
  web:
```

如果只有一个服务，也可以执行：

```bash
docker compose build
```

如果构建卡在 `apt-get update` 或 `pip install`，通常是服务器访问 Debian 或 PyPI 源较慢。可以临时把 `Dockerfile` 中的 apt 和 pip 源改成内网可访问的镜像源后再构建。

当前 `Dockerfile` 中的 apt 安装段可以改为：

```dockerfile
RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.aliyun.com/debian|g; s|http://deb.debian.org/debian-security|http://mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends curl iputils-ping \
    && rm -rf /var/lib/apt/lists/*
```

当前 `Dockerfile` 中的 pip 安装段可以改为：

```dockerfile
RUN pip install -i https://pypi.tuna.tsinghua.edu.cn/simple --trusted-host pypi.tuna.tsinghua.edu.cn -r requirements.txt
```

如果公司内网有自己的 Debian 或 PyPI 镜像源，优先使用内网源。

## 7. 启动容器

构建完成后启动：

```bash
docker compose up -d
```

查看状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f web
```

容器启动时会自动执行：

```bash
python scripts/init_db.py
```

它会创建数据库表并初始化管理员。数据库已存在时，不会覆盖已有管理员密码。

## 8. 访问验证

如果 `HOST_PORT=5001`：

```text
http://服务器IP:5001
```

健康检查：

```bash
curl http://127.0.0.1:5001/api/health
```

正常返回类似：

```json
{"code":0,"data":{"database":"configured","status":"ok","version":"v5.0.0-alpha"},"message":"success"}
```

如果 `HOST_PORT=8080`，则访问：

```text
http://服务器IP:8080
```

健康检查也改成：

```bash
curl http://127.0.0.1:8080/api/health
```

## 9. 管理员密码重置

如果登录提示密码不对，通常是因为挂载的 `instance` 数据库里已经存在管理员账号，`.env` 中的 `ADMIN_PASSWORD` 不会自动覆盖旧密码。

临时修改 `.env`：

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=新管理员密码
RESET_ADMIN_PASSWORD=1
```

重建容器让环境变量生效：

```bash
docker compose up -d --force-recreate
docker compose logs -f web
```

登录确认成功后，立刻改回：

```env
RESET_ADMIN_PASSWORD=0
```

再执行一次：

```bash
docker compose up -d --force-recreate
```

原因是 `RESET_ADMIN_PASSWORD=1` 表示每次容器启动都重置管理员密码。生产环境不要长期保持开启。

## 10. 推送到 Harbor

如果需要把服务器构建出的镜像推送到 Harbor，当前 Harbor 地址和项目为：

```text
172.16.80.126/nms
```

确认 `docker-compose.yml` 中镜像名为：

```yaml
services:
  web:
    build:
      context: .
    image: 172.16.80.126/nms/sangfor-next:latest
```

登录 Harbor：

```bash
docker login 172.16.80.126
```

推送：

```bash
docker compose push web
```

或手动推送：

```bash
docker push 172.16.80.126/nms/sangfor-next:latest
```

如果 Harbor 使用 HTTP，服务器 Docker 可能报：

```text
http: server gave HTTP response to HTTPS client
```

需要配置 insecure registry：

```bash
sudo vim /etc/docker/daemon.json
```

内容示例：

```json
{
  "insecure-registries": ["172.16.80.126"]
}
```

重启 Docker：

```bash
sudo systemctl restart docker
```

然后重新登录并推送：

```bash
docker login 172.16.80.126
docker compose push web
```

## 11. 日常更新

本地修改代码并推送 GitHub 后，服务器执行：

```bash
cd /opt/sangfor-next
git pull
docker compose build web
docker compose up -d
docker compose logs -f web
```

如果需要同步镜像到 Harbor：

```bash
docker compose push web
```

不要删除 `instance` 目录，否则本地 SQLite 数据会丢失。

## 12. 备份和恢复

备份：

```bash
cd /opt/sangfor-next
tar -czf sangfor-next-backup-$(date +%F).tar.gz instance/
```

恢复：

```bash
cd /opt/sangfor-next
docker compose down
tar -xzf sangfor-next-backup-日期.tar.gz -C /opt/sangfor-next
docker compose up -d
```

## 13. 常用命令

```bash
docker compose ps
docker compose logs -f web
docker compose logs --tail=200 web
docker compose restart web
docker compose down
docker compose build web
docker compose up -d
```

查看容器环境变量：

```bash
docker compose exec web sh -c 'env | sort'
```

进入容器：

```bash
docker compose exec web sh
```

测试容器访问 Prometheus：

```bash
docker compose exec web sh -c 'curl -s "http://172.16.80.125:9090/api/v1/query?query=up" | head'
```

测试容器访问 SNMP exporter：

```bash
docker compose exec web sh -c 'curl -s "http://172.16.80.125:9116/snmp?auth=secure_v3&module=hw_health&target=172.16.100.3" | head'
```

## 14. 推荐完整流程

首次部署：

```text
服务器安装 Docker
→ /opt/sangfor-next 拉取代码
→ 创建 .env
→ 准备 instance 或上传本地 instance
→ docker compose build web
→ docker compose up -d
→ curl /api/health 验证
→ 登录系统
```

后续更新：

```text
本地改代码并推送 GitHub
→ 服务器 git pull
→ docker compose build web
→ docker compose up -d
→ docker compose logs -f web
```
