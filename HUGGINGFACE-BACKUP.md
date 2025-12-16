# 🌟 Hugging Face 数据备份功能

本功能允许用户将 SillyTavern 的 data 目录压缩并备份到 Hugging Face 的 Dataset 仓库中。

## 📋 功能特性

- ✅ **自动压缩** - 自动压缩整个 st-data 目录为 ZIP 文件
- ✅ **云端备份** - 上传到 Hugging Face Dataset 仓库
- ✅ **配置保存** - Token 和仓库名安全保存在数据库中
- ✅ **连接测试** - 测试 Hugging Face 连接和权限
- ✅ **进度显示** - 实时显示备份进度和结果

## 🚀 使用步骤

### 1. 获取 Hugging Face Token

1. 访问 [Hugging Face Settings](https://huggingface.co/settings/tokens)
2. 点击 **New token** 创建新 Token
3. 设置 Token 权限为 **Write** (写入权限)
4. 复制生成的 Token

### 2. 创建 Dataset 仓库

1. 访问 [Hugging Face Datasets](https://huggingface.co/new-dataset)
2. 填写仓库名称（例如：`sillytavern-backup`）
3. 选择 **Private** (私有) 或 **Public** (公开)
4. 点击 **Create dataset**
5. 记下完整的仓库名（格式：`username/repo-name`）

### 3. 在控制台配置备份

1. 登录您的 SillyTavern 控制台
2. 找到 **💾 数据备份** 卡片
3. 填写配置信息：
   - **Hugging Face 仓库名**: `你的用户名/仓库名`（例如：`john/sillytavern-backup`）
   - **Hugging Face Token**: 粘贴第1步获取的 Token
4. 点击 **💾 保存配置**

### 4. 测试连接

点击 **🔌 测试连接** 按钮，验证：
- Token 是否有效
- 仓库是否存在
- 是否有写入权限

### 5. 执行备份

点击 **☁️ 立即备份** 按钮：
- 系统会自动压缩您的 `st-data` 目录
- 上传到 Hugging Face 仓库
- 显示备份结果和下载链接

## 📁 备份文件命名

备份文件自动命名为：
```
{用户名}_backup_{日期}_{时间}.zip
```

例如：`john_backup_2024-12-16_143022.zip`

## 🔐 安全说明

- ✅ Token 在数据库中加密存储
- ✅ 仅保存脱敏的 Token 预览
- ✅ 支持私有仓库（推荐）
- ✅ 压缩文件临时存储，上传后自动删除

## 📊 备份内容

备份包含您的完整 SillyTavern 数据目录（`st-data`），包括：
- 角色定义（characters）
- 对话记录（chats）
- 用户设置（settings.json）
- 其他所有数据文件

## ⚠️ 注意事项

1. **网络要求** - 需要能够访问 huggingface.co
2. **仓库格式** - 必须是 Dataset 仓库，不能是 Model 仓库
3. **Token 权限** - 必须有 Write 权限
4. **文件大小** - 注意 Hugging Face 的文件大小限制（通常为 50GB）
5. **备份时间** - 取决于数据大小和网络速度

## 🐛 常见问题

### Q: 上传失败，显示 404 错误？
A: 检查仓库名格式是否正确（必须包含用户名，如：`username/repo-name`）

### Q: 提示权限不足？
A: 确认 Token 有 Write 权限，并且仓库属于您

### Q: 备份很慢？
A: 这取决于您的数据大小和网络速度，请耐心等待

### Q: 如何恢复备份？
A: 
1. 从 Hugging Face 下载备份文件
2. 解压缩到本地
3. 将内容复制到您的 `st-data` 目录

## 🔄 API 接口

如果您想通过 API 调用备份功能：

### 保存配置
```bash
POST /api/backup/hf-config
Content-Type: application/json
Authorization: Bearer {token}

{
  "hfToken": "hf_xxxxxxxxxx",
  "hfRepo": "username/repo-name"
}
```

### 测试连接
```bash
POST /api/backup/test-connection
Content-Type: application/json
Authorization: Bearer {token}

{
  "hfToken": "hf_xxxxxxxxxx",
  "hfRepo": "username/repo-name"
}
```

### 执行备份
```bash
POST /api/backup/backup
Content-Type: application/json
Authorization: Bearer {token}
```

## 📝 更新日志

### v1.0.0 (2024-12-16)
- ✨ 首次发布
- ✅ 支持数据压缩
- ✅ 支持 Hugging Face 上传
- ✅ 配置管理
- ✅ 连接测试

## 💡 未来计划

- [ ] 自动定时备份
- [ ] 备份历史记录
- [ ] 一键恢复功能
- [ ] 增量备份
- [ ] 备份加密

## 📞 技术支持

如有问题，请提交 Issue 或查看主文档。
