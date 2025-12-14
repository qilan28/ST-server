# Nginx 反向代理配置指南

本指南将帮助您配置 Nginx 反向代理，使用户能够通过路径访问各自的 SillyTavern 实例，而不是通过独立的端口。

## 📋 访问方式对比

### 直接端口访问（默认）
- 管理平台：`http://localhost:3000`
- 用户 alice 的 ST：`http://localhost:3001`
- 用户 bob 的 ST：`http://localhost:3002`

**缺点：** 需要开放多个端口，防火墙配置复杂

### Nginx 路径转发（推荐）
- 管理平台：`http://yourdomain.com`
- 用户 alice 的 ST：`http://yourdomain.com/alice/st`
- 用户 bob 的 ST：`http://yourdomain.com/bob/st`

**优点：** 只需开放一个端口（80 或 443），统一域名访问

---

## 🚀 快速开始

### 1. 安装 Nginx

#### Windows
下载并安装 Nginx：https://nginx.org/en/download.html

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install nginx
```

#### Linux (CentOS/RHEL)
```bash
sudo yum install nginx
```

### 2. 在管理员面板配置 Nginx

1. 创建管理员账户（如果还没有）：
   ```bash
   npm run create-admin
   ```

2. 启动服务器：
   ```bash
   npm start
   ```

3. 登录管理员面板：`http://localhost:3000/admin.html`

4. 在 **⚙️ 系统配置** 区域设置：
   - **启用 Nginx 模式**：打开开关
   - **域名**：输入您的域名（例如：`yourdomain.com`）
   - **端口**：输入 Nginx 监听端口（默认 `80`）

5. 点击 **保存配置**

> **注意：** 配置保存在 `config.json` 文件中，不再使用 `.env` 文件。

### 3. 生成 Nginx 配置文件

**方法 1：通过管理员面板（推荐）**

在管理员面板的配置区域，点击 **生成 Nginx 配置文件** 按钮。

**方法 2：通过命令行**

运行配置生成脚本：

```bash
npm run generate-nginx
```

这将生成 `nginx/nginx.conf` 文件，包含所有用户的代理配置。

### 4. 部署 Nginx 配置

#### 🚀 自动部署（Linux 推荐）

使用一键部署脚本，自动完成所有配置步骤：

```bash
npm run deploy-nginx
```

这个脚本会自动：
- ✅ 备份现有配置
- ✅ 复制新配置到 Nginx 目录
- ✅ 创建符号链接（如需要）
- ✅ 测试配置语法
- ✅ 重载 Nginx 服务

完成后直接可以访问！

---

#### 手动部署

#### Windows
1. 复制生成的配置文件：
   ```bash
   copy nginx\nginx.conf C:\nginx\conf\nginx.conf
   ```

2. 测试配置：
   ```bash
   cd C:\nginx
   nginx -t
   ```

3. 启动/重载 Nginx：
   ```bash
   # 启动
   start nginx
   
   # 重载配置
   nginx -s reload
   ```

#### Linux
1. 复制生成的配置文件：
   ```bash
   sudo cp nginx/nginx.conf /etc/nginx/sites-available/sillytavern
   sudo ln -s /etc/nginx/sites-available/sillytavern /etc/nginx/sites-enabled/
   ```

2. 测试配置：
   ```bash
   sudo nginx -t
   ```

3. 重载 Nginx：
   ```bash
   sudo systemctl reload nginx
   ```

---

## 🔧 配置说明

### 自动生成的配置

生成脚本会为每个用户创建：

1. **Upstream 定义** - 指向用户的实际端口
   ```nginx
   upstream st_alice {
       server 127.0.0.1:3001;
   }
   ```

2. **Location 块** - 路径转发规则
   ```nginx
   location /alice/st/ {
       proxy_pass http://st_alice/;
       # ... 其他代理设置
   }
   ```

### WebSocket 支持

配置已包含 WebSocket 支持，确保聊天功能正常工作：

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
```

### 路径重写

自动移除路径前缀，用户访问 `/alice/st/` 会被转发到实际的 `/`：

```nginx
rewrite ^/alice/st/(.*) /$1 break;
```

---

## 🔐 HTTPS 配置（推荐）

### 使用 Let's Encrypt（免费 SSL 证书）

#### 1. 安装 Certbot

**Ubuntu/Debian:**
```bash
sudo apt install certbot python3-certbot-nginx
```

**CentOS/RHEL:**
```bash
sudo yum install certbot python3-certbot-nginx
```

#### 2. 获取证书

```bash
sudo certbot --nginx -d yourdomain.com
```

按照提示完成操作，Certbot 会自动配置 HTTPS。

#### 3. 自动续期

Let's Encrypt 证书有效期为 90 天，设置自动续期：

```bash
sudo certbot renew --dry-run
```

### 手动 HTTPS 配置

如果您有自己的 SSL 证书：

1. 修改 `nginx/nginx.conf`，启用 HTTPS server 块

2. 配置证书路径：
   ```nginx
   server {
       listen 443 ssl http2;
       server_name yourdomain.com;
       
       ssl_certificate /path/to/certificate.crt;
       ssl_certificate_key /path/to/private.key;
       
       # ... 其他配置
   }
   ```

---

## 🔄 更新配置

### 更改 Nginx 设置

1. 登录管理员面板
2. 在 **⚙️ 系统配置** 区域修改设置
3. 点击 **保存配置**
4. 点击 **生成 Nginx 配置文件**
5. 重载 Nginx

### 添加或删除用户后

每次添加或删除用户后，需要重新生成 Nginx 配置：

**通过管理员面板：**
1. 点击 **生成 Nginx 配置文件** 按钮
2. 按照提示重载 Nginx

**通过命令行：**
```bash
# 1. 生成新配置
npm run generate-nginx

