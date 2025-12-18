// 页面权限检查脚本
(function() {
    // 检查当前页面是否需要权限验证
    function checkPageAuth() {
        const protectedPages = [
            '/admin.html',
            '/dashboard.html',
            '/setup.html'
        ];
        
        // 获取当前页面路径
        const currentPath = window.location.pathname;
        
        // 如果当前页面需要保护
        if (protectedPages.some(page => currentPath.endsWith(page))) {
            // 检查是否有token
            const token = localStorage.getItem('token');
            
            if (!token) {
                console.log('未检测到登录状态，正在重定向到登录页面...');
                window.location.href = '/';
                return false;
            }
            
            console.log('检测到登录状态，正在验证...');
            // 可以在这里添加额外的token验证逻辑
            return true;
        }
        
        return true;
    }
    
    // 执行检查
    if (!checkPageAuth()) {
        // 如果检查失败，停止后续脚本执行
        throw new Error('权限验证失败');
    }
})();
