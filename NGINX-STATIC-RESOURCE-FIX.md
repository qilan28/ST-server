# 🔧 Nginx 静态资源 404 问题修复方案

## 📋 问题描述

访问 `http://IP:7092/用户名/st/` 时，页面可以显示但 CSS、JS 等静态资源返回 404 错误。

**原因**：SillyTavern 使用绝对路径（如 `/scripts/script.js`）引用资源，在子路径下这些路径无法正确解析。

---

## ✅ 解决方案

已对 `scripts/generate-nginx-config.js` 进行了以下增强：

### 1. **关键改进：注入 Base 标签**

```nginx
sub_filter '<head>' '<head><base href="/用户名/st/">';
```

这是最可靠的解决方案！`<base>` 标签会告诉浏览器所有相对路径的基准 URL，确保：
- 所有 `src="scripts/xxx.js"` 自动变成 `/用户名/st/scripts/xxx.js`
- 所有 `href="css/xxx.css"` 自动变成 `/用户名/st/css/xxx.css`

### 2. **增强的 Sub_filter 规则**

覆盖了更多路径模式：
- HTML 属性：`src`, `href`, `action`, `data-src`
- CSS：`url()`, `@import`
- JavaScript：`fetch()`, `XMLHttpRequest.open()`
- 各种资源目录：`/scripts/`, `/css/`, `/lib/`, `/img/`, `/assets/`, `/public/`, `/data/`, `/uploads/`, `/user/`, `/thumbnail/`

### 3. **静态资源专门处理**

```nginx
location ~ ^/用户名/st/(scripts|css|lib|img|assets|public|data|uploads)/ {
    # 直接代理，不使用 sub_filter
    # 启用缓存，提高性能
    expires 7d;
}
```

**优点**：
- ✅ 静态文件不需要内容重写，性能更好
- ✅ 启用了 7 天缓存
- ✅ 关闭了不必要的缓冲

---

## 🚀 部署步骤

### 步骤 1：生成新的 Nginx 配置

```bash
cd /root/ST-server

# 重新生成配置（包含新的修复）
node scripts/generate-nginx-config.js

# 或使用 npm 命令
npm run generate-nginx
```

**输出示例**：
```
✅ Nginx 配置文件生成成功！
📁 输出路径: /root/ST-server/nginx/nginx.conf
```

### 步骤 2：测试配置

```bash
# 测试配置文件语法
sudo nginx -t -c /root/ST-server/nginx/nginx.conf
```

**应该看到**：
```
nginx: the configuration file /root/ST-server/nginx/nginx.conf syntax is ok
nginx: configuration file /root/ST-server/nginx/nginx.conf test is successful
```

### 步骤 3：停止现有 Nginx

```bash
# 方法 A：如果使用系统服务
sudo systemctl stop nginx

# 方法 B：直接停止
sudo nginx -s stop

# 方法 C：强制停止（如果上面的不工作）
sudo killall nginx
```

### 步骤 4：启动新配置的 Nginx

```bash
# 使用新配置启动
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 检查 Nginx 是否运行
ps aux | grep nginx
```

**应该看到类似**：
```
root     12345  ... nginx: master process nginx -c /root/ST-server/nginx/nginx.conf
www-data 12346  ... nginx: worker process
```

### 步骤 5：确保端口开放

```bash
# 开放 Nginx 端口（默认 7092）
sudo ufw allow 7092/tcp

# 查看防火墙状态
sudo ufw status
```

### 步骤 6：测试访问

在浏览器访问：
```
http://119.8.118.149:7092/123/st/
```

**检查清单**：
- [ ] 页面正常显示
- [ ] 样式正确应用（CSS 加载成功）
- [ ] 控制台无 404 错误（按 F12 查看）
- [ ] JavaScript 功能正常
- [ ] 图片正常显示

---

## 🔍 验证配置是否生效

### 方法 1：查看生成的配置

