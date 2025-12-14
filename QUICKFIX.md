# 快速修复 - Node.js 版本错误

## 错误症状

```
SyntaxError: Unexpected token '?'
    at Loader.moduleStrategy (internal/modules/esm/translators.js:133:18)
```

## 原因

Node.js 版本过低（当前 < v20.11.0），SillyTavern 需要 v20.11.0+

## 立即修复

### 方法 1: 使用 NVM (推荐 - 最简单)

```bash
# 一键安装 NVM 并升级到 Node.js 20
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
```

### 方法 2: Ubuntu/Debian

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 方法 3: CentOS/RHEL

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

## 升级后的步骤

```bash
# 1. 验证版本
node --version  # 应该显示 v20.x.x

# 2. 重新安装平台依赖
cd /root/ST-server
rm -rf node_modules package-lock.json
npm install

# 3. 清理失败的 SillyTavern 安装（如果有）
# 替换 123 为实际用户名
rm -rf /root/ST-server/data/123/sillytavern

# 4. 重启服务
pm2 stop all
pm2 delete all
npm start
```

## 需要帮助？

详细说明请查看：[NODEJS-UPGRADE.md](./NODEJS-UPGRADE.md)
