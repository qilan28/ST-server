# 🔧 快速修复启动问题

## 问题描述
所有 SillyTavern 实例显示"已停止"状态，无法启动。

## 🚀 快速修复步骤

### 步骤 1：上传修复文件

```bash
cd /root/ST-server

# 备份当前文件
cp scripts/generate-nginx-config.js scripts/generate-nginx-config.js.backup

# 上传修复后的 generate-nginx-config.js 文件
# （从本地上传或 git pull）
```

### 步骤 2：重新生成配置

```bash
# 重新生成 Nginx 配置
npm run generate-nginx

# 检查生成结果
echo "生成的配置文件："
ls -lh nginx/nginx.conf
```

### 步骤 3：测试 Nginx 配置

```bash
# 测试配置文件语法
sudo nginx -t -c /root/ST-server/nginx/nginx.conf

# 如果测试失败，查看详细错误
```

### 步骤 4：重启服务

```bash
# 重启管理平台
pm2 restart st-manager

# 查看管理平台日志
pm2 logs st-manager --lines 50

# 重启 Nginx
sudo nginx -s stop
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 检查 Nginx 是否运行
ps aux | grep nginx
```

### 步骤 5：尝试启动实例

在管理面板中，点击"启动"按钮启动某个用户的实例。

---

## 🔍 诊断命令

### 查看管理平台日志
```bash
# 实时查看日志
pm2 logs st-manager

# 查看最近的错误
pm2 logs st-manager --lines 100 --err
```

### 查看 Nginx 日志
```bash
# 查看错误日志
sudo tail -f /var/log/nginx/error.log

# 查看访问日志
sudo tail -f /var/log/nginx/access.log
```

### 检查端口占用
```bash
# 查看管理平台端口（3000）
netstat -tlnp | grep 3000

# 查看用户实例端口
netstat -tlnp | grep 3001
netstat -tlnp | grep 3002
```

### 检查 PM2 进程
```bash
# 查看所有进程
pm2 list

# 查看详细信息
pm2 describe st-123

# 重启所有进程
pm2 restart all
```

### 手动测试实例启动
```bash
# 查看用户 123 的目录
ls -l /root/ST-instances/123/

# 手动进入目录测试
cd /root/ST-instances/123/SillyTavern-1.14.0/
node server.js --port 3001

# 按 Ctrl+C 停止测试
```

---

## 🐛 常见问题排查

### 问题 1：配置生成失败

**症状**：
```
Error: Cannot read property 'username' of undefined
```

**解决**：
```bash
# 检查数据库
sqlite3 /root/ST-server/data.db
sqlite> SELECT username, port FROM users;
sqlite> .quit

# 确保用户有分配端口
```

### 问题 2：Nginx 配置语法错误

**症状**：
```
nginx: [emerg] unexpected "..."
```

**解决**：
```bash
# 查看生成的配置
cat /root/ST-server/nginx/nginx.conf | head -100

# 重新生成
npm run generate-nginx
```

### 问题 3：PM2 启动失败

**症状**：
```
Error: spawn ENOENT
```

**解决**：
```bash
# 检查 PM2 配置
pm2 list

# 删除旧进程
pm2 delete all

# 重置 PM2
npm run reset-pm2
```

### 问题 4：端口冲突

**症状**：
```
Error: listen EADDRINUSE: address already in use :::3001
```

**解决**：
```bash
# 查找占用端口的进程
lsof -i :3001

# 杀死进程
kill -9 <PID>

# 或使用 PM2 重启
pm2 restart st-123
```

### 问题 5：权限问题

**症状**：
```
Error: EACCES: permission denied
```

**解决**：
```bash
# 检查目录权限
ls -l /root/ST-instances/

# 修复权限
chmod -R 755 /root/ST-instances/
chown -R root:root /root/ST-instances/
```

---

## 🔨 修复的代码问题

### 原问题
```javascript
// 错误的模板字符串嵌套
location /${user.username}/st/ {${ENABLE_ACCESS_CONTROL ? `
    auth_request /auth-check-internal/${user.username};
    ` : ''}
    // ...
}
```

这会导致：
- JavaScript 语法错误
- 配置生成失败
- 实例无法启动

### 修复后
```javascript
// 先生成访问控制字符串
const accessControl = ENABLE_ACCESS_CONTROL ? `
    auth_request /auth-check-internal/${user.username};
    error_page 401 403 = @access_denied;
    ` : '';

// 再插入到模板中
location /${user.username}/st/ {${accessControl}
    // ...
}
```

---

## 📋 完整检查清单

执行以下命令进行完整检查：

```bash
#!/bin/bash
echo "======================================"
echo "  SillyTavern 实例启动诊断"
echo "======================================"
echo ""

# 1. 检查管理平台
echo "1️⃣ 检查管理平台状态："
pm2 list | grep st-manager
echo ""

# 2. 检查数据库
echo "2️⃣ 检查用户数据："
sqlite3 /root/ST-server/data.db "SELECT username, port, role FROM users LIMIT 5;"
echo ""

# 3. 检查 Nginx 配置
echo "3️⃣ 检查 Nginx 配置："
if [ -f /root/ST-server/nginx/nginx.conf ]; then
    echo "✅ 配置文件存在"
    sudo nginx -t -c /root/ST-server/nginx/nginx.conf 2>&1 | grep -E "(successful|failed)"
else
    echo "❌ 配置文件不存在"
fi
echo ""

# 4. 检查实例目录
echo "4️⃣ 检查实例目录："
ls -l /root/ST-instances/ 2>/dev/null | grep "^d" | wc -l
echo "个用户实例目录"
echo ""

# 5. 检查端口占用
echo "5️⃣ 检查端口占用："
echo "管理平台 (3000):"
netstat -tlnp | grep 3000 || echo "❌ 未运行"
echo "用户实例:"
netstat -tlnp | grep -E "300[1-9]|30[1-9][0-9]" | wc -l
echo "个端口在使用"
echo ""

# 6. 检查最近的错误
echo "6️⃣ 最近的错误日志："
pm2 logs st-manager --lines 10 --err --nostream
echo ""

echo "======================================"
echo "诊断完成！"
echo "======================================"
```

保存为 `diagnose-startup.sh` 并运行：

```bash
chmod +x diagnose-startup.sh
./diagnose-startup.sh
```

---

## 🆘 仍然无法解决？

### 查看完整日志
```bash
# 管理平台日志
pm2 logs st-manager --lines 200

# Nginx 错误日志
sudo tail -100 /var/log/nginx/error.log

# 系统日志
journalctl -xe | tail -50
```

### 提供以下信息以便进一步诊断
1. 管理平台日志（`pm2 logs st-manager`）
2. Nginx 配置测试结果（`sudo nginx -t`）
3. 用户数据库信息（`sqlite3 data.db "SELECT * FROM users;"`）
4. 点击"启动"按钮后的具体错误信息

---

## ✅ 预期结果

修复后，你应该看到：
- ✅ 管理平台正常运行
- ✅ Nginx 配置测试通过
- ✅ 实例可以正常启动
- ✅ 实例监控显示"运行中"状态
- ✅ 可以访问 `/123/st/` 等路径

---

## 📝 快速命令参考

```bash
# 重新生成配置
npm run generate-nginx

# 重启所有服务
pm2 restart all && sudo nginx -s reload

# 查看日志
pm2 logs st-manager

# 测试配置
sudo nginx -t

# 完全重启
pm2 restart all && sudo nginx -s stop && sudo nginx -c /root/ST-server/nginx/nginx.conf
```
