# Nginx 配置加载修复指南

此指南解决了 SillyTavern 多开管理平台在启动和重启实例时 Nginx 配置没有正确加载的问题，以及修复相关的 400 Bad Request 错误。

## 修复的问题

1. **Nginx 配置未正确加载**：导致用户实例无法通过子路径访问
2. **400 Bad Request 错误**：出现 "The plain HTTP request was sent to HTTPS port" 错误提示
3. **Nginx 配置重复指令**：出现 "proxy_pass_request_headers directive is duplicate" 错误
4. **每次重启需要手动执行 `nginx -c` 命令**：操作繁琐且容易遗忘

## 自动修复工具

我们提供了以下自动修复工具，可以一键解决上述问题：

### Linux/Mac 用户

```bash
# 修复 Nginx 配置加载问题并确保使用正确配置
npm run ensure-nginx

# 修复 400 Bad Request 错误
npm run fix-nginx-400

# 修复 Nginx 配置重复指令错误
npm run fix-nginx-duplicate

# 如果重启前先停止 PM2 实例
npm run reset-pm2
npm run ensure-nginx
npm start
```

### Windows 用户

可以使用以下批处理文件：

- **`fix-nginx-all.bat`**：全面修复，包含：
  1. 重新生成 Nginx 配置
  2. 确保使用正确的配置文件
  3. 重启服务器

- **`fix-nginx-duplicate.bat`**：专门修复配置重复指令问题

## 手动修复步骤

如果自动修复工具无效，可以尝试以下手动步骤：

### 1. 停止现有 Nginx

```bash
nginx -s stop
```

### 2. 使用正确的配置启动 Nginx

```bash
nginx -c /root/ST-server/nginx/nginx.conf
```

### 3. 检查配置文件中是否有 SSL 相关问题

如果遇到 "The plain HTTP request was sent to HTTPS port" 错误，检查配置文件是否包含 SSL 相关配置但缺少证书：

```bash
grep "listen.*ssl" /root/ST-server/nginx/nginx.conf
```

如果存在 `listen 80 ssl;` 这样的配置但没有提供 SSL 证书，请删除 `ssl` 关键字：

```bash
sed -i 's/listen \([0-9]*\) ssl;/listen \1;/g' /root/ST-server/nginx/nginx.conf
```

### 4. 检查和修复重复指令问题

如果遇到 "proxy_pass_request_headers directive is duplicate" 错误，运行我们的修复工具：

```bash
# 检查 Nginx 配置是否有重复指令
npm run check-nginx

# 自动修复重复指令问题
npm run fix-nginx-duplicate
```

### 4. 测试配置

```bash
nginx -t -c /root/ST-server/nginx/nginx.conf
```

## 持久化解决方案

我们已经对 SillyTavern 多开管理平台进行了以下改进：

1. **启动脚本自动化**：服务器启动时会自动检查并加载正确的 Nginx 配置
2. **实例管理集成**：启动和重启实例时会自动确保 Nginx 使用正确配置
3. **端口变更处理**：当实例端口变更时，会自动重载 Nginx 配置
4. **配置错误检测**：自动检测并修复配置文件中的重复指令问题
5. **错误防护机制**：生成配置时避免产生重复指令

## 验证修复是否成功

修复成功后，应该能够：

1. 访问管理平台：`http://域名或IP:端口/`
2. 访问用户实例：`http://域名或IP:端口/用户名/st/`
3. 不再出现 400 Bad Request 错误

如果问题仍然存在，可以检查：

1. Nginx 错误日志：`sudo tail -f /var/log/nginx/error.log`
2. 管理平台日志：`pm2 logs`

## 重要提示

- 每次更改配置文件后，请运行 `npm run ensure-nginx` 确保使用最新配置
- 系统重启后，如果 Nginx 没有自动启动，请运行 `npm run ensure-nginx` 手动启动

如有任何问题，请参考 [README.md](./README.md) 或联系技术支持。
