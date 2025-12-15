# 🚀 快速修复指南

## 问题 1：在线状态不显示

```bash
cd /root/ST-server

# 重启服务器（执行数据库迁移）
pm2 restart st-manager

# 查看日志确认迁移成功
pm2 logs st-manager --lines 50 | grep Database

# 重新登录测试
```

---

## 问题 2：自动创建管理员不工作

```bash
cd /root/ST-server

# 步骤 1：确保 config.json 存在
cp config.json.example config.json

# 步骤 2：编辑配置
nano config.json

# 修改以下内容：
{
  "admin": {
    "username": "你的用户名",
    "password": "你的密码",
    "email": "你的邮箱",
    "autoCreate": true  // 必须是 true
  }
}

# 步骤 3：检查配置
npm run check-config

# 步骤 4：重启服务器
pm2 restart st-manager

# 步骤 5：查看创建日志
pm2 logs st-manager --lines 100 | grep Admin
```

---

## 一键诊断

```bash
cd /root/ST-server

# 检查配置
npm run check-config

# 检查数据库
npm run check-database

# 查看日志
pm2 logs st-manager --lines 50
```

---

## 预期成功日志

### 数据库迁移
```
[Database] ✅ last_login_at 字段添加成功
[Database] ✅ is_online 字段添加成功
[Database] ℹ️  已将所有用户设置为离线状态
```

### 自动创建管理员
```
[Admin] 开始检查自动创建管理员配置...
🔧 [Admin] 正在自动创建管理员账号...
✅ [Admin] 管理员账号创建成功！
🔒 [Admin] 已从配置文件中清除管理员密码
```

### 用户登录
```
[Auth] ✅ 用户 xxx 登录状态已更新（在线 + 登录时间）
```

---

## 完整修复流程

```bash
# 1. 上传所有修改文件
cd /root/ST-server
# （上传文件）

# 2. 配置 config.json
nano config.json

# 3. 检查配置
npm run check-config

# 4. 重启服务器
pm2 restart st-manager

# 5. 查看启动日志
pm2 logs st-manager --lines 100

# 6. 检查数据库
npm run check-database

# 7. 测试登录
# 访问 http://IP:7092
# 使用配置的账号密码登录

# 8. 查看管理员面板
# 应该看到 🟢 在线 和登录时间
```

---

详细说明请查看：**TROUBLESHOOTING.md**
