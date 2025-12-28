# 实例启动问题疑难解答

本文档提供了 SillyTavern 多开管理平台中用户实例启动问题的排查和解决方法。

## 常见问题

### 1. 用户面板上的"启动实例"按钮不起作用

当点击用户面板上的"启动实例"按钮后，实例没有正常启动，可能有以下原因：

1. PM2 进程管理器连接异常
2. 端口被占用
3. 实例文件权限问题
4. Node.js 版本不兼容
5. SillyTavern 依赖缺失
6. PM2 守护进程状态异常

### 2. 出现"访问时显示 ERR_EMPTY_RESPONSE"错误

这通常是因为用户实例未正常启动或启动后异常退出造成的，可以通过以下解决方案修复。

## 快速解决方案

我们提供了一个自动修复工具，可以解决大多数实例启动问题：

### Windows 用户

1. 运行 `fix-instances.bat` 批处理文件
2. 等待修复完成
3. 重启服务器 (运行 `start.bat`)

### Linux/Mac 用户

1. 运行命令: `npm run fix-instances`
2. 等待修复完成
3. 重启服务器: `npm start`

## 手动修复步骤

如果自动修复工具不能解决问题，请尝试以下手动修复步骤：

### 1. 检查和清理 PM2 进程

```bash
# 查看所有 PM2 进程
pm2 list

# 停止所有进程
pm2 stop all

# 删除所有进程
pm2 delete all

# 杀死 PM2 守护进程
pm2 kill
```

### 2. 检查数据库中的实例状态

```bash
# 运行数据库状态修复工具
npm run fix-online-status
```

### 3. 检查 SillyTavern 目录和安装状态

1. 确保每个用户的 SillyTavern 目录存在：`data/用户名/sillytavern/`
2. 检查 `server.js` 文件是否存在：`data/用户名/sillytavern/server.js`
3. 如果文件不存在，可能需要重新安装 SillyTavern：
   - 登录后点击"版本管理"
   - 选择一个版本进行安装

### 4. 检查 Node.js 版本兼容性

确保 Node.js 版本符合要求（v20.11.0 或更高）：

```bash
node --version
```

如果版本过低，请按照 [NODEJS-UPGRADE.md](./NODEJS-UPGRADE.md) 中的说明升级 Node.js。

### 5. 检查端口占用情况

检查是否有其他程序占用了 SillyTavern 实例的端口：

```bash
# Windows
netstat -ano | findstr :3001

# Linux/Mac
lsof -i :3001
```

如果有其他程序占用端口，请关闭这些程序或更改 SillyTavern 实例使用的端口。

## 更新后的启动流程

我们已经改进了 SillyTavern 实例的启动流程，增加了以下功能：

1. **自动重试机制**：启动失败时将自动重试，最多 3 次
2. **端口自动分配**：如果原端口被占用，会自动分配新端口
3. **异常进程清理**：会自动检测并清理异常的 PM2 进程
4. **更详细的日志记录**：可以在日志文件中查看更详细的错误信息

## 日志文件位置

如果需要查看详细的错误信息，可以检查以下日志文件：

```
ST-server/logs/用户名-out.log  # 标准输出日志
ST-server/logs/用户名-error.log  # 错误日志
```

## 联系支持

如果上述方法都无法解决问题，请提供以下信息联系管理员：

1. 操作系统版本
2. Node.js 版本
3. PM2 版本
4. 错误日志内容
5. 实例启动时的错误信息或截图

---

*最后更新：2024-06-20*
