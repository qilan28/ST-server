# Nginx 配置目录

本目录包含 Nginx 反向代理配置相关文件。

## 📁 文件说明

- `nginx.conf.template` - Nginx 配置模板文件（手动编辑）
- `nginx.conf` - 自动生成的配置文件（由脚本生成，不要手动编辑）

## 🚀 快速使用

### 1. 配置环境变量

编辑项目根目录的 `.env` 文件：

```env
USE_NGINX=true
NGINX_DOMAIN=yourdomain.com
NGINX_PORT=80
```

### 2. 生成配置文件

```bash
npm run generate-nginx
```

这将根据当前所有用户自动生成 `nginx.conf` 文件。

### 3. 部署配置

#### Linux
```bash
# 复制配置文件
sudo cp nginx.conf /etc/nginx/sites-available/sillytavern
sudo ln -s /etc/nginx/sites-available/sillytavern /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

#### Windows
```bash
# 复制配置文件
copy nginx.conf C:\nginx\conf\nginx.conf

# 测试配置
cd C:\nginx
nginx -t

# 重载配置
nginx -s reload
```

## 📝 注意事项

1. **每次添加或删除用户后**，需要重新运行 `npm run generate-nginx` 并重载 Nginx
2. **生成的 nginx.conf** 不应该被提交到版本控制（已在 .gitignore 中）
3. **模板文件** (`nginx.conf.template`) 可以根据需要自定义

## 🔗 详细文档

完整的 Nginx 配置指南请参考：[../NGINX-SETUP.md](../NGINX-SETUP.md)