```bash
# 查看配置中是否包含 base 标签注入
grep -A 5 "sub_filter '<head>'" /root/ST-server/nginx/nginx.conf

# 应该看到：
# sub_filter '<head>' '<head><base href="/123/st/">';
```

### 方法 2：查看浏览器开发者工具

1. 按 F12 打开开发者工具
2. 切换到 "Network" (网络) 标签
3. 刷新页面
4. 查看所有请求的 URL

**成功的表现**：
```
✅ http://119.8.118.149:7092/123/st/scripts/script.js - 200 OK
✅ http://119.8.118.149:7092/123/st/css/style.css - 200 OK
✅ http://119.8.118.149:7092/123/st/lib/jquery.js - 200 OK
```

**失败的表现**：
```
❌ http://119.8.118.149:7092/scripts/script.js - 404 Not Found
```

### 方法 3：查看 HTML 源代码

1. 右键点击页面 → "查看页面源代码"
2. 查找 `<head>` 标签
3. 应该看到：

```html
<head><base href="/123/st/">
    <meta charset="UTF-8">
    ...
</head>
```

---

## ⚠️ 常见问题排查

### 问题 1：静态资源仍然 404

**可能原因**：
- Nginx 没有使用新配置
- sub_filter 没有生效（响应被压缩）

**解决方法**：
```bash
# 1. 确认 Nginx 进程使用的配置文件
ps aux | grep nginx

# 2. 重启 Nginx
sudo nginx -s stop
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 3. 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log

# 4. 测试特定资源
curl -v http://119.8.118.149:7092/123/st/scripts/script.js
```

### 问题 2：base 标签没有注入

**检查**：
```bash
# 测试 sub_filter 是否工作
curl http://119.8.118.149:7092/123/st/ | grep -o '<head>.*</head>' | head -c 200
```

**可能原因**：
- 响应的 Content-Type 不是 `text/html`
- `Accept-Encoding` 没有被正确设置为空

**解决**：
```bash
# 检查配置中是否有这两行
grep 'proxy_set_header Accept-Encoding ""' /root/ST-server/nginx/nginx.conf
grep 'sub_filter_types.*text/html' /root/ST-server/nginx/nginx.conf
```

### 问题 3：某些资源仍然无法加载

**可能原因**：资源路径不在静态资源 location 的匹配范围内

**解决**：
编辑 `scripts/generate-nginx-config.js`，在第 150 行附近添加新的路径：

```javascript
location ~ ^/${user.username}/st/(scripts|css|lib|img|assets|public|data|uploads|新路径)/ {
```

然后重新生成配置。

### 问题 4：页面功能异常

**检查**：
1. 浏览器控制台是否有 JavaScript 错误
2. 网络面板是否有失败的 API 请求

**解决**：
- 如果是 API 请求失败，检查 sub_filter 规则是否包含相应的 API 路径
- 如果是 WebSocket 连接失败，确认配置中有 WebSocket 支持（已包含）

### 问题 5：Nginx 无法启动

**检查错误信息**：
```bash
sudo nginx -t -c /root/ST-server/nginx/nginx.conf
```

**常见错误**：
1. **端口被占用**：
   ```bash
   # 查找占用端口的进程
   sudo lsof -i :7092
   # 停止占用端口的进程
   sudo kill -9 <PID>
   ```

2. **权限问题**：
   ```bash
   # 确保配置文件可读
   sudo chmod 644 /root/ST-server/nginx/nginx.conf
   ```

3. **日志目录不存在**：
   ```bash
   sudo mkdir -p /var/log/nginx
   sudo chown -R www-data:www-data /var/log/nginx
   ```

---

## 📊 性能影响

### sub_filter 的性能开销

**影响**：
- HTML/CSS/JS 响应需要缓冲和文本替换
- 禁用了 gzip 压缩（增加带宽使用）
- 首次加载可能慢 10-20%

