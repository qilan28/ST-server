# Cloudflare Tunnels 配置指南

## 概述

Cloudflare Tunnels 允许您将本地运行的 ST-server 安全地发布到互联网，无需公共 IP 地址或复杂的端口转发。本文档将指导您如何正确配置 Cloudflare Tunnels 与 ST-server。

## 常见问题

```
错误: dial tcp [::1]:8001: connect: connection refused
```

这个错误表示 Cloudflare Tunnel 尝试连接到 `localhost:8001`，但该端口没有服务在监听。

## 配置步骤

### 1. 安装 Cloudflare Tunnel

如果您尚未安装 cloudflared，请按照以下步骤安装：

- [Windows 下载](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi)
- [Mac 下载](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz)
- [Linux 下载](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64)

或使用 Package Manager:
```bash
# Homebrew (Mac)
brew install cloudflare/cloudflare/cloudflared

# 在 Linux 上
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

### 2. 登录到 Cloudflare

```bash
cloudflared tunnel login
```

这会打开浏览器窗口，让您选择要使用的域名。

### 3. 创建隧道

```bash
cloudflared tunnel create st-server
```

这将创建一个隧道并生成证书文件。

### 4. 配置隧道

创建配置文件 `config.yml`：

```yaml
tunnel: <您的隧道ID>
credentials-file: <路径到您的证书JSON文件>

# 重要配置：将流量路由到 ST-server 的 3000 端口
ingress:
  - hostname: your-domain.example.com
    service: http://localhost:3000
  - service: http_status:404
```

> **重要提示**: 默认情况下，ST-server 在端口 3000 上运行。指向这个端口而不是 Nginx 端口通常可以解决许多连接问题。

### 5. 路由 DNS 记录

```bash
cloudflared tunnel route dns <隧道名> <子域名>
```

例如：
```bash
cloudflared tunnel route dns st-server st.yourdomain.com
```

### 6. 在 ST-server 中配置 Cloudflare Tunnel 域名

1. 登录管理员面板
2. 进入 Nginx 配置部分
3. 在 "Cloudflare 隧道域名" 字段中输入您的域名 (例如 `st.yourdomain.com`)
4. 保存配置

### 7. 运行隧道

```bash
cloudflared tunnel run st-server
```

## 高级配置：特定端口问题解决方案

如果您遇到 Cloudflare Tunnel 尝试连接到特定端口（如 8001）的问题：

### 方案 A: 配置隧道指向正确端口

修改您的 `config.yml`：
```yaml
ingress:
  - hostname: your-domain.example.com
    service: http://localhost:3000  # ST-server 默认端口
  - service: http_status:404
```

### 方案 B: 使用代理服务器转发端口

如果方案 A 不起作用，您可以设置一个本地代理，将 8001 端口的流量转发到 3000 端口。

#### 使用 nginx 进行转发:

```nginx
server {
    listen 8001;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 故障排除

### 运行诊断脚本

```bash
node scripts/cloudflare-tunnel-check.js
```

这将检查端口状态和配置，并提供解决建议。

### 通用故障排除步骤

1. **检查端口是否正在监听**
   ```bash
   # Windows
   netstat -an | findstr "3000 8001"
   
   # Linux/Mac
   netstat -an | grep "3000\|8001"
   ```

2. **检查隧道日志**
   查看 cloudflared 输出的日志，寻找连接失败的详细信息。

3. **尝试不同的端口绑定**
   如果特定端口有问题，尝试在 config.yml 中使用不同的端口。

## 最佳实践

1. **直接连接到应用**
   - 尽可能直接将 Cloudflare Tunnel 指向应用程序（端口 3000），而不是通过 Nginx 代理。
   
2. **检查防火墙**
   - 确保本地防火墙没有阻止 localhost 连接。

3. **使用 HTTPS**
   - Cloudflare Tunnels 自动提供 HTTPS，无需额外配置。

4. **定期更新**
   - 保持 cloudflared 更新到最新版本。

---

如需进一步支持，请查看 [Cloudflare Tunnels 官方文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/)。
