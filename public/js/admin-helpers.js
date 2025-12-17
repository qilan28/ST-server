/**
 * 管理面板辅助函数
 * 这些函数提供了对admin.js的支持
 */

// 检查管理员权限
function checkAdmin() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('管理员验证失败: 无效令牌');
            window.location.href = '/login.html';
            return false;
        }
        
        // 验证用户角色后可以添加更严格的检查
        // 目前将权限验证委托给后端 API 处理
        return true;
    } catch (error) {
        console.error('检查管理员权限时出错:', error);
        return false;
    }
}

// 用户操作按钮事件处理
function attachUserActionListeners() {
    // 这个函数在我们的实现中不需要，因为我们直接在按钮上设置了onclick属性
    // 但为了避免错误，我们还是定义这个空函数
    console.log('用户操作监听器已初始化');
    return true;
}

// 导出到全局作用域
window.checkAdmin = checkAdmin;
window.attachUserActionListeners = attachUserActionListeners;

// 在页面加载时通知
console.log('管理面板辅助函数已加载');
