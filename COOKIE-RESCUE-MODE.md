# 🍪 Cookie 救援模式 - 解决静态资源 404

## 📋 问题描述

SillyTavern 中的某些代码使用**绝对路径**（如 `/lib/dialog-polyfill.css` 而不是相对路径），导致通过 Nginx 子路径访问时返回 404 错误：

```
❌ http://119.8.118.149:7092/lib/dialog-polyfill.css → 404
❌ http://119.8.118.149:7092/api/secrets/read → 404
❌ http://119.8.118.149:7092/locales/lang.json → 404
```

这些请求**没有包含**用户路径前缀 `/123/st/`，Nginx 不知道应该转发到哪个用户实例。

---

## ✅ 解决方案：Cookie 救援模式

### 工作原理

1. **设置 Cookie**：用户访问 `/123/st/` 时，Nginx 设置一个 `st_context=123` cookie
2. **拦截逃逸请求**：通过正则匹配拦截所有逃逸的资源请求
3. **Cookie 检查**：检查请求中的 `st_context` cookie
4. **URL 重写**：根据 cookie 值将请求重写为正确的路径
5. **Referer 备用**：如果没有 cookie，检查 Referer 头作为备用

### 流程图

```
用户访问 /123/st/index.html
    ↓
Nginx 设置 Cookie: st_context=123
    ↓
页面加载 /lib/dialog-polyfill.css （绝对路径，逃逸了）
    ↓
Nginx 拦截这个请求
    ↓
检查 Cookie: st_context=123
    ↓
重写 URL: /lib/dialog-polyfill.css → /123/st/lib/dialog-polyfill.css
    ↓
转发到用户 123 的实例
    ↓
✅ 成功返回文件
```

---

## 🔧 已集成到配置生成

现在 `scripts/generate-nginx-config.js` 会自动生成包含 Cookie 救援模式的配置。

### 生成的配置示例

```nginx
# [Cookie 救援模式] 拦截逃逸的 API 和资源请求
location ~ ^/(api|locales|lib|css|scripts|img|assets|public|data|uploads|fonts|icons|csrf-token|version|node_modules|script\.js|thumbnail) {
    
    # 123 用户的 Cookie 检查
    if ($cookie_st_context = "123") {
        rewrite ^(.*)$ /123/st$1 last;
    }
    
    # 222 用户的 Cookie 检查
    if ($cookie_st_context = "222") {
        rewrite ^(.*)$ /222/st$1 last;
    }
    
    # 备用：Referer 救援 (双重保险)
    if ($http_referer ~* "/123/st/") { rewrite ^(.*)$ /123/st$1 last; }
    if ($http_referer ~* "/222/st/") { rewrite ^(.*)$ /222/st$1 last; }
    
    # 默认转发给管理端
    proxy_pass http://st_manager;
}

# 用户访问时设置 Cookie
location /123/st/ {
    # ... 其他配置
    
    # 设置 Cookie 标记用户上下文
    add_header Set-Cookie "st_context=123; Path=/; Max-Age=86400; SameSite=Lax";
    
    # ...
}
```

---

## 🚀 应用修复

在服务器上运行：

```bash
cd /root/ST-server

# 1. 重新生成配置（包含 Cookie 救援模式）
npm run generate-nginx

# 2. 测试配置
sudo nginx -t -c /root/ST-server/nginx/nginx.conf

# 3. 重启 Nginx
sudo nginx -s stop
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 4. 重启管理平台
pm2 restart st-manager
```

---

## 🧪 测试验证

### 1. 检查 Cookie 是否设置

访问用户实例后，在浏览器开发者工具中查看 Cookie：

```
Application → Cookies → http://119.8.118.149:7092
应该看到: st_context = 123
```

### 2. 检查资源请求

打开浏览器开发者工具 Network 面板，刷新页面：

```
✅ /lib/dialog-polyfill.css → 200 OK
✅ /api/secrets/read → 200 OK
✅ /locales/lang.json → 200 OK
```

### 3. 检查 Nginx 日志

```bash
# 查看访问日志，应该看到重写后的路径
sudo tail -f /var/log/nginx/access.log

# 示例：
# GET /lib/dialog-polyfill.css → 内部重写为 → GET /123/st/lib/dialog-polyfill.css
```

---

## 📊 拦截的资源类型

救援模式会拦截以下路径的请求：

- `api` - API 接口
- `locales` - 语言文件
- `lib` - 库文件
- `css` - 样式表
- `scripts` - JavaScript 脚本
- `img` - 图片
- `assets` - 静态资源
- `public` - 公共文件
- `data` - 数据文件
- `uploads` - 上传文件
- `fonts` - 字体文件
- `icons` - 图标
- `csrf-token` - CSRF token
- `version` - 版本信息
- `node_modules` - Node 模块
- `script.js` - 主脚本
- `thumbnail` - 缩略图

