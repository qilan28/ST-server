// 自动应用站点设置
(function() {
    const API_BASE = '/api';

    // 加载并应用站点设置
    async function applySiteSettings() {
        try {
            console.log('正在加载站点设置...');
            // 添加时间戳防止缓存
            const timestamp = new Date().getTime();
            const response = await fetch(`${API_BASE}/site-settings?_nocache=${timestamp}`, {
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
            console.log('获取到站点设置:', data);
            
            if (data.success && data.settings) {
                const { project_name, site_name, favicon_path } = data.settings;
                
                // 应用项目名称到特定元素
                if (project_name) {
                    console.log('应用项目名称:', project_name);
                    // 更新登录页面的多开管理平台文本
                    const subtitleElements = document.querySelectorAll('.logo p, .subtitle');
                    subtitleElements.forEach(el => {
                        el.textContent = project_name;
                    });
                }
                
                // 应用网站标题
                if (site_name) {
                    console.log('应用网站标题:', site_name);
                    // 更新所有带有网站名称的元素
                    const siteNameElements = document.querySelectorAll('.logo h1, .site-name');
                    siteNameElements.forEach(el => {
                        el.textContent = site_name;
                    });
                    
                    // 保留页面特定的前缀，如"管理员面板 -"
                    const currentTitle = document.title;
                    const titleParts = currentTitle.split(' - ');
                    
                    if (titleParts.length > 1) {
                        document.title = `${titleParts[0]} - ${site_name}`;
                    } else {
                        document.title = site_name;
                    }
                }
                
                // 应用网站图标
                if (favicon_path) {
                    const links = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
                    const timestamp = new Date().getTime(); // 避免缓存
                    
                    if (links.length > 0) {
                        links.forEach(link => {
                            link.href = `${favicon_path}?t=${timestamp}`;
                        });
                    } else {
                        const link = document.createElement('link');
                        link.rel = 'icon';
                        link.href = `${favicon_path}?t=${timestamp}`;
                        document.head.appendChild(link);
                    }
                }
            }
        } catch (error) {
            console.error('应用站点设置失败:', error);
        }
    }
    
    // 页面加载完成后应用设置
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applySiteSettings);
    } else {
        applySiteSettings();
    }
})();
