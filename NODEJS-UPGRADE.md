# Node.js 升级指南

## 为什么需要 Node.js 18+？

SillyTavern 1.12.0 及更高版本使用了现代 JavaScript 语法特性，包括：
- 空值合并运算符 (`??`)
- 可选链操作符 (`?.`)
- 其他 ES2020+ 特性

这些特性需要 Node.js 18.0 或更高版本才能运行。

## 错误症状

如果您的 Node.js 版本过低，会看到类似以下错误：

```
SyntaxError: Unexpected token '?'
    at Loader.moduleStrategy (internal/modules/esm/translators.js:133:18)
```

或者：

```
npm WARN EBADENGINE Unsupported engine
```

## 检查当前版本

```bash
node --version
```

如果显示的版本低于 `v18.0.0`，需要升级。

## 升级 Node.js

### Windows

1. **下载安装包**
   - 访问 https://nodejs.org/
   - 下载"LTS"版本（推荐）或"Current"版本
   - 运行安装程序

2. **验证安装**
   ```bash
   node --version  # 应显示 v18.x.x 或更高
   npm --version
   ```

3. **如果使用 nvm-windows**
   ```bash
   nvm install 18
   nvm use 18
   ```

### Linux

#### 使用 nvm（推荐）

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新加载配置
source ~/.bashrc

# 安装 Node.js 18
nvm install 18
nvm use 18
nvm alias default 18
```

#### Ubuntu/Debian

```bash
# 添加 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# 安装 Node.js
sudo apt-get install -y nodejs

# 验证
node --version
```

#### CentOS/RHEL/Fedora

```bash
# 添加 NodeSource 仓库
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -

# 安装 Node.js
sudo yum install -y nodejs

# 验证
node --version
```

### macOS

#### 使用 Homebrew

```bash
# 安装 Node.js
brew install node@18

# 或升级现有版本
brew upgrade node

# 验证
node --version
```

#### 使用 nvm

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新加载配置
source ~/.zshrc  # 或 ~/.bash_profile

# 安装 Node.js 18
nvm install 18
nvm use 18
nvm alias default 18
```

## 升级后的步骤

1. **清理旧的安装**
   如果之前安装失败，清理目录：
   ```bash
   cd ST-server
   rm -rf data/用户名/sillytavern
   ```

2. **重启管理平台**
   ```bash
   npm restart
   ```

3. **重新安装 SillyTavern**
   - 登录管理平台
   - 点击"选择 SillyTavern 版本"
   - 选择版本并安装

## 验证系统兼容性

管理平台会自动检查 Node.js 版本：
- ✅ Node.js 18+ - 可以正常安装
- ❌ Node.js < 18 - 显示错误提示，无法安装

您也可以在版本选择页面看到系统环境检查结果。

## 推荐的 Node.js 版本

| 版本类型 | 版本号 | 说明 |
|---------|--------|------|
| **LTS (推荐)** | 18.x | 长期支持版本，稳定可靠 |
| **Current** | 20.x+ | 最新特性，适合开发者 |
| 最低要求 | 18.0.0 | SillyTavern 可运行的最低版本 |

## 多版本管理

如果您需要在同一系统上运行不同版本的 Node.js，推荐使用版本管理工具：

- **Windows**: [nvm-windows](https://github.com/coreybutler/nvm-windows)
- **Linux/macOS**: [nvm](https://github.com/nvm-sh/nvm)

使用 nvm 可以轻松切换版本：
```bash
nvm install 18
nvm install 20
nvm use 18   # 切换到 18
nvm use 20   # 切换到 20
```

## 常见问题

### Q: 升级后 npm 命令不工作？
A: 可能需要重新打开终端或重新加载环境变量。

### Q: 多个 Node.js 版本冲突？
A: 使用 nvm 管理多个版本，避免手动安装多个版本。

### Q: 权限错误？
A: Linux/macOS 上可能需要使用 sudo，或修改 npm 全局目录权限。

### Q: 升级后平台本身无法启动？
A: 检查 ST-server 的 package.json 中的 engines 字段，确保兼容。

## 技术支持

如果升级后仍有问题：
1. 检查完整的错误日志
2. 确认 Node.js 和 npm 版本都正确
3. 清理 node_modules 并重新安装：
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
4. 查看项目 README 和 Issues

## 参考链接

- [Node.js 官网](https://nodejs.org/)
- [nvm GitHub](https://github.com/nvm-sh/nvm)
- [nvm-windows GitHub](https://github.com/coreybutler/nvm-windows)
- [NodeSource 安装说明](https://github.com/nodesource/distributions)
