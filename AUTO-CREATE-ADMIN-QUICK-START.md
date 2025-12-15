# 🚀 自动创建管理员 - 快速开始

## 📝 快速配置（3步完成）

### 1️⃣ 复制配置文件

```bash
cd /root/ST-server
cp config.json.example config.json
```

### 2️⃣ 编辑配置

```bash
nano config.json
```

修改以下内容：

```json
{
  "admin": {
    "username": "admin",
    "password": "你的安全密码",  // ← 修改这里
    "email": "你的邮箱",          // ← 修改这里
    "autoCreate": true
  }
}
```

### 3️⃣ 重启服务

```bash
pm2 restart st-manager

# 查看日志确认
pm2 logs st-manager --lines 20
```

---

## ✅ 成功标志

看到以下日志说明成功：

```
🔧 [Admin] 正在自动创建管理员账号...
✅ [Admin] 管理员账号创建成功！
   用户名: admin
   邮箱: your_email@example.com
   角色: admin
🔒 [Admin] 已从配置文件中清除管理员密码
```

---

## 🔐 安全提示

✅ **创建成功后，密码会自动从配置文件中清除**

验证：
```bash
cat config.json | grep password
# 应该显示: "password": ""
```

✅ **设置文件权限**

```bash
chmod 600 config.json
```

---

## 🎯 现在可以登录了

访问：`http://你的服务器IP:7092/`

使用刚才配置的账号密码登录！

---

## ❓ 常见问题

### Q: 已经有管理员了怎么办？

A: 没关系，系统会自动跳过创建，原管理员不受影响。

### Q: 想禁用自动创建？

A: 将 `autoCreate` 改为 `false`：

```json
{
  "admin": {
    "autoCreate": false
  }
}
```

### Q: 创建失败了？

A: 检查日志：

```bash
pm2 logs st-manager | grep Admin
```

---

**完整文档**：查看 `FEATURE-AUTO-CREATE-ADMIN.md`
