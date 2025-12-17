# 白屏问题修复方案

## 问题分析

从开发者工具截图看到：
1. ❌ 页面白屏，无法正常显示
2. ❌ 大量 `status` 请求堆积（每次 565-599ms）
3. ❌ 刷新无效，只能新开标签页

### 可能的原因
- API 请求超时或卡住
- 状态检查请求堆积
- JavaScript 执行失败但无错误提示
- 网络请求失败导致初始化中断

## 实施的修复措施

### 1. ✅ 添加全局加载指示器

**文件：`dashboard.html`**
```html
<div id="globalLoading" class="global-loading">
    <div class="loading-spinner"></div>
    <p>加载中...</p>
</div>
```

**效果：**
- 用户能看到页面正在加载
- 不会误以为页面卡死
- 加载完成后自动隐藏

### 2. ✅ 添加全局错误处理

**文件：`dashboard.js`**

```javascript
// JavaScript 错误捕获
window.addEventListener('error', function(event) {
    if (!isPageLoaded) {
        hideGlobalLoading();
        showAlert('页面加载失败，请刷新重试', '❌ 加载失败', 'error')
            .then(() => window.location.reload());
    }
});

// Promise 错误捕获
window.addEventListener('unhandledrejection', function(event) {
    if (!isPageLoaded && event.reason) {
        hideGlobalLoading();
        showAlert('网络请求失败，请检查网络连接', '❌ 网络错误', 'error')
            .then(() => window.location.reload());
    }
});
```

**效果：**
- 捕获所有未处理的错误
- 显示友好的错误提示
- 自动刷新页面

### 3. ✅ API 请求超时控制

**修改前：**
```javascript
const response = await fetch(url, { ...options, headers });
```

**修改后：**
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时

const response = await fetch(url, {
    ...options,
    headers,
    signal: controller.signal
});
```

**效果：**
- 默认 8 秒超时
- 防止请求无限等待
- 超时时抛出明确错误

### 4. ✅ 初始化超时保护

**添加 10 秒初始化超时：**
```javascript
const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('页面加载超时')), 10000);
});

await Promise.race([initProcess, timeout]);
```

**效果：**
- 10 秒内必须完成初始化
- 超时则显示错误并刷新
- 防止永久卡住

### 5. ✅ 状态检查优化

**添加请求锁机制：**
```javascript
let isLoadingStatus = false;

async function loadInstanceStatus() {
    if (isLoadingStatus) return; // 防止重复请求
    
    isLoadingStatus = true;
    try {
        // 请求逻辑
    } finally {
        isLoadingStatus = false;
    }
}
```

**效果：**
- 前一个请求完成前不发起新请求
- 避免请求堆积
- 减少服务器压力

### 6. ✅ 页面可见性检测

**新增功能：**
```javascript
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopStatusCheck(); // 页面隐藏时停止
    } else {
        startStatusCheck(); // 页面显示时恢复
    }
});
```

**效果：**
- 标签页隐藏时停止状态检查
- 节省网络资源
- 减少无效请求

## 修改的文件

| 文件 | 修改内容 |
|------|---------|
| `dashboard.html` | 添加全局加载指示器 |
| `style.css` | 添加加载动画样式 |
| `dashboard.js` | 全局错误处理、超时控制、请求优化 |

## 工作流程

### 修复前
```
1. 用户打开页面
2. JavaScript 开始执行
3. 发起 API 请求
4. [请求卡住/超时] → 白屏
5. 用户刷新 → 仍然卡住 → 白屏
```

### 修复后
```
1. 用户打开页面
2. 显示加载指示器 ⏳
3. JavaScript 开始执行（10秒超时保护）
4. 发起 API 请求（8秒超时保护）
5. 
   成功 → 隐藏加载指示器 → 显示页面 ✅
   失败 → 显示错误弹窗 → 自动刷新 🔄
   超时 → 显示超时错误 → 自动刷新 🔄
```

## 预期效果

### ✅ 不会再出现无提示白屏
- 加载时显示加载动画
- 失败时显示明确错误
- 用户知道发生了什么

### ✅ 自动恢复机制
- 错误时自动刷新
- 通常第二次能成功加载
- 无需手动新开标签页

### ✅ 性能优化
- 请求不会堆积
- 页面隐藏时停止轮询
- 减少服务器负载

## 测试建议

1. **正常加载测试**
   - 打开页面
   - 观察加载指示器
   - 确认正常显示

2. **网络问题测试**
   - 开发者工具 → Network → Offline
   - 刷新页面
   - 应显示网络错误并尝试刷新

3. **超时测试**
   - 开发者工具 → Network → Slow 3G
   - 刷新页面
   - 应在 10 秒内显示超时错误

4. **标签页切换测试**
   - 打开页面
   - 切换到其他标签页
   - Network 面板应停止 status 请求

## 重启服务

```bash
pm2 restart ST-server
```

## 后续监控

如果问题仍然出现，请检查：
1. 浏览器控制台的错误信息
2. Network 面板的请求状态
3. 服务器日志中的错误
