/**
 * 强制刷新站点设置
 * 用于解决站点设置未正确应用的问题
 */

// 确保先加载脚本依赖
document.addEventListener('DOMContentLoaded', function() {
    console.log('站点设置修复工具已加载');
    
    // 等待页面完全加载后执行
    setTimeout(() => {
        // 刷新站点设置
        forceRefreshSiteSettings();
    }, 1000);
});

// 强制刷新站点设置
async function forceRefreshSiteSettings() {
    try {
        console.log('正在强制刷新站点设置...');
        
        // 防缓存时间戳
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/site-settings?_force_refresh=${timestamp}`, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (!response.ok) {
            console.error('获取站点设置失败:', response.status);
            return;
        }
        
        const data = await response.json();
        console.log('已获取最新站点设置:', data);
        
        if (data.success && data.settings) {
            const { project_name, site_name } = data.settings;
            
            // 更新项目名称
            if (project_name) {
                updateElements('.subtitle', project_name);
                console.log('项目名称已更新:', project_name);
            }
            
            // 更新网站名称
            if (site_name) {
                updateElements('.site-name', site_name);
                updatePageTitle(site_name);
                console.log('网站名称已更新:', site_name);
            }
            
            console.log('站点设置已强制刷新');
        }
    } catch (error) {
        console.error('强制刷新站点设置时出错:', error);
    }
}

// 更新指定选择器的元素内容
function updateElements(selector, content) {
    const elements = document.querySelectorAll(selector);
    if (elements && elements.length > 0) {
        elements.forEach(el => {
            el.textContent = content;
        });
    } else {
        console.warn(`未找到元素: ${selector}`);
    }
}

// 更新页面标题，保留前缀
function updatePageTitle(siteName) {
    const currentTitle = document.title;
    const titleParts = currentTitle.split(' - ');
    
    if (titleParts.length > 1) {
        document.title = `${titleParts[0]} - ${siteName}`;
    } else {
        document.title = siteName;
    }
}

// 添加到全局命名空间以便调试
window.fixSiteSettings = {
    refresh: forceRefreshSiteSettings,
    update: updateElements,
    updateTitle: updatePageTitle
};
