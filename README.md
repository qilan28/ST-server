# SillyTavern 多开管理平台

一个功能完整的 SillyTavern 多开管理平台，允许用户注册后使用独立的 SillyTavern 实例。

## ✨ 功能特性

- 🔐 **用户认证系统** - 用户注册、登录、JWT认证
- 🚀 **实例管理** - 启动、停止、重启 SillyTavern 实例
- 📊 **资源监控** - 实时查看 CPU、内存、运行时间等
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

### 管理实例

1. 登录后进入控制台
2. 点击"启动实例"启动您的 SillyTavern
3. 使用显示的访问地址打开 SillyTavern
4. 可以随时停止或重启实例

### 数据存储

每个用户的数据存储在独立目录：
```
ST-server/data/用户名/
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
├── server.js               # 主服务器
├── middleware/
│   └── auth.js            # JWT认证中间件
├── routes/
│   ├── auth.js            # 认证路由
│   └── instance.js        # 实例管理路由
├── public/
│   ├── index.html         # 登录/注册页面
│   ├── dashboard.html     # 管理面板
│   ├── css/
│   │   └── style.css     # 样式文件
│   └── js/
│       ├── auth.js        # 认证逻辑
│       └── dashboard.js   # 控制台逻辑
├── data/                   # 用户数据目录（自动创建）
├── logs/                   # 日志目录（自动创建）
├── database.sqlite        # SQLite数据库（自动创建）
├── package.json
├── .env.example
└── README.md
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
| subdomain | TEXT | 子域名（可选） |
| status | TEXT | 实例状态（running/stopped） |
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

## 🔒 安全建议

1. **修改 JWT 密钥** - 在生产环境中修改 `.env` 文件中的 `JWT_SECRET`
2. **使用 HTTPS** - 在生产环境中使用 HTTPS
3. **定期备份** - 定期备份 `database.sqlite` 和 `data/` 目录
4. **限制注册** - 根据需要添加注册限制（如邮箱验证、邀请码等）

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

### Q: 实例启动失败？
A: 检查 SillyTavern 路径是否正确，确保 `../SillyTavern/server.js` 存在

### Q: 端口冲突？
A: 平台使用端口 3000，用户实例使用 3001-4000，确保这些端口未被占用

### Q: 数据丢失？
A: 用户数据存储在 `data/用户名/` 目录，请定期备份

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系方式

如有问题，请提交 Issue。