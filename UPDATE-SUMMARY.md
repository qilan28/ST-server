# 📋 更新总结 - 32位随机路径 UUID 功能

## 🎯 主要变更

### 路径格式变更
```
旧格式: /用户名/st/
新格式: /用户名/<32位随机UUID>/

示例：
  旧: http://119.8.118.149:7092/222/st/
  新: http://119.8.118.149:7092/222/a7c4e9d15b3f4c8e9d2a6e8b4f1c7a5d/
```

### 关键特性
- ✅ 每次实例启动/重启时自动生成新的随机 UUID
- ✅ 路径不可预测，增强安全性
- ✅ 自动更新 Nginx 配置
- ✅ Cookie 救援模式兼容
- ✅ 旧链接自动失效

---

## 📂 修改的文件

### 1. `database.js`
**变更**：
- 添加 `path_uuid` 字段到 users 表
- 添加数据库迁移函数 `migrateAddPathUuidField()`
- 创建用户时自动生成 UUID
- 新增函数：
  - `regeneratePathUuid(username)` - 重新生成 UUID
  - `getUserPathUuid(username)` - 获取用户的 UUID

**代码示例**：
```javascript
// 添加导入
import { randomUUID } from 'crypto';

// 创建用户时生成 UUID
const pathUuid = randomUUID();

// 重新生成 UUID
export const regeneratePathUuid = (username) => {
    const newUuid = randomUUID();
    // 更新数据库...
    return newUuid;
};
```

### 2. `pm2-manager.js`
**变更**：
- 启动实例时生成新 UUID
- 重启实例时生成新 UUID
- 返回新的 UUID 给调用者

**代码示例**：
```javascript
export const startInstance = async (username, port, stDir, dataDir) => {
    // 启动时重新生成路径 UUID
    const newUuid = regeneratePathUuid(username);
    console.log(`[Start] New path UUID for ${username}: ${newUuid}`);
    
    // ... 启动实例
    
    return { apps, newUuid };
};
```

### 3. `scripts/generate-nginx-config.js`
**变更**：
- 使用 `user.path_uuid` 替代固定的 `'st'`
- 更新所有 location 块路径
- 更新所有 sub_filter 规则
- 更新 Cookie 救援模式的 rewrite 规则
- 更新 Referer 救援模式

**关键修改**：
```javascript
users.forEach(user => {
    const pathSegment = user.path_uuid || 'st'; // 使用 UUID 或回退到 'st'
    
    // location 块
    location /${user.username}/${pathSegment}/ {
        rewrite ^/${user.username}/${pathSegment}/(.*)$ /$1 break;
        
        // sub_filter 规则
        sub_filter 'src="/' 'src="/${user.username}/${pathSegment}/';
        // ... 更多 sub_filter 规则
    }
    
    // Cookie 救援模式
    if ($cookie_st_context = "${user.username}") {
        rewrite ^(.*)$ /${user.username}/${pathSegment}$1 last;
    }
});
```

### 4. `utils/url-helper.js`
**变更**：
- `generateAccessUrl()` 函数使用动态 UUID 路径
- 导入 `getUserPathUuid` 函数

**代码示例**：
```javascript
export function generateAccessUrl(username, port) {
    const nginxConfig = getNginxConfig();
    
    if (nginxConfig.enabled) {
        const pathUuid = getUserPathUuid(username);
        const pathSegment = pathUuid || 'st';
        const portPart = nginxConfig.port === 80 ? '' : `:${nginxConfig.port}`;
        return `http://${nginxConfig.domain}${portPart}/${username}/${pathSegment}/`;
    }
    // ...
}
```

### 5. `routes/instance.js`
**变更**：
- 启动实例后重新生成 Nginx 配置
- 重启实例后重新生成 Nginx 配置
- 返回新的 UUID 和访问 URL
- 添加提示信息

**代码示例**：
```javascript
// 启动实例
const result = await startInstance(user.username, user.port, user.st_dir, dataDir);

