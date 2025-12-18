/**
 * 强制页面刷新工具
 * 用于处理浏览器缓存导致的数据加载问题
 */

// 添加强制刷新按钮到页面
function addForceRefreshButton() {
    // 检查按钮是否已存在
    if (document.getElementById('forceRefreshButton')) {
        return;
    }
    
    // 创建按钮元素
    const refreshButton = document.createElement('button');
    refreshButton.id = 'forceRefreshButton';
    refreshButton.textContent = '强制刷新';
    refreshButton.title = '清除缓存并重新加载页面';
    
    // 设置按钮样式
    refreshButton.style.position = 'fixed';
    refreshButton.style.bottom = '10px';
    refreshButton.style.left = '10px';
    refreshButton.style.padding = '8px 15px';
    refreshButton.style.backgroundColor = '#4a69bd';
    refreshButton.style.color = 'white';
    refreshButton.style.border = 'none';
    refreshButton.style.borderRadius = '5px';
    refreshButton.style.cursor = 'pointer';
    refreshButton.style.zIndex = '9999';
    refreshButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    
    // 添加鼠标悬停效果
    refreshButton.addEventListener('mouseover', () => {
        refreshButton.style.backgroundColor = '#1e3799';
    });
    
    refreshButton.addEventListener('mouseout', () => {
        refreshButton.style.backgroundColor = '#4a69bd';
    });
    
    // 点击事件 - 强制刷新页面
    refreshButton.addEventListener('click', () => {
        // 执行强制刷新
        
        // 清除缓存参数
        const cacheBuster = new Date().getTime();
        
        // 构建新URL（添加或更新nocache参数）
        let newUrl = window.location.href;
        if (newUrl.indexOf('?') > -1) {
            // URL已有参数
            if (newUrl.indexOf('nocache=') > -1) {
                // 替换已有的nocache参数
                newUrl = newUrl.replace(/nocache=\d+/, `nocache=${cacheBuster}`);
            } else {
                // 添加nocache参数
                newUrl += `&nocache=${cacheBuster}`;
            }
        } else {
            // URL没有参数，添加nocache参数
            newUrl += `?nocache=${cacheBuster}`;
        }
        
        // 重新加载页面
        // 刷新到新URL
        window.location.href = newUrl;
    });
    
    // 添加到页面
    document.body.appendChild(refreshButton);
    // 强制刷新按钮已添加到页面
}

// 监听错误事件
function setupErrorListener() {
    window.addEventListener('error', (event) => {
        // 捕获到页面错误
        // 在发生错误时显示强制刷新按钮
        addForceRefreshButton();
    });
}

// 添加调试工具到window对象
window.debugTools = {
    // 强制重新加载站点设置
    reloadSiteSettings: function() {
        // 手动重新加载站点设置
        if (typeof loadSiteSettings === 'function') {
            loadSiteSettings();
            return '站点设置重新加载请求已发送';
        } else {
            return '无法找到loadSiteSettings函数';
        }
    },
    
    // 显示当前表单值
    showFormValues: function() {
        const projectName = document.getElementById('projectName')?.value || '未找到';
        const siteName = document.getElementById('siteName')?.value || '未找到';
        
        // 输出当前表单值
        
        return { projectName, siteName };
    }
};

// 当DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 强制刷新工具已加载
    // 预先设置错误监听
    setupErrorListener();
    
    // 如果URL中有force=refresh参数，添加刷新按钮
    if (window.location.href.indexOf('force=refresh') > -1) {
        addForceRefreshButton();
    }
});

// 导出函数到全局作用域
window.addForceRefreshButton = addForceRefreshButton;
