# 🔧 修复版本切换问题

## 问题描述

用户在切换 SillyTavern 版本时遇到错误：

```
Clone failed: Error: Directory already exists: /root/ST-server/data/1234/sillytavern
```

**原因**：
- 用户已经安装了版本 A（例如 1.12.14）
- 尝试切换到版本 B（例如 1.12.13）
- 但是代码没有先删除旧版本目录，直接尝试克隆新版本
- 导致目录冲突错误

---

## ✅ 修复内容

### 修复逻辑

**修复前**：
```javascript
// 直接克隆，如果目录存在会报错
await setupSillyTavern(stDir, version, onProgress);
```

**修复后**：
```javascript
// 1. 检查旧版本是否存在
if (fs.existsSync(stDir)) {
    // 2. 先停止运行中的实例
    const status = await getInstanceStatus(user.username);
    if (status && status.status === 'online') {
        await stopInstance(user.username);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 3. 删除旧版本目录
    fs.rmSync(stDir, { recursive: true, force: true });
}

// 4. 安装新版本
await setupSillyTavern(stDir, version, onProgress);
```

### 版本切换流程

```
用户点击切换版本
    ↓
检查旧版本目录是否存在
    ↓
【如果存在】
    ↓
检查实例是否运行中
    ↓
【如果运行中】停止实例 → 等待 2 秒
    ↓
删除旧版本目录
    ↓
克隆新版本
    ↓
安装依赖
    ↓
完成
```

---

## 🚀 应用修复

### 1️⃣ 上传修复文件

```bash
cd /root/ST-server

# 上传修复后的 routes/version.js
# （通过 git pull 或手动上传）
```

### 2️⃣ 重启管理平台

```bash
# 重启管理平台
pm2 restart st-manager

# 查看日志
pm2 logs st-manager --lines 20
```

### 3️⃣ 测试版本切换

1. 在管理面板中选择一个用户
2. 点击"切换版本"
3. 选择不同的版本（例如从 1.12.14 切换到 1.12.13）
4. 观察日志输出

**成功的日志**：
```
[1234] 检测到旧版本，准备切换版本...
[1234] 停止运行中的实例...
[1234] 实例已停止
[1234] 删除旧版本目录...
[1234] 旧版本已删除
[1234] 正在克隆 SillyTavern 1.12.13...
[1234] 开始克隆仓库...
[1234] 克隆完成
[1234] 正在安装依赖，这可能需要几分钟...
[1234] 依赖安装完成
[1234] 设置完成！
[1234] SillyTavern 1.12.13 setup completed
```

---

## 📋 注意事项

### ⚠️ 数据保护

版本切换会：
- ✅ **保留** 用户数据（`/data/{username}/st-data/` 目录不会被删除）
- ❌ **删除** SillyTavern 程序文件（`/data/{username}/sillytavern/` 目录）
- ❌ **删除** 已安装的依赖（需要重新安装）

用户的对话记录、角色、设置等数据都保存在 `st-data` 目录中，不会受影响。

### ⚠️ 实例停止

如果用户正在使用 SillyTavern：
- 实例会被自动停止
- 用户需要在版本切换完成后手动重新启动实例

建议在版本切换前通知用户：
> "切换版本将停止并重新安装 SillyTavern，您的数据不会丢失，但需要等待几分钟安装完成后重新启动实例。"

### ⚠️ 版本兼容性

不同版本的 SillyTavern 可能有配置文件格式的差异：
- 从旧版本切换到新版本通常没问题（向后兼容）
- 从新版本切换到旧版本可能会遇到配置不兼容问题

---

## 🔍 故障排查

### 问题 1：删除目录失败

**症状**：
```
[1234] 删除旧版本失败: EBUSY: resource busy or locked
```

**原因**：
- 实例进程还在运行，占用文件
- 文件被其他进程锁定

**解决**：
```bash
# 手动停止实例
pm2 stop st-1234

# 强制删除进程
pm2 delete st-1234

# 手动删除目录
rm -rf /root/ST-server/data/1234/sillytavern

# 重新切换版本
```

### 问题 2：克隆新版本失败

**症状**：
```
Clone failed: Error: Command failed: git clone ...
```

**原因**：
- 网络问题
- Git 版本不兼容
- 磁盘空间不足

