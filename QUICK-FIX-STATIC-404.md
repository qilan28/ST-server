# 🚀 Nginx 静态资源 404 快速修复指南

> **问题**：访问 `http://IP:端口/用户名/st/` 时，CSS、JS 等静态资源返回 404

## ⚡ 快速修复（3 步）

### 步骤 1：重新生成 Nginx 配置

```bash
cd /root/ST-server
node scripts/generate-nginx-config.js
```

### 步骤 2：重启 Nginx

```bash
# 停止现有 Nginx
sudo nginx -s stop

# 启动新配置
sudo nginx -c /root/ST-server/nginx/nginx.conf
```

### 步骤 3：测试访问

在浏览器访问：`http://你的IP:7092/用户名/st/`

按 F12 打开开发者工具，检查网络请求是否都返回 200 OK。

---

## 🔍 如果仍有问题

### 运行诊断工具

```bash
npm run diagnose-nginx
```

诊断工具会自动检查：
- ✅ Nginx 是否运行
- ✅ 配置文件是否正确
- ✅ 关键配置是否存在
- ✅ 端口是否监听
- ✅ 用户实例是否运行

### 查看日志

```bash
# 实时查看错误日志
sudo tail -f /var/log/nginx/error.log

# 实时查看访问日志
sudo tail -f /var/log/nginx/access.log
```

---

## ✨ 新增的改进

### 1. Base 标签注入（关键！）

配置会自动在 HTML 的 `<head>` 中注入：

```html
<base href="/用户名/st/">
```

这确保所有相对路径都能正确解析。

### 2. 增强的路径重写规则

覆盖了更多路径模式：
- `/scripts/`, `/css/`, `/lib/`
- `/img/`, `/assets/`, `/public/`
- `/data/`, `/uploads/`, `/user/`
- `fetch()`, `XMLHttpRequest` 调用

### 3. 静态资源专门处理

静态文件（JS/CSS/图片等）使用独立的 location 块处理：
- ✅ 不需要 sub_filter（更快）
- ✅ 启用 7 天缓存
- ✅ 提升性能

---

## 🛠 常用命令

```bash
# 生成配置
npm run generate-nginx

# 测试配置语法
sudo nginx -t -c /root/ST-server/nginx/nginx.conf

# 重启 Nginx
sudo nginx -s stop && sudo nginx -c /root/ST-server/nginx/nginx.conf

# 诊断问题
npm run diagnose-nginx

# 查看 Nginx 进程
ps aux | grep nginx

# 查看端口监听
sudo netstat -tlnp | grep nginx

# 查看错误日志
sudo tail -50 /var/log/nginx/error.log
```

---

## 📋 验证清单

访问 `http://IP:7092/用户名/st/` 后检查：

- [ ] 页面正常显示
- [ ] 样式正确应用
- [ ] 按 F12 → 网络面板 → 无 404 错误
- [ ] 控制台无 JavaScript 错误
- [ ] 图片正常加载
- [ ] 能够正常使用功能

---

## 🔄 备选方案

如果上述方案仍有问题，可以改用：

### 方案 A：直接端口访问

```bash
# 停止 Nginx
sudo nginx -s stop

# 开放端口范围
sudo ufw allow 3001:4000/tcp

# 用户访问
http://IP:3001/  (用户 123)
http://IP:3002/  (用户 456)
```

**优点**：100% 兼容，零问题

### 方案 B：子域名转发（需要域名）

配置 DNS 通配符后：

```
http://123.yourdomain.com/  (用户 123)
http://456.yourdomain.com/  (用户 456)
```

**优点**：URL 美观 + 完全兼容

---

## 💡 技术说明

### 为什么会出现 404？

SillyTavern 使用绝对路径引用资源：

```html
<script src="/scripts/script.js"></script>
```

在子路径 `/123/st/` 下访问时：
- 浏览器请求：`http://IP:7092/scripts/script.js` ❌
- 正确路径应该是：`http://IP:7092/123/st/scripts/script.js` ✅

### Base 标签的作用

```html
<head><base href="/123/st/">
```

告诉浏览器：所有相对路径都基于 `/123/st/`

**示例**：
- `scripts/script.js` → `/123/st/scripts/script.js` ✅
- `/scripts/script.js` → 需要 sub_filter 重写 → `/123/st/scripts/script.js` ✅

### Sub_filter 的作用

Nginx 的 `sub_filter` 模块会在响应中替换文本：

```nginx
sub_filter 'src="/' 'src="/123/st/';
```

这样：
- `<script src="/scripts/script.js">` 
- → `<script src="/123/st/scripts/script.js">` ✅

---

## 📞 需要帮助？

### 问题：配置文件不存在

```bash
# 重新生成
node scripts/generate-nginx-config.js
```

### 问题：Nginx 无法启动

```bash
# 检查端口占用
sudo lsof -i :7092

# 如果被占用，停止占用进程
sudo kill -9 <PID>

# 重新启动
sudo nginx -c /root/ST-server/nginx/nginx.conf
```

### 问题：Base 标签没有注入

```bash
# 测试 sub_filter 是否工作
curl http://127.0.0.1:7092/123/st/ | grep '<head>'

# 如果没有看到 base 标签，检查配置
grep "sub_filter '<head>'" /root/ST-server/nginx/nginx.conf

# 如果没有这个配置，重新生成
node scripts/generate-nginx-config.js
```

### 问题：某些资源仍然 404

1. 打开浏览器控制台（F12）
2. 切换到"网络"标签
3. 记录 404 的资源路径
4. 检查是否需要添加新的路径到静态资源处理规则

---

## 🎯 总结

**修复的核心**：
1. ✅ 注入 Base 标签（最关键）
2. ✅ 增强 Sub_filter 规则
3. ✅ 静态资源专门处理

**一键修复**：
```bash
node scripts/generate-nginx-config.js && \
sudo nginx -s stop && \
sudo nginx -c /root/ST-server/nginx/nginx.conf && \
npm run diagnose-nginx
```

**预期结果**：所有静态资源正常加载，无 404 错误！

---

## 📚 相关文档

- 详细修复方案：`NGINX-STATIC-RESOURCE-FIX.md`
- 子路径解决方案：`NGINX-SUBPATH-SOLUTION.md`
- 问题说明：`NGINX-PATH-ISSUE.md`
- Nginx 配置指南：`NGINX-SETUP.md`

**一键查看**：
```bash
ls -1 *.md | grep -i nginx
```