如需添加更多路径，修改 `generate-nginx-config.js` 中的正则表达式：

```javascript
location ~ ^/(api|locales|lib|css|...|你的路径) {
```

---

## 🔍 故障排查

### 问题 1：仍然返回 404

**检查 Cookie**：
```bash
# 在浏览器控制台
document.cookie
# 应该包含: st_context=123
```

**检查 Nginx 配置**：
```bash
# 查看是否包含救援模式
grep "Cookie 救援模式" /root/ST-server/nginx/nginx.conf

# 查看拦截规则
grep "location ~ ^/(api|locales" /root/ST-server/nginx/nginx.conf
```

### 问题 2：Cookie 未设置

**检查响应头**：
```bash
curl -I http://119.8.118.149:7092/123/st/

# 应该看到：
# Set-Cookie: st_context=123; Path=/; Max-Age=86400; SameSite=Lax
```

**检查配置是否有多个 add_header**：
```bash
# Nginx 的 add_header 在某些情况下会被覆盖
# 确保每个 location 块都有 Cookie 设置
```

### 问题 3：重写没有生效

**检查 Nginx 错误日志**：
```bash
sudo tail -f /var/log/nginx/error.log

# 查看是否有 rewrite 相关的错误
```

**启用 Nginx rewrite 日志**：
```nginx
# 临时调试，添加到 server 块
error_log /var/log/nginx/error.log debug;
rewrite_log on;
```

---

## 🎯 性能影响

### Cookie 方案 vs sub_filter 方案

| 方案 | 性能 | 可靠性 | 复杂度 |
|------|------|--------|--------|
| **Cookie 救援** | ⚡ 快（正则匹配 + Cookie 读取） | ⭐⭐⭐⭐ 很好 | 简单 |
| **sub_filter** | 🐢 慢（需要解析和修改内容） | ⭐⭐⭐⭐⭐ 最好 | 中等 |

**Cookie 救援模式**：
- ✅ 性能开销小（~1-2ms）
- ✅ 不需要修改响应内容
- ✅ 适合大部分场景
- ⚠️ 依赖 Cookie 支持

**sub_filter**：
- ✅ 最可靠（完全重写路径）
- ✅ 不依赖 Cookie
- ⚠️ 性能开销较大（~10-50ms）
- ⚠️ 需要禁用 gzip

**推荐**：两者结合使用（当前配置）
- Cookie 救援模式处理绝对路径
- sub_filter 处理 HTML 中的相对路径

---

## 📝 配置文件变更

### 修改的文件

1. **`nginx/nginx.conf.template`**
   - 添加 `{{RESCUE_MODE}}` 占位符

2. **`scripts/generate-nginx-config.js`**
   - 生成 Cookie 救援模式配置
   - 在用户 location 块中设置 Cookie
   - 动态生成 Cookie 和 Referer 检查

### 新增功能

- ✅ 自动拦截逃逸的资源请求
- ✅ 基于 Cookie 的智能路由
- ✅ Referer 头备用方案
- ✅ 支持多用户
- ✅ 自动设置 Cookie

---

## 🔮 高级配置

### 自定义 Cookie 名称

修改 `generate-nginx-config.js`：

```javascript
// 当前：
add_header Set-Cookie "st_context=${user.username}; Path=/; Max-Age=86400; SameSite=Lax";

// 自定义：
add_header Set-Cookie "my_app_user=${user.username}; Path=/; Max-Age=86400; SameSite=Lax; Secure";
```

同时修改检查逻辑：
```javascript
if ($cookie_my_app_user = "${user.username}") {
```

### 调整 Cookie 过期时间

```javascript
// 当前：24小时
Max-Age=86400

// 修改为 7 天：
Max-Age=604800

// 修改为 1 小时：
Max-Age=3600
```

### 添加更多拦截路径

```javascript
location ~ ^/(api|locales|lib|css|...|your_path) {
```

---

## ✅ 完成检查清单

应用修复后，确认：

- [ ] 运行 `npm run generate-nginx` 成功
- [ ] Nginx 配置测试通过（`sudo nginx -t`）
- [ ] Nginx 启动成功
- [ ] 访问用户实例时 Cookie 被设置
- [ ] `/lib/dialog-polyfill.css` 返回 200
- [ ] `/api/secrets/read` 返回正常
- [ ] `/locales/lang.json` 返回 200
- [ ] 浏览器控制台无 404 错误
- [ ] 所有静态资源正常加载

---

## 🎉 总结

Cookie 救援模式解决了 SillyTavern 中**绝对路径导致的 404 问题**，通过：

1. 🍪 设置用户上下文 Cookie
2. 🎯 拦截逃逸的资源请求
3. 🔄 智能重写 URL
4. 📍 Referer 头备用方案

现在你的配置已经包含了这个功能，重新生成配置即可！