**优化措施**：
1. ✅ 静态资源使用专门的 location 块（不使用 sub_filter）
2. ✅ 启用了 7 天缓存
3. ✅ 浏览器缓存会大幅减少后续请求

### 适用场景

- ✅ 小规模部署（< 100 用户）
- ✅ 需要统一入口和美观 URL
- ✅ 无法使用域名/子域名

### 不适用场景

- ❌ 大规模部署（> 100 用户）→ 推荐使用子域名方案
- ❌ 需要最佳性能 → 推荐使用直接端口访问

---

## 🔄 备选方案

如果此方案仍有问题，可以考虑：

### 方案 A：直接端口访问（最推荐）

```
用户 123: http://119.8.118.149:3001/
用户 456: http://119.8.118.149:3002/
```

**优点**：100% 兼容，零问题

**实施**：
1. 停止使用 Nginx
2. 开放端口范围：`sudo ufw allow 3001:4000/tcp`
3. 用户直接访问自己的端口

### 方案 B：子域名转发（需要域名）

```
用户 123: http://123.yourdomain.com/
用户 456: http://456.yourdomain.com/
```

**优点**：URL 美观 + 100% 兼容

**实施**：
1. 配置 DNS 通配符：`*.yourdomain.com → IP`
2. 修改 nginx 配置使用子域名

---

## 📝 技术说明

### 为什么需要 Base 标签？

**问题**：SillyTavern 的 HTML 中包含两种路径引用：

1. **绝对路径**：`<script src="/scripts/script.js"></script>`
   - sub_filter 可以重写

2. **相对路径**：`<script src="scripts/script.js"></script>`
   - sub_filter 无法识别（没有 `/` 开头）
   - 浏览器会基于当前 URL 解析

**Base 标签的作用**：

```html
<head><base href="/123/st/">
```

告诉浏览器：
- 所有相对路径都基于 `/123/st/`
- `scripts/script.js` → `/123/st/scripts/script.js` ✅
- `../images/logo.png` → `/123/st/../images/logo.png` → `/123/images/logo.png` ✅

### Sub_filter 的工作原理

1. Nginx 接收后端响应
2. 缓冲整个响应体
3. 在文本中查找匹配的字符串
4. 替换为新字符串
5. 发送修改后的响应给客户端

**限制**：
- 只能处理文本内容
- 无法处理已压缩的响应
- 无法处理动态生成的路径（如 JavaScript 字符串拼接）

---

## 🎉 总结

**已实现的改进**：
1. ✅ 注入 Base 标签（最关键）
2. ✅ 增强的 sub_filter 规则（覆盖更多场景）
3. ✅ 静态资源专门处理（优化性能）
4. ✅ 启用缓存（减少重复加载）

**预期效果**：
- ✅ 所有静态资源正确加载
- ✅ 页面功能完整可用
- ✅ WebSocket 正常工作
- ✅ API 请求成功

**部署命令**：
```bash
# 1. 生成配置
node scripts/generate-nginx-config.js

# 2. 测试配置
sudo nginx -t -c /root/ST-server/nginx/nginx.conf

# 3. 重启 Nginx
sudo nginx -s stop
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 4. 访问测试
http://119.8.118.149:7092/用户名/st/
```

---

## 📞 需要帮助？

如果问题仍然存在：

1. 查看 Nginx 错误日志：`tail -f /var/log/nginx/error.log`
2. 查看浏览器控制台（F12）的错误信息
3. 提供错误截图和日志内容

**快速诊断**：
```bash
# 一键诊断脚本
echo "=== Nginx 进程 ==="
ps aux | grep nginx

echo "=== 配置文件 ==="
grep -E "(sub_filter|base href)" /root/ST-server/nginx/nginx.conf | head -20

echo "=== 端口监听 ==="
sudo netstat -tlnp | grep nginx

echo "=== 最近的错误 ==="
sudo tail -20 /var/log/nginx/error.log
```
