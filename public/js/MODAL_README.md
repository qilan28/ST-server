# 美化确认对话框使用说明

## 功能特点

✨ **美观设计**
- 渐变色边框和按钮
- 毛玻璃背景效果
- 平滑动画过渡

🎨 **样式类型**
- 普通确认（蓝紫渐变）
- 危险操作（红粉渐变）

⌨️ **交互优化**
- 支持 ESC 键关闭
- 点击遮罩层关闭
- 自动聚焦按钮
- 支持自定义按钮文本

📱 **响应式设计**
- 适配桌面端和移动端
- 移动端按钮垂直排列

## 使用方法

### 基本用法

```javascript
// 简单确认
if (await showConfirm('确定要删除吗？')) {
    // 用户点击了确定
}

// 带标题
if (await showConfirm('确定要删除这个文件吗？', '删除确认')) {
    // 用户点击了确定
}
```

### 高级用法

```javascript
// 危险操作（红色按钮）
if (await showConfirm(
    '此操作不可恢复！\n\n确定要继续吗？',
    '⚠️ 警告',
    { type: 'danger' }
)) {
    // 用户点击了确定
}

// 自定义按钮文本
if (await showConfirm(
    '您真的要删除账号吗？',
    '删除账号',
    {
        type: 'danger',
        confirmText: '确认删除',
        cancelText: '我再想想'
    }
)) {
    // 用户点击了确认删除
}
```

## 参数说明

### showConfirm(message, title, options)

- `message` (string) - 对话框消息内容，支持 `\n` 换行
- `title` (string) - 对话框标题，默认为 "确认操作"
- `options` (object) - 可选配置
  - `type` ('danger') - 设置为危险操作样式
  - `confirmText` (string) - 自定义确认按钮文本
  - `cancelText` (string) - 自定义取消按钮文本

## 返回值

返回 `Promise<boolean>`
- `true` - 用户点击了确认
- `false` - 用户点击了取消或关闭对话框

## 已替换的位置

### dashboard.js
- 停止实例
- 重启实例
- 退出登录
- 切换版本
- 重装依赖
- 删除版本
- 删除账号
- 立即备份
- 恢复备份

### admin.js
- 启动/停止/重启用户实例
- 切换用户角色
- 删除用户
- 删除公告

### setup.js
- 安装版本
- 退出登录

## 样式定制

可以在 `style.css` 中修改以下类来自定义样式：
- `.custom-modal` - 模态框容器
- `.modal-container` - 对话框主体
- `.modal-btn-confirm` - 确认按钮
- `.modal-btn-danger` - 危险操作按钮
- `.modal-btn-cancel` - 取消按钮
