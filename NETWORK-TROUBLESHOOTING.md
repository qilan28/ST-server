# 网络问题排查指南

## NPM 安装失败 (ECONNRESET / network error)

如果在安装 SillyTavern 时遇到类似以下错误：

```
npm ERR! code ECONNRESET
npm ERR! network aborted
npm ERR! network This is a problem related to network connectivity.
```

### 原因

这通常是因为：
1. 网络不稳定
2. NPM 默认源（registry.npmjs.org）访问速度慢
3. 防火墙或代理设置问题

### 解决方案

#### 方法 1：配置 NPM 镜像源（推荐）

1. 编辑 `.env` 文件，添加或取消注释：
   ```env
   NPM_REGISTRY=https://registry.npmmirror.com
   ```

2. 重启服务器：
   ```bash
   npm restart
   ```

3. 重新尝试安装 SillyTavern

#### 方法 2：全局配置 NPM 镜像

如果方法 1 无效，可以全局配置 NPM：

```bash
npm config set registry https://registry.npmmirror.com
```

验证配置：
```bash
npm config get registry
# 应该显示：https://registry.npmmirror.com
```

#### 方法 3：检查网络和代理

如果您在使用代理：

```bash
# 设置代理
npm config set proxy http://your-proxy:port
npm config set https-proxy http://your-proxy:port

# 或者取消代理
npm config delete proxy
npm config delete https-proxy
```

### 自动重试机制

系统已内置自动重试机制：
- 失败后会自动重试 3 次
- 每次重试之间会等待 2-6 秒
- 前端会显示重试进度

### 其他 NPM 镜像源

除了淘宝镜像，您还可以使用：

```env
# 腾讯云镜像
NPM_REGISTRY=https://mirrors.cloud.tencent.com/npm/

# 华为云镜像
NPM_REGISTRY=https://mirrors.huaweicloud.com/repository/npm/

# 阿里云镜像（淘宝镜像）
NPM_REGISTRY=https://registry.npmmirror.com
```

## GitHub 克隆失败

如果 Git 克隆仓库失败：

### 解决方案 1：使用 GitHub 镜像

编辑 `.env` 文件：
```env
# 使用 Gitee 镜像（如果有）
SILLYTAVERN_REPO=https://gitee.com/your-mirror/SillyTavern.git

# 或使用 GitHub 代理
SILLYTAVERN_REPO=https://ghproxy.com/https://github.com/SillyTavern/SillyTavern.git
```

### 解决方案 2：配置 Git 代理

```bash
# 设置 Git 代理
git config --global http.proxy http://your-proxy:port
git config --global https.proxy http://your-proxy:port

# 取消代理
git config --global --unset http.proxy
git config --global --unset https.proxy
```

### 解决方案 3：增加 Git 超时时间

```bash
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999
git config --global http.postBuffer 1048576000
```

## 防火墙设置

确保以下端口和域名可访问：

### 端口
- 443 (HTTPS)
- 80 (HTTP)

### 域名
- registry.npmjs.org (NPM 官方源)
- registry.npmmirror.com (淘宝镜像)
- github.com (GitHub)
- raw.githubusercontent.com (GitHub 原始内容)

## 测试网络连接

### 测试 NPM 源

```bash
npm ping --registry=https://registry.npmmirror.com
```

### 测试 GitHub 连接

```bash
git ls-remote https://github.com/SillyTavern/SillyTavern.git
```

### 测试 DNS

```bash
# Windows
nslookup registry.npmjs.org
nslookup github.com

# Linux
dig registry.npmjs.org
dig github.com
```

## 仍然无法解决？

1. 检查服务器系统日志
2. 查看详细错误信息：`npm run dev`（开发模式）
3. 手动测试安装：
   ```bash
   cd data/用户名/sillytavern
   npm install --omit=dev --registry=https://registry.npmmirror.com
   ```
4. 联系系统管理员或提交 Issue

## 成功标志

安装成功后，您应该看到：
- ✅ 克隆完成
- ✅ 依赖安装完成
- ✅ 自动跳转到控制台
- ✅ 可以启动实例
