/**
 * 强制刷新站点设置
 * 用于解决站点设置未正确应用的问题
 */

// 确保先加载脚本依赖
document.addEventListener('DOMContentLoaded', function() {
    // 站点设置修复工具已加载
    
    // 注意：如果页面已经加载完成，不再强制刷新
    // 为确保在一些情况下站点设置正确加载，我们仍进行递延检查
    setTimeout(() => {
        // 如果内容已显示(加载完成)，且网站设置已应用，则不再强制刷新
        if (document.body.classList.contains('content-loaded') && 
            window.siteSettings && 
            window.siteSettings.loaded) {
            // 页面已加载完成，无需强制刷新站点设置
            return;
        }
        
        // 如果内容还未加载完成或设置未应用，则强制刷新
        forceRefreshSiteSettings();
    }, 1500); // 增加延迟，确保主脚本有足够时间先运行
});

// 强制刷新站点设置
async function forceRefreshSiteSettings() {
    try {
        // 正在强制刷新站点设置
        
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
            // 获取站点设置失败
            return;
        }
        
        const data = await response.json();
        // 已获取最新站点设置
        
        if (data.success && data.settings) {
            const { project_name, site_name } = data.settings;
            
            // 更新项目名称
            if (project_name) {
                updateElements('.subtitle', project_name);
                // 项目名称已更新
            }
            
            // 更新网站名称
            if (site_name) {
                updateElements('.site-name', site_name);
                updatePageTitle(site_name);
                // 网站名称已更新
            }
            
            // 站点设置已强制刷新
            
            // 将数据存入全局设置
            window.siteSettings = {
                loaded: true,
                data: data
            };
            
            // 如果页面内容还未显示，显示内容
            if (!document.body.classList.contains('content-loaded')) {
                document.body.classList.add('content-loaded');
                // 页面内容已显示
                
                // 移除加载层
                setTimeout(() => {
                    const loadingOverlay = document.querySelector('.loading-overlay');
                    if (loadingOverlay) {
                        loadingOverlay.style.display = 'none';
                    }
                }, 500);
            }
        }
    } catch (error) {
        // 强制刷新站点设置时出错
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
        // 未找到元素
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