// 重新生成 Nginx 配置
generateNginxConfig();
const reloadResult = await reloadNginx();

// 生成新的访问 URL
const accessUrl = generateAccessUrl(user.username, user.port);

res.json({
    message: 'Instance started successfully',
    accessUrl,
    newPathUuid: result.newUuid,
    info: 'Access URL has been updated with a new security path.'
});
```

### 6. `nginx/nginx.conf.template`
**变更**：
- 添加 Cookie 救援模式占位符 `{{RESCUE_MODE}}`（如果之前没有）

---

## 📄 新增文件

### 1. `RANDOM-PATH-UUID.md`
完整的功能说明文档，包含：
- 功能介绍
- 安全特性
- 使用方法
- 实现细节
- 测试验证
- 故障排查

### 2. `DEPLOY-UUID-FEATURE.md`
部署指南，包含：
- 快速部署步骤
- 验证清单
- 更新现有实例的脚本
- 监控和日志
- 回滚方案

### 3. `UPDATE-SUMMARY.md`
本文件，总结所有变更

---

## 🔄 数据库变更

### 表结构变更
```sql
-- 添加 path_uuid 字段
ALTER TABLE users ADD COLUMN path_uuid TEXT;
```

### 自动迁移
系统启动时自动执行：
1. 检查 `path_uuid` 字段是否存在
2. 如果不存在，添加该字段
3. 为所有现有用户生成 UUID
4. 记录日志

**迁移日志示例**：
```
Adding path_uuid column to users table...
Path UUID column added successfully
Generated UUID for user 123: a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f
Generated UUID for user 222: b7c4e2a56d3f4c9e8b1a5e4d2f9c7b8a
```

---

## 🔐 安全性提升

### 之前
```
路径可预测: /123/st/
任何人知道用户名就能猜测访问路径
```

### 现在
```
路径随机化: /123/a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f/
32位十六进制UUID（128位随机性），几乎不可能猜测
每次重启更新，旧链接失效
```

### 防护效果
- ✅ 防止路径扫描
- ✅ 防止暴力猜测
- ✅ 限制未授权访问
- ✅ 增加攻击难度

---

## 📊 影响分析

### 对用户的影响
- ⚠️ **访问链接会变化**：每次重启实例后需要使用新链接
- ⚠️ **旧链接失效**：保存的书签需要更新
- ✅ **安全性提升**：路径不可预测

### 对系统的影响
- ✅ **兼容性良好**：与现有功能完全兼容
- ✅ **性能影响小**：UUID 生成和配置更新很快
- ✅ **自动化**：无需手动干预

### 对运维的影响
- ✅ **部署简单**：自动迁移数据库
- ✅ **监控方便**：详细的日志记录
- ⚠️ **需要通知用户**：告知链接变更

---

## 🧪 测试场景

### 场景 1：新用户注册
```
1. 用户注册成功
2. 自动生成 UUID
3. 保存到数据库
4. 用户可以使用包含 UUID 的链接访问
```

### 场景 2：启动实例
```
1. 用户点击启动
2. 生成新的 UUID
3. 更新数据库
4. 重新生成 Nginx 配置
5. 重载 Nginx
6. 返回新的访问 URL
7. 旧 URL 失效
```

### 场景 3：重启实例
```
1. 用户点击重启
2. 生成新的 UUID（与启动前不同）
3. 更新数据库
4. 重新生成 Nginx 配置
5. 重载 Nginx
6. 返回新的访问 URL
7. 之前的 URL 全部失效
```

### 场景 4：Cookie 救援模式
```
1. 用户访问 /123/uuid/
2. Nginx 设置 Cookie: st_context=123
3. 页面请求 /lib/xxx（绝对路径）
4. Nginx 检查 Cookie
5. 重写为 /123/uuid/lib/xxx
6. 正确转发到用户实例
```

---

## 🚀 部署步骤（快速）

```bash
# 1. 上传代码到服务器
cd /root/ST-server
git pull  # 或手动上传文件