# 2. 部署配置（Linux）
sudo cp nginx/nginx.conf /etc/nginx/sites-available/sillytavern

# 3. 测试配置
sudo nginx -t

# 4. 重载 Nginx
sudo systemctl reload nginx
```

### 自动化脚本（可选）

创建一个自动化脚本 `scripts/update-nginx.sh`：

```bash
#!/bin/bash
npm run generate-nginx
sudo cp nginx/nginx.conf /etc/nginx/sites-available/sillytavern
sudo nginx -t && sudo systemctl reload nginx
```

---

## 🌐 域名配置

### 使用自己的域名

1. 在域名提供商处添加 A 记录：
   ```
   类型: A
   主机: @
   值: 您的服务器 IP
   ```

2. 等待 DNS 传播（通常几分钟到几小时）

3. 更新 `.env` 文件：
   ```bash
   NGINX_DOMAIN=yourdomain.com
   ```

4. 重新生成配置并重载 Nginx

### 使用子域名

如果想使用 `st.yourdomain.com`：

1. 添加 A 记录：
   ```
   类型: A
   主机: st
   值: 您的服务器 IP
   ```

2. 更新配置中的 `server_name`

---

## 🐛 故障排查

### 问题 1: 502 Bad Gateway

**原因：** 后端服务未运行

**解决：**
```bash
# 检查管理平台是否运行
npm start

# 检查 PM2 实例
pm2 list
```

### 问题 2: 404 Not Found

**原因：** 用户实例未启动或配置未生成

**解决：**
1. 确保用户实例正在运行
2. 重新生成 Nginx 配置：`npm run generate-nginx`
3. 重载 Nginx

### 问题 3: WebSocket 连接失败

**原因：** 缺少 Upgrade 头或超时设置

**解决：**
确保配置包含：
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
proxy_read_timeout 86400;
```

### 问题 4: 静态资源 404

**原因：** 路径重写问题

**解决：**
检查 rewrite 规则是否正确：
```nginx
rewrite ^/username/st/(.*) /$1 break;
```

---

## 📊 性能优化

### 启用 Gzip 压缩

在 `http` 块中添加：

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript 
           application/json application/javascript application/xml+rss;
```

### 配置缓存

对于静态资源：

```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 7d;
    add_header Cache-Control "public, immutable";
}
```

### 限制请求速率

防止滥用：

```nginx
limit_req_zone $binary_remote_addr zone=mylimit:10m rate=10r/s;

server {
    location / {
        limit_req zone=mylimit burst=20;
        # ...
    }
}
```

---

## 📝 维护建议

1. **定期备份配置**
   ```bash
   sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
   ```

2. **监控日志**
   ```bash
   # 访问日志
   sudo tail -f /var/log/nginx/access.log
   
   # 错误日志
   sudo tail -f /var/log/nginx/error.log
   ```

3. **定期更新配置**
   - 添加新用户后立即更新
   - 删除用户后清理配置

4. **安全检查**
   - 定期更新 Nginx 版本
   - 检查 SSL 证书有效期
   - 审查访问日志

---

## 🔗 相关链接

- [Nginx 官方文档](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Nginx 性能优化](https://www.nginx.com/blog/tuning-nginx/)

---

## ❓ 常见问题

### Q: 必须使用 Nginx 吗？

A: 不是必须的。默认的直接端口访问方式也可以正常使用。Nginx 主要用于：
- 统一访问域名
- 简化防火墙规则
- 提供 HTTPS 支持
- 负载均衡和缓存

### Q: 可以同时支持两种访问方式吗？

A: 可以。即使启用了 Nginx，用户仍然可以通过原端口直接访问（如果端口开放的话）。

### Q: 更改域名需要做什么？

A: 
1. 更新 `.env` 中的 `NGINX_DOMAIN`
2. 运行 `npm run generate-nginx`
3. 重载 Nginx 配置

### Q: 支持多个域名吗？

A: 支持。可以在 `server_name` 中添加多个域名：
```nginx
server_name domain1.com domain2.com;
```

---

**配置完成后，记得重启管理平台以使环境变量生效！**

```bash
# 重启管理平台
npm start
```
