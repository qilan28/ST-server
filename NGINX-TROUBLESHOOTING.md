# 🔍 Nginx 故障排查指南

## 问题：访问用户实例显示 ERR_EMPTY_RESPONSE 或无法连接

### 症状
- 访问 `http://域名:端口/用户名/st/` 显示 "ERR_EMPTY_RESPONSE"
- 或显示 "该网页无法正常运作"
- 或 "Connection refused"

### 原因分析

这个错误通常由以下原因之一引起：

1. **用户实例未启动** ⭐ 最常见
2. Nginx 配置错误
3. Nginx 未运行或未重载配置
4. 端口被占用或防火墙阻止
5. 后端服务未正确监听

---

## 🔧 排查步骤

### 步骤 1：检查用户实例状态

**通过管理员面板检查：**

1. 登录管理员面板：`http://你的IP:3000/admin.html`
2. 查看 **👥 用户管理** 区域的"状态"列
3. 查看 **🖥️ 实例监控** 区域

**问题：** 如果状态显示 "已停止" 或 "未安装"：

✅ **解决方案：启动用户实例**

**方法 1：用户自己启动**
- 用户登录自己的面板：`http://你的IP:3000`
- 点击 "▶️ 启动实例" 按钮

**方法 2：管理员启动**
- 在管理员面板的用户列表中
- 点击该用户的 "▶ 启动" 按钮

---

### 步骤 2：验证 Nginx 配置

```bash
# 测试 Nginx 配置是否正确
nginx -t
```

**输出应该是：**
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**如果报错：**
```bash
# 查看详细错误
nginx -t

# 检查生成的配置文件
cat /root/ST-server/nginx/nginx.conf

# 重新生成配置
cd /root/ST-server
npm run generate-nginx
```

---

### 步骤 3：检查 Nginx 是否运行

```bash
# 检查 Nginx 状态
systemctl status nginx

# 或
ps aux | grep nginx
```

**如果 Nginx 未运行：**
```bash
# 启动 Nginx
systemctl start nginx

# 设置开机自启
systemctl enable nginx
```

**如果 Nginx 已运行但配置未生效：**
```bash
# 重载配置
nginx -s reload

# 或重启
systemctl restart nginx
```

---

### 步骤 4：检查端口监听

```bash
# 检查管理平台端口（3000）
netstat -tlnp | grep 3000

# 检查 Nginx 端口（例如 7092）
netstat -tlnp | grep 7092

# 检查用户实例端口（例如 3001）
netstat -tlnp | grep 3001
```

**应该看到：**
```
tcp  0  0  0.0.0.0:3000   0.0.0.0:*   LISTEN  12345/node
tcp  0  0  0.0.0.0:7092   0.0.0.0:*   LISTEN  67890/nginx
tcp  0  0  127.0.0.1:3001 0.0.0.0:*   LISTEN  54321/node
```

---

### 步骤 5：检查防火墙

```bash
# Ubuntu/Debian
sudo ufw status
sudo ufw allow 7092/tcp
sudo ufw allow 3000/tcp

# CentOS/RHEL
firewall-cmd --list-all
firewall-cmd --permanent --add-port=7092/tcp
firewall-cmd --permanent --add-port=3000/tcp
firewall-cmd --reload
```

---

### 步骤 6：查看日志

**Nginx 日志：**
```bash
# 访问日志
tail -f /var/log/nginx/access.log

# 错误日志
tail -f /var/log/nginx/error.log
```

**用户实例日志：**
```bash
# 通过管理员面板查看日志
# 或通过命令行：
pm2 logs st-用户名
```

**管理平台日志：**
```bash
# 查看服务器日志
pm2 logs
```

---

## 📋 完整检查清单

### 配置检查
- [ ] Nginx 配置已生成（`nginx/nginx.conf` 存在）
- [ ] Nginx 配置已部署（复制到 `/etc/nginx/`）
- [ ] Nginx 配置测试通过（`nginx -t` 成功）
- [ ] 管理员面板中 Nginx 模式已启用