**解决**：
```bash
# 检查网络连接
ping github.com

# 检查磁盘空间
df -h

# 检查 Git 版本
git --version

# 手动测试克隆
cd /tmp
git clone --depth 1 --branch 1.12.13 https://github.com/SillyTavern/SillyTavern.git test
```

### 问题 3：依赖安装失败

**症状**：
```
[1234] 依赖安装失败: npm ERR! ...
```

**原因**：
- npm 源问题
- Node.js 版本不兼容
- 依赖包下载失败

**解决**：
```bash
# 切换 npm 源（使用淘宝镜像）
npm config set registry https://registry.npmmirror.com

# 手动安装依赖
cd /root/ST-server/data/1234/sillytavern
npm install

# 或使用 cnpm
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install
```

---

## 🎯 优化建议

### 1. 添加版本切换确认

在前端添加确认对话框：

```javascript
if (confirm('切换版本将停止并重新安装 SillyTavern，确定继续吗？\n\n您的数据不会丢失。')) {
    // 执行版本切换
}
```

### 2. 添加进度显示

使用 WebSocket 或 SSE 实时显示进度：

```
🔄 正在切换版本...
✅ 实例已停止
✅ 旧版本已删除
🔄 正在克隆新版本...
🔄 正在安装依赖...
✅ 安装完成！
```

### 3. 备份机制

在删除前先备份旧版本：

```javascript
// 备份旧版本（可选）
const backupDir = `${stDir}.backup.${Date.now()}`;
fs.renameSync(stDir, backupDir);

// 如果新版本安装失败，可以恢复
if (installFailed) {
    fs.renameSync(backupDir, stDir);
}
```

### 4. 版本回滚

允许用户快速回滚到上一个版本：

```javascript
// 记录上一个版本
const previousVersion = user.st_version;

// 切换版本失败时，自动恢复
if (error) {
    console.log('切换失败，回滚到上一个版本...');
    await switchVersion(previousVersion);
}
```

---

## 📊 测试用例

### 测试 1：首次安装

```
用户状态: 未安装
操作: 选择版本 1.12.14
预期结果: 
- ✅ 直接安装，无需删除旧版本
- ✅ 克隆成功
- ✅ 依赖安装成功
```

### 测试 2：版本切换（实例未运行）

```
用户状态: 已安装 1.12.14，实例未运行
操作: 切换到 1.12.13
预期结果:
- ✅ 删除旧版本目录
- ✅ 克隆新版本
- ✅ 安装依赖
- ✅ 完成
```

### 测试 3：版本切换（实例运行中）

```
用户状态: 已安装 1.12.14，实例运行中
操作: 切换到 1.12.13
预期结果:
- ✅ 先停止实例
- ✅ 删除旧版本目录
- ✅ 克隆新版本
- ✅ 安装依赖
- ✅ 完成
- ⚠️ 实例需手动重启
```

### 测试 4：切换到相同版本

```
用户状态: 已安装 1.12.14
操作: 选择版本 1.12.14
预期结果:
- ✅ 重新安装当前版本（重置环境）
- ✅ 删除旧目录
- ✅ 克隆相同版本
- ✅ 安装依赖
```

---

## ✅ 验证清单

修复后，确认以下功能正常：

- [ ] 首次安装版本成功
- [ ] 从版本 A 切换到版本 B 成功
- [ ] 运行中的实例会被自动停止
- [ ] 旧版本目录被正确删除
- [ ] 新版本克隆成功
- [ ] 依赖安装成功
- [ ] 用户数据（`st-data`）未被删除
- [ ] 切换完成后可以手动启动实例
- [ ] 日志输出清晰，便于调试
- [ ] 错误处理完善，失败时有友好提示

---

## 📝 快速命令

```bash
# 重启管理平台
pm2 restart st-manager

# 查看版本切换日志
pm2 logs st-manager | grep -i "切换\|clone\|删除"

# 检查用户目录
ls -lh /root/ST-server/data/1234/

# 手动删除旧版本（如果自动删除失败）
rm -rf /root/ST-server/data/1234/sillytavern

# 手动停止实例
pm2 stop st-1234

# 查看实例状态
pm2 list | grep st-
```

---

## 🎉 总结

修复后的版本切换流程：
1. ✅ 检测旧版本存在
2. ✅ 自动停止运行中的实例
3. ✅ 安全删除旧版本目录
4. ✅ 克隆新版本
5. ✅ 安装依赖
6. ✅ 保留用户数据

**不再出现"目录已存在"错误！** 🚀
