# 🚀 快速开始指南

## 系统要求

在开始之前，请确保您的系统满足以下要求：

- ✅ Node.js 18.0 或更高版本
- ✅ Git（用于克隆 SillyTavern 仓库）
- ✅ 至少 2GB 可用磁盘空间
- ✅ 稳定的网络连接（需要访问 GitHub）

检查命令：
```bash
node --version  # 应该显示 v18.x.x 或更高
git --version   # 应该显示 git version x.x.x
```

## 第一步：安装依赖

在 `ST-server` 目录下运行：

```bash
npm install
```

这将安装所有必需的依赖包，包括：
- express（Web框架）
- better-sqlite3（数据库）
- pm2（进程管理）
- jsonwebtoken（JWT认证）
- bcrypt（密码加密）
- cors（跨域支持）

## 第二步：运行设置脚本（可选）

```bash
npm run setup
```

设置脚本会：
- ✅ 创建必要的目录（data、logs等）
- ✅ 自动生成 `.env` 文件和随机 JWT 密钥
- ✅ 检查 SillyTavern 是否正确安装

## 第三步：配置环境变量

如果没有运行设置脚本，手动复制环境变量示例：

```bash
# Windows PowerShell
copy .env.example .env

# Windows CMD
copy .env.example .env
```

然后编辑 `.env` 文件，修改 JWT 密钥（重要！）：

```env
PORT=3000
JWT_SECRET=your-very-long-and-random-secret-key-here
NODE_ENV=production
```

## 第四步：启动服务器

```bash
npm start
```

看到如下输出表示启动成功：

```
============================================================
SillyTavern Multi-Instance Manager
============================================================
Server running on http://localhost:3000
Environment: production
Database: E:\...\ST-server\database.sqlite
============================================================
```

## 第五步：访问管理平台

打开浏览器，访问：**http://localhost:3000**

## 使用流程

### 1. 注册账号

- 在首页点击"立即注册"
- 填写用户名（3-20个字符，仅限字母数字下划线）
- 填写有效的邮箱地址
- 设置密码（至少6个字符）
- 点击"注册"

注册成功后会：
- ✅ 自动创建用户数据目录 `data/你的用户名/`
- ✅ 分配独立端口（3001-4000）
- ✅ 自动登录并跳转到版本选择页面

### 2. 选择 SillyTavern 版本

首次登录会自动进入版本选择页面：

1. **查看版本列表**
   - **正式版本 (Releases)**：经过测试的稳定版本，推荐使用
   - **开发分支 (Branches)**：包含最新功能，可能不稳定

2. **选择版本**
   - 新用户推荐选择最新的正式版本（带"稳定版"标签）
   - 想体验最新功能可选择 `release` 分支

3. **开始安装**
   - 点击"选择此版本"
   - 系统会自动从 GitHub 克隆代码
   - 自动安装所有依赖包
   - ⏱️ 这个过程约需要 3-10 分钟（取决于网络速度）

4. **等待完成**
   - 请保持页面打开，不要关闭
   - 安装完成后会自动跳转到控制台

### 3. 启动实例

在控制台页面：
1. 点击"▶️ 启动实例"按钮
2. 等待几秒钟，实例启动成功
3. 点击"访问地址"打开你的 SillyTavern

### 4. 管理实例

- **停止实例**：点击"⏹️ 停止实例"
- **重启实例**：点击"🔄 重启实例"
- **查看状态**：页面自动每5秒更新一次状态

### 5. 资源监控

控制台会显示：
- CPU 使用率
- 内存使用量
- 运行时间
- 重启次数

## 常用命令

### 开发模式（自动重启）

```bash
npm run dev
```

### 查看 PM2 进程

```bash
pm2 list          # 查看所有进程
pm2 logs          # 查看日志
pm2 monit         # 监控界面
```

### 停止所有用户实例

```bash
pm2 stop all      # 停止所有
pm2 delete all    # 删除所有
```

### 查看数据库

安装 SQLite 查看工具或使用命令行：

```bash
sqlite3 database.sqlite
.tables              # 查看表
SELECT * FROM users; # 查看用户
.quit                # 退出
```

## 目录说明

```
ST-server/
├── data/              # 用户数据（每个用户一个目录）
│   └── username/      # 用户的 SillyTavern 数据
├── logs/              # PM2 日志文件
├── database.sqlite    # SQLite 数据库
├── node_modules/      # npm 依赖
└── ...
```

## 端口分配

- **3000**：管理平台端口
- **3001-4000**：用户 SillyTavern 实例端口（自动分配）

## 安全提示

⚠️ **生产环境部署前务必：**

1. 修改 `.env` 中的 `JWT_SECRET` 为复杂的随机字符串
2. 使用 HTTPS（配置 Nginx 反向代理）
3. 配置防火墙规则
4. 定期备份数据库和用户数据
5. 考虑添加邮箱验证功能

## 故障排查

### 问题：无法启动实例

**可能原因：**
- SillyTavern 路径不正确
- 端口被占用
- PM2 未正确安装

**解决方案：**
```bash
# 检查 SillyTavern 路径
ls ../SillyTavern/server.js

# 检查端口占用
netstat -ano | findstr :3000

# 重启 PM2
pm2 kill
```

### 问题：登录后显示 401 错误

**解决方案：**
- 清除浏览器 localStorage
- 重新登录

### 问题：数据库锁定

**解决方案：**
```bash
# 停止服务器
# 删除临时文件
rm database.sqlite-shm database.sqlite-wal
# 重启服务器
```

## 更多帮助

- 查看 [README.md](README.md) 获取详细文档
- 提交 Issue 报告问题
- 查看 SillyTavern 官方文档

---

祝使用愉快！🎉