# 2. 重启管理平台（触发数据库迁移）
pm2 restart st-manager

# 3. 查看日志确认迁移成功
pm2 logs st-manager --lines 20

# 4. 重新生成 Nginx 配置
npm run generate-nginx

# 5. 重载 Nginx
sudo nginx -s reload

# 6. 验证
curl -I http://服务器IP:端口/
```

详细步骤见 `DEPLOY-UUID-FEATURE.md`

---

## 📈 后续改进建议

### 1. UUID 更新策略可选
- [ ] 添加配置选项：每次重启更新 / 仅首次启动更新 / 定时更新
- [ ] 允许管理员手动触发 UUID 更新

### 2. 前端优化
- [ ] 在管理面板显示当前访问 URL
- [ ] 提供一键复制链接功能
- [ ] 重启后自动弹出新链接提示

### 3. 通知功能
- [ ] 重启完成后发送邮件通知用户新链接
- [ ] 添加 WebSocket 推送新链接
- [ ] 浏览器通知

### 4. 历史记录
- [ ] 记录 UUID 变更历史
- [ ] 提供 UUID 回滚功能（紧急情况）
- [ ] 统计 UUID 更新频率

### 5. 安全增强
- [ ] 添加 UUID 访问次数限制
- [ ] UUID 过期时间设置
- [ ] IP 白名单 + UUID 双重验证

---

## ❓ 常见问题

### Q: 现有用户的实例会受影响吗？
A: 会。首次部署后，所有用户都会获得 UUID。但只有重启实例后，UUID 才会更新并生效。

### Q: 如果用户保存了旧链接怎么办？
A: 旧链接会返回 404。用户需要从管理面板获取新的访问链接。

### Q: 能否保持原来的 /st/ 路径？
A: 可以，但不推荐。如果确实需要，可以修改代码回退到固定路径。

### Q: UUID 更新会影响正在运行的会话吗？
A: 不会。已经访问的会话通过 Cookie 维持，不受 UUID 更新影响。

### Q: 如何回滚到旧版本？
A: 使用 git checkout 回滚代码，重启管理平台和 Nginx 即可。path_uuid 字段会保留但不会被使用。

---

## 📞 技术支持

### 查看日志
```bash
# 管理平台日志
pm2 logs st-manager

# Nginx 日志
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### 数据库检查
```bash
sqlite3 /root/ST-server/database.sqlite
sqlite> SELECT username, path_uuid FROM users;
sqlite> .quit
```

### 测试工具
```bash
# 测试访问
curl -I http://服务器IP:端口/用户名/UUID/

# 测试 Nginx 配置
sudo nginx -t

# 查看生成的配置
cat /root/ST-server/nginx/nginx.conf | grep location
```

---

## ✅ 完成检查列表

部署完成后确认：
- [ ] 数据库已添加 path_uuid 字段
- [ ] 所有用户都有 UUID
- [ ] Nginx 配置使用 UUID 路径
- [ ] Nginx 配置测试通过
- [ ] 管理平台正常运行
- [ ] 实例启动返回正确的 URL
- [ ] 实例重启会更新 UUID
- [ ] Cookie 救援模式正常工作
- [ ] 旧 /st/ 路径返回 404
- [ ] 新 UUID 路径可正常访问
- [ ] 日志无错误

---

## 🎉 更新完成

**版本**: v1.1.0  
**更新日期**: 2024-12-15  
**核心功能**: 随机路径 UUID 安全增强  

**主要优势**:
- 🔒 安全性显著提升
- 🔄 自动化程度更高
- 🛡️ 防护能力更强
- ⚡ 性能影响最小

**文档**:
- `RANDOM-PATH-UUID.md` - 功能说明
- `DEPLOY-UUID-FEATURE.md` - 部署指南
- `UPDATE-SUMMARY.md` - 本文件
