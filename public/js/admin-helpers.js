/**
 * 管理面板辅助函数
 * 这些函数提供了对admin.js的支持
 */

// 检查管理员权限
function checkAdmin() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            // 管理员验证失败
            window.location.href = '/login.html';
            return false;
        }
        
        // 验证用户角色后可以添加更严格的检查
        // 目前将权限验证委托给后端 API 处理
        return true;
    } catch (error) {
        // 权限检查错误处理
        return false;
    }
}

// 用户操作按钮事件处理
function attachUserActionListeners() {
    // 这个函数在我们的实现中不需要，因为我们直接在按钮上设置了onclick属性
    // 但为了避免错误，我们还是定义这个空函数
    // 初始化监听器
    return true;
}

// 导出到全局作用域
window.checkAdmin = checkAdmin;
window.attachUserActionListeners = attachUserActionListeners;

// 在页面加载时通知
// 页面加载时初始化