### 服务检查
- [ ] 管理平台正在运行（端口 3000）
- [ ] Nginx 正在运行（配置的端口，如 7092）
- [ ] 用户实例已启动（状态不是"已停止"）
- [ ] 防火墙已开放所需端口

### 连接测试
- [ ] 能访问管理平台：`http://IP:3000`
- [ ] 能访问 Nginx：`http://IP:7092`
- [ ] 能访问用户实例（直连）：`http://localhost:3001`
- [ ] 能访问用户实例（Nginx）：`http://IP:7092/用户名/st/`

---

## 🎯 常见场景和解决方案

### 场景 1：用户刚注册，实例未安装

**症状：** 状态显示"未安装"或"pending"

**解决方案：**
1. 用户登录后选择 SillyTavern 版本
2. 等待安装完成（3-10分钟）
3. 安装完成后点击"启动实例"

---

### 场景 2：用户实例已停止

**症状：** 状态显示"已停止"

**解决方案：**
1. 用户登录面板点击"启动实例"
2. 或管理员在管理面板启动该用户实例

---

### 场景 3：Nginx 配置未更新

**症状：** 新添加的用户无法通过 Nginx 访问

**解决方案：**
```bash
# 1. 重新生成配置
npm run generate-nginx

# 2. 部署配置
sudo cp nginx/nginx.conf /etc/nginx/sites-available/sillytavern

# 3. 重载 Nginx
sudo nginx -t && sudo nginx -s reload
```

---

### 场景 4：端口冲突

**症状：** Nginx 无法启动或用户实例无法启动

**解决方案：**
```bash
# 查找占用端口的进程
lsof -i :7092
lsof -i :3001

# 终止占用进程
kill -9 <PID>

# 或更改端口配置
```

---

### 场景 5：权限问题

**症状：** Nginx 报 "permission denied" 错误

**解决方案：**
```bash
# 检查 Nginx 配置文件权限
ls -la /etc/nginx/sites-available/sillytavern

# 确保 Nginx 用户有权限
sudo chown root:root /etc/nginx/sites-available/sillytavern
sudo chmod 644 /etc/nginx/sites-available/sillytavern
```

---

## 🔄 快速修复流程

如果不确定问题出在哪里，按以下顺序操作：

```bash
# 1. 确保管理平台运行
cd /root/ST-server
npm start

# 2. 启动所有用户实例
# 通过管理员面板手动启动每个用户

# 3. 重新生成 Nginx 配置
npm run generate-nginx

# 4. 部署并重载 Nginx
sudo cp nginx/nginx.conf /etc/nginx/sites-available/sillytavern
sudo ln -sf /etc/nginx/sites-available/sillytavern /etc/nginx/sites-enabled/
sudo nginx -t
sudo nginx -s reload

# 5. 检查状态
pm2 list
systemctl status nginx

# 6. 测试访问
curl http://localhost:3000
curl http://localhost:7092
curl http://localhost:3001
```

---

## 📞 获取帮助

如果以上步骤都无法解决问题，请收集以下信息：

1. **Nginx 配置：**
   ```bash
   cat /etc/nginx/sites-available/sillytavern
   ```

2. **Nginx 错误日志：**
   ```bash
   tail -n 50 /var/log/nginx/error.log
   ```

3. **用户实例状态：**
   ```bash
   pm2 list
   pm2 logs st-用户名 --lines 50
   ```

4. **端口监听：**
   ```bash
   netstat -tlnp | grep -E '(3000|7092|3001)'
   ```

5. **防火墙状态：**
   ```bash
   sudo ufw status
   # 或
   firewall-cmd --list-all
   ```

然后将这些信息提交到 GitHub Issues 或联系技术支持。

---

**💡 提示：90% 的 "ERR_EMPTY_RESPONSE" 错误都是因为用户实例未启动！**
