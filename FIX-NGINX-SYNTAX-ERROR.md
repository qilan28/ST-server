# 🔧 修复 Nginx 配置语法错误

## ❌ 错误信息

```
nginx: [warn] duplicate MIME type "text/html" in /root/ST-server/nginx/nginx.conf:145
nginx: [emerg] unexpected """ in /root/ST-server/nginx/nginx.conf:199
nginx: configuration file /root/ST-server/nginx/nginx.conf test failed
```

## ✅ 已修复

我已经修复了 `scripts/generate-nginx-config.js` 中的两个语法错误：

### 1. 重复的 MIME type "text/html"
**位置**：第86行  
**修复**：从 `sub_filter_types` 中移除 `text/html`

```diff
- sub_filter_types text/html text/css text/javascript application/javascript application/json;
+ sub_filter_types text/css text/javascript application/javascript application/json;
```

**原因**：Nginx 默认对 `text/html` 应用 `sub_filter`，不需要重复声明

### 2. 意外的引号
**位置**：第140行  
**修复**：修正引号转义

```diff
- sub_filter "='/\"" "='/${user.username}/st/'";
+ sub_filter "='/" "='/${user.username}/st/";
```

**原因**：JavaScript 模板字符串中引号处理错误

---

## 🚀 在服务器上应用修复

### 方法 1：使用 git（推荐）

```bash
cd /root/ST-server

# 拉取最新代码（包含修复）
git pull

# 重新生成配置
npm run generate-nginx

# 测试配置
sudo nginx -t -c /root/ST-server/nginx/nginx.conf

# 应该显示：
# nginx: the configuration file /root/ST-server/nginx/nginx.conf syntax is ok
# nginx: configuration file /root/ST-server/nginx/nginx.conf test is successful

# 重启 Nginx
sudo nginx -s stop
sudo nginx -c /root/ST-server/nginx/nginx.conf
```

### 方法 2：手动上传修复后的文件

1. 上传修复后的 `scripts/generate-nginx-config.js` 到服务器
2. 在服务器上运行：

```bash
cd /root/ST-server

# 重新生成配置
node scripts/generate-nginx-config.js

# 或使用 npm 脚本
npm run generate-nginx

# 测试配置
sudo nginx -t -c /root/ST-server/nginx/nginx.conf

# 重启 Nginx
sudo nginx -s stop
sudo nginx -c /root/ST-server/nginx/nginx.conf
```

### 方法 3：手动修复服务器上的脚本

```bash
cd /root/ST-server

# 编辑配置生成脚本
nano scripts/generate-nginx-config.js

# 找到第86行，修改为：
# sub_filter_types text/css text/javascript application/javascript application/json;

# 找到第140行，修改为：
# sub_filter "='/" "='/${user.username}/st/";

# 保存后重新生成
npm run generate-nginx
```

---

## 🧪 验证修复

### 1. 检查配置语法

```bash
sudo nginx -t -c /root/ST-server/nginx/nginx.conf
```

**预期输出**：
```
nginx: the configuration file /root/ST-server/nginx/nginx.conf syntax is ok
nginx: configuration file /root/ST-server/nginx/nginx.conf test is successful
```

### 2. 检查生成的配置文件

```bash
# 检查 sub_filter_types（不应包含 text/html）
grep "sub_filter_types" /root/ST-server/nginx/nginx.conf

# 应该显示类似：
# sub_filter_types text/css text/javascript application/javascript application/json;

# 检查引号（不应有意外的引号）
grep "='/" /root/ST-server/nginx/nginx.conf | head -5
```

### 3. 测试自动重载

```bash
# 查看管理平台日志
pm2 logs st-manager --lines 0

# 注册新用户或修改配置
# 应该看到：
# [Register] Nginx 配置文件已生成
# [Nginx] 配置测试通过
# [Nginx] ✅ 配置重载成功（使用信号）
```

---

## 📋 完整的修复和部署流程

```bash
#!/bin/bash

cd /root/ST-server

echo "1. 拉取最新代码..."
git pull

echo "2. 重启管理平台..."
pm2 restart st-manager

echo "3. 重新生成 Nginx 配置..."
npm run generate-nginx

echo "4. 测试 Nginx 配置..."
sudo nginx -t -c /root/ST-server/nginx/nginx.conf

if [ $? -eq 0 ]; then
    echo "✅ 配置测试通过"
    
    echo "5. 重启 Nginx..."
    sudo nginx -s stop
    sleep 2
    sudo nginx -c /root/ST-server/nginx/nginx.conf
    
    echo "6. 验证服务..."
    curl -I http://127.0.0.1:7092/
    
    echo "✅ 修复完成！"
else
    echo "❌ 配置测试失败，请检查错误信息"
    exit 1
fi
```

保存为 `fix-and-deploy.sh`，然后运行：
```bash
chmod +x fix-and-deploy.sh
./fix-and-deploy.sh
```

---

## 🔍 故障排查

### 问题：仍然显示语法错误

**检查是否使用了旧的配置文件**：
```bash
# 删除旧配置
rm /root/ST-server/nginx/nginx.conf

# 重新生成
npm run generate-nginx

# 测试
sudo nginx -t -c /root/ST-server/nginx/nginx.conf
```

### 问题：git pull 失败

**手动替换文件**：
```bash
# 在本地查看修复后的内容
cat scripts/generate-nginx-config.js | grep -A 2 "sub_filter_types"
cat scripts/generate-nginx-config.js | grep -A 2 "常见的根路径"

# 或直接下载修复后的文件
wget https://your-repo/scripts/generate-nginx-config.js -O scripts/generate-nginx-config.js
```

---

## ✅ 修复确认清单

修复完成后，确认：

- [ ] `scripts/generate-nginx-config.js` 第86行不包含 `text/html`
- [ ] `scripts/generate-nginx-config.js` 第140行引号正确
- [ ] 运行 `npm run generate-nginx` 成功
- [ ] 运行 `sudo nginx -t` 显示配置测试通过
- [ ] Nginx 启动成功
- [ ] 访问 `http://服务器IP:7092/` 正常
- [ ] 注册新用户时自动重载成功
- [ ] 日志没有错误信息

---

## 📝 相关文件

修改的文件：
- `scripts/generate-nginx-config.js` - 配置生成脚本（已修复）

生成的文件：
- `nginx/nginx.conf` - Nginx 配置文件（需要重新生成）

---

## 💡 预防措施

为避免将来再次出现类似问题：

1. **测试配置生成**：
```bash
# 在提交前测试
npm run generate-nginx
sudo nginx -t -c /root/ST-server/nginx/nginx.conf
```

2. **添加自动测试**（可选）：
```javascript
// 在 generate-nginx-config.js 末尾添加
import { exec } from 'child_process';
exec(`nginx -t -c ${outputPath}`, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ 配置测试失败:', stderr);
    } else {
        console.log('✅ 配置测试通过');
    }
});
```

---

## 🎉 完成

修复完成后：
- ✅ Nginx 配置语法正确
- ✅ 自动重载功能正常
- ✅ 新用户注册自动生效
- ✅ 无需手动干预

如有问题，查看日志：
```bash
pm2 logs st-manager
sudo tail -f /var/log/nginx/error.log
```
