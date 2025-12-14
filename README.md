# SillyTavern 多开管理平台

一个功能完整的 SillyTavern 多开管理平台，允许用户注册后使用独立的 SillyTavern 实例。

## ✨ 功能特性

- 🔐 **用户认证系统** - 用户注册、登录、JWT认证
- 👑 **角色权限管理** - 区分管理员和普通用户，支持权限控制
- 🚀 **实例管理** - 启动、停止、重启 SillyTavern 实例
- 📊 **资源监控** - 实时查看 CPU、内存、运行时间等
- 📦 **版本管理** - 切换版本、重装依赖、依赖检测
- 📄 **实时日志** - 查看标准输出和错误日志，支持自动刷新
- 🔧 **管理员面板** - 管理所有用户、实例控制、系统统计
- 🔒 **数据隔离** - 每个用户拥有独立的数据目录
- 🎨 **现代化UI** - 简洁美观的管理界面
- ⚡ **自动化部署** - 基于 PM2 的进程管理

## 📋 技术栈

### 后端
- Node.js + Express
- SQLite (better-sqlite3)
- PM2 (进程管理)
- JWT (jsonwebtoken)
- bcrypt (密码加密)

### 前端
- 原生 HTML/CSS/JavaScript
- Fetch API
- 响应式设计

## ⚠️ 系统要求

- **Node.js >= v20.11.0** (必需)
- **npm >= v10.0.0**
- **Git** (用于克隆 SillyTavern)

> **重要提示**：如果您的 Node.js 版本低于 v20.11.0，请先参考 [NODEJS-UPGRADE.md](./NODEJS-UPGRADE.md) 升级 Node.js，否则会遇到语法错误。

检查版本：
```bash
node --version  # 应该 >= v20.11.0
npm --version   # 应该 >= v10.0.0
git --version
```

## 👑 管理员功能

### 创建管理员账户

首次使用时，需要创建一个管理员账户：

```bash
npm run create-admin
```

按照提示输入管理员的用户名、邮箱和密码。

### 管理员面板功能

管理员登录后，在用户控制台右上角会显示 **"👑 管理员面板"** 按钮，点击进入管理员面板。

**管理员面板功能：**

- **系统统计** - 查看总用户数、运行中实例数、系统资源使用等
- **用户管理** - 查看所有用户信息、启动/停止用户实例
- **角色管理** - 设置或取消用户的管理员权限
- **用户删除** - 删除用户及其所有数据
- **实例监控** - 实时查看所有实例的运行状态和资源使用

**权限保护：**

- 不能删除自己的账户
- 不能删除最后一个管理员
- 不能取消最后一个管理员的权限

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并修改配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
PORT=3000
JWT_SECRET=your-secret-key-change-this-in-production
NODE_ENV=production
```

### 3. 启动服务器

```bash
npm start
```

服务器将在 `http://localhost:3000` 启动

### 4. 访问管理平台

打开浏览器访问 `http://localhost:3000`

## 📖 使用说明

### 注册账号

1. 访问首页，点击"立即注册"
2. 填写用户名、邮箱、密码
3. 注册成功后自动登录并分配端口

### 选择 SillyTavern 版本

1. 首次登录会自动跳转到版本选择页面
2. 系统自动从 GitHub 获取所有可用版本
3. 选择"正式版本"（稳定）或"开发分支"（最新功能）
4. 点击"选择此版本"开始安装
5. 等待克隆仓库和安装依赖（约3-5分钟）

### 管理实例

1. 安装完成后自动进入控制台
2. 点击"启动实例"启动您的 SillyTavern
3. 使用显示的访问地址打开 SillyTavern
4. 可以随时停止或重启实例

### 数据存储

每个用户的数据存储在独立目录：
```
ST-server/data/用户名/
├── sillytavern/        # SillyTavern 代码
│   ├── server.js
│   ├── public/
│   └── ...
└── st-data/           # SillyTavern 数据
    ├── characters/
    ├── chats/
    ├── settings.json
    └── ...
```

## 🔧 项目结构

```
ST-server/
├── database.js              # 数据库操作
├── pm2-manager.js          # PM2进程管理
├── github-api.js           # GitHub API (获取版本)
├── git-manager.js          # Git管理 (clone/update)
├── server.js               # 主服务器
├── setup.js                # 初始化脚本
├── middleware/
│   └── auth.js            # JWT认证中间件
├── routes/
│   ├── auth.js            # 认证路由
│   ├── instance.js        # 实例管理路由
│   └── version.js         # 版本管理路由
├── public/
│   ├── index.html         # 登录/注册页面
│   ├── dashboard.html     # 管理面板
│   ├── setup.html         # 版本选择页面
│   ├── css/
│   │   └── style.css     # 样式文件
│   └── js/
│       ├── auth.js        # 认证逻辑
│       ├── dashboard.js   # 控制台逻辑
│       └── setup.js       # 版本选择逻辑
├── data/                   # 用户数据目录（自动创建）
│   └── 用户名/
│       ├── sillytavern/  # ST代码
│       └── st-data/      # ST数据
├── logs/                   # 日志目录（自动创建）
├── database.sqlite        # SQLite数据库（自动创建）
├── package.json
├── .env.example
├── .gitignore
├── README.md
└── QUICKSTART.md
```

