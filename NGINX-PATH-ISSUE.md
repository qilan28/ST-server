# ⚠️ Nginx 路径转发问题说明

## 🐛 问题描述

访问 `http://IP:7092/123/st/` 时，页面可以加载，但所有静态资源（JS/CSS/图片等）都返回 404。

### 根本原因

**SillyTavern 不支持在子路径（subpath）下运行**

- SillyTavern 假设它运行在根路径 `/`
- 它生成的 HTML 中使用绝对路径引用资源：`/script.js`、`/style.css` 等
- 当通过 `/123/st/` 访问时，这些绝对路径不会自动加上前缀
- 浏览器会请求 `http://IP:7092/script.js` 而不是 `http://IP:7092/123/st/script.js`

### 技术细节

```html
<!-- SillyTavern 生成的 HTML -->
<script src="/script.js"></script>
<link href="/style.css">

<!-- 通过 /123/st/ 访问时，浏览器解析为： -->
<!-- http://IP:7092/script.js  ❌ 404 -->
<!-- http://IP:7092/style.css ❌ 404 -->

<!-- 而不是期望的： -->
<!-- http://IP:7092/123/st/script.js -->
<!-- http://IP:7092/123/st/style.css -->
```

---

## ✅ 推荐解决方案

### 方案 1：直接端口访问（最简单，推荐）

**不使用 Nginx 路径转发，让用户直接通过端口访问**

```
用户 123: http://119.8.118.149:3001/
用户 456: http://119.8.118.149:3002/
管理员:    http://119.8.118.149:3000/admin.html
```

**优点：**
- ✅ 完全兼容，无任何问题
- ✅ 配置简单，性能最好
- ✅ 不需要 Nginx
- ✅ WebSocket 完美支持

**缺点：**
- ❌ URL 不够美观
- ❌ 需要开放多个端口
- ❌ 用户需要记住自己的端口号

**实施步骤：**
```bash
# 1. 不需要 Nginx 配置
# 2. 确保防火墙开放端口范围 3001-4000
sudo ufw allow 3001:4000/tcp

# 3. 用户直接访问自己的端口
# 在用户面板显示访问地址
```

---

### 方案 2：子域名转发（最优雅）

**为每个用户分配子域名**

```
用户 123: http://123.yourdomain.com/
用户 456: http://456.yourdomain.com/
管理员:   http://admin.yourdomain.com/
```

**优点：**
- ✅ URL 美观易记
- ✅ 完全兼容 SillyTavern
- ✅ 可以配置 HTTPS
- ✅ WebSocket 完美支持

**缺点：**
- ❌ 需要域名
- ❌ 需要配置 DNS 通配符记录
- ❌ 配置相对复杂

**实施步骤：**
```bash
# 1. 配置 DNS 通配符记录
*.yourdomain.com  A  119.8.118.149

# 2. 生成 Nginx 配置
# 修改 generate-nginx-config.js 使用子域名模式

# 3. 用户访问自己的子域名
http://123.yourdomain.com/
```

---

### 方案 3：Nginx 端口代理（折中方案）

**使用 Nginx 作为统一入口，代理到不同端口**

```
所有请求到 7092 端口
根据路径代理到不同的后端端口
但 SillyTavern 仍在根路径 / 运行
```

**Nginx 配置：**
```nginx
# 管理平台
server {
    listen 7092;
    server_name 119.8.118.149;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
    }
}

# 用户 123 - 使用独立的 server 块和端口
server {
    listen 7093;  # 不同的对外端口
    server_name 119.8.118.149;
    
    location / {
        proxy_pass http://127.0.0.1:3001;  # 123 的实例
    }
}

# 用户 456
server {
    listen 7094;
    server_name 119.8.118.149;
    
    location / {
        proxy_pass http://127.0.0.1:3002;  # 456 的实例
    }
}
```

**优点：**
- ✅ 通过 Nginx 统一管理
- ✅ 完全兼容 SillyTavern
- ✅ 可以添加访问控制

**缺点：**
- ❌ 仍需要多个端口
- ❌ URL 仍然包含端口号

---

### 方案 4：路径转发 + Nginx 高级重写（不推荐）

**使用 Nginx 的 `subs_filter` 模块重写 HTML 内容**

**问题：**
- 需要安装额外的 Nginx 模块（`ngx_http_substitutions_filter_module`）
- 性能开销大
- 可能破坏某些 JavaScript 代码
- 不能处理动态加载的资源
- WebSocket 路径也需要特殊处理

**不推荐原因：**
- 复杂度高，维护困难
- 性能损失
- 可能出现各种边界情况

---

## 📊 方案对比

| 方案 | 易用性 | 兼容性 | 性能 | 美观度 | 推荐度 |
|------|--------|--------|------|--------|--------|
| 直接端口访问 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| 子域名转发 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Nginx 端口代理 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| 路径转发重写 | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐ |

---

## 🎯 建议

### 对于当前情况（IP 访问，无域名）

**推荐方案 1：直接端口访问**

```bash
# 1. 停止使用 Nginx 路径转发
sudo nginx -s stop

# 2. 开放端口范围
sudo ufw allow 3001:4000/tcp
sudo ufw allow 3000/tcp

# 3. 告知用户访问地址
管理平台: http://119.8.118.149:3000/
用户 123:  http://119.8.118.149:3001/
用户 456:  http://119.8.118.149:3002/
```

### 对于有域名的情况

**推荐方案 2：子域名转发**

需要：
1. 拥有域名
2. 配置 DNS 通配符 A 记录：`*.yourdomain.com → 119.8.118.149`
3. 修改 Nginx 配置使用子域名模式

---

## 🔧 修改为直接端口访问模式

### 更新 URL 生成逻辑

**文件：** `utils/url-helper.js`

```javascript
export const generateAccessUrl = (username, port) => {
    const nginxConfig = getNginxConfig();
    
    // 直接端口访问模式（推荐）
    return `http://${nginxConfig.domain || 'localhost'}:${port}/`;
    
    // 如果以后要改回路径模式：
    // return `http://${nginxConfig.domain}:${nginxConfig.port}/${username}/st/`;
};
```

### 更新前端显示

**文件：** `public/js/dashboard.js`

```javascript
// 显示访问地址
document.getElementById('accessUrl').innerHTML = `
    <a href="${user.accessUrl}" target="_blank">
        ${user.accessUrl}
    </a>
    <p class="hint">直接访问您的 SillyTavern 实例</p>
`;
```

---

## 💡 总结

**当前问题：** 路径转发模式 (`/123/st/`) 不兼容 SillyTavern

**根本原因：** SillyTavern 使用绝对路径引用资源，不支持子路径运行

**最佳解决方案：** 
1. **短期：** 使用直接端口访问 ✅
2. **长期：** 配置域名后使用子域名转发 ⭐

**不要尝试：** 使用复杂的 Nginx 重写规则，这会带来更多问题

---

## 📞 需要帮助？

如果决定采用某个方案，我可以帮助：
- ✅ 修改代码实现直接端口访问模式
- ✅ 配置子域名转发（需要提供域名）
- ✅ 设置防火墙规则
- ✅ 更新前端 UI 显示

请告诉我您想使用哪个方案！