## 🗄️ 数据库结构

### users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| username | TEXT | 用户名（唯一） |
| password | TEXT | 密码（bcrypt加密） |
| email | TEXT | 邮箱（唯一） |
| port | INTEGER | 分配的端口（3001-4000） |
| data_dir | TEXT | 数据目录路径 |
| st_dir | TEXT | SillyTavern 代码目录 |
| st_version | TEXT | SillyTavern 版本 |
| subdomain | TEXT | 子域名（可选） |
| status | TEXT | 实例状态（running/stopped） |
| st_setup_status | TEXT | ST安装状态（pending/installing/completed/failed） |
| created_at | DATETIME | 创建时间 |

## 🔌 API 接口

### 认证接口

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录

### 实例管理接口（需要认证）

- `GET /api/instance/info` - 获取用户信息
- `POST /api/instance/start` - 启动实例
- `POST /api/instance/stop` - 停止实例
- `POST /api/instance/restart` - 重启实例
- `GET /api/instance/status` - 获取实例状态
- `GET /api/instance/logs` - 获取实例日志（参数：type=out|error, lines=数量）

### 版本管理接口

- `GET /api/version/list` - 获取 SillyTavern 版本列表（公开）
- `GET /api/version/repo-info` - 获取仓库信息（公开）
- `GET /api/version/check-git` - 检查 Git 是否可用（公开）
- `POST /api/version/setup` - 安装指定版本（需要认证）
- `GET /api/version/setup-status` - 获取安装状态（需要认证）
- `GET /api/version/check-dependencies` - 检查依赖状态（需要认证）
- `POST /api/version/reinstall-dependencies` - 重装依赖（需要认证）
- `POST /api/version/delete` - 删除当前版本（需要认证）
- `POST /api/version/switch` - 切换版本（需要认证）

### 管理员接口（需要管理员权限）

- `GET /api/admin/users` - 获取所有用户列表
- `GET /api/admin/instances` - 获取所有实例状态
- `GET /api/admin/stats` - 获取系统统计信息
- `POST /api/admin/users/:username/start` - 启动指定用户的实例
- `POST /api/admin/users/:username/stop` - 停止指定用户的实例
- `POST /api/admin/users/:username/restart` - 重启指定用户的实例
- `PUT /api/admin/users/:username/role` - 更新用户角色
- `DELETE /api/admin/users/:username` - 删除用户（含所有数据）

## 🔒 安全建议

1. **修改 JWT 密钥** - 在生产环境中修改 `.env` 文件中的 `JWT_SECRET`
2. **使用 HTTPS** - 在生产环境中使用 HTTPS
3. **保护管理员账户** - 使用强密码，至少创建一个管理员账户作为备份
4. **定期备份** - 定期备份 `database.sqlite` 和 `data/` 目录
5. **限制注册** - 根据需要添加注册限制（如邮箱验证、邀请码等）
6. **安装 Git** - 服务器需要安装 Git 才能克隆 SillyTavern 仓库
7. **磁盘空间** - 确保有足够的磁盘空间（每个用户约 500MB-1GB）
8. **权限审计** - 定期检查管理员账户列表，确保只有授权人员拥有管理员权限

## 📝 开发

### 开发模式运行

```bash
npm run dev
```

### 查看 PM2 进程

```bash
pm2 list
pm2 logs
```

### 停止所有实例

```bash
pm2 stop all
pm2 delete all
```

## 🐛 常见问题

### Q: 遇到 "SyntaxError: Unexpected token '?'" 错误？
A: 
这是 **Node.js 版本过低**导致的。SillyTavern 需要 Node.js v20.11.0 或更高版本。
1. 检查当前版本：`node --version`
2. 参考 [NODEJS-UPGRADE.md](./NODEJS-UPGRADE.md) 升级 Node.js
3. 推荐使用 NVM 安装：`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash && nvm install 20`

### Q: 实例启动失败？
A: 
1. 检查是否已经选择并安装了 SillyTavern 版本
2. 查看 PM2 日志：`pm2 logs`
3. 确认端口未被占用

### Q: 版本安装失败？
A: 
1. 检查服务器是否安装了 Git：`git --version`
2. 检查网络连接是否正常（需要访问 GitHub）
3. 确认有足够的磁盘空间
4. 查看服务器日志获取详细错误信息

### Q: 无法加载版本列表？
A: 
1. 检查服务器网络连接
2. GitHub API 可能被限流，稍后再试
3. 检查防火墙设置

### Q: 端口冲突？
A: 平台使用端口 3000，用户实例使用 3001-4000，确保这些端口未被占用

### Q: 数据丢失？
A: 用户数据存储在 `data/用户名/st-data/` 目录，请定期备份

### Q: 安装速度慢？
A: 首次安装需要从 GitHub 克隆仓库并安装依赖，根据网络情况可能需要 3-10 分钟

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系方式

如有问题，请提交 Issue。