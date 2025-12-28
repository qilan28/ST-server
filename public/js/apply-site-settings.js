// 自动应用站点设置
(function() {
    const API_BASE = '/api';
    let loadStartTime = Date.now();
    let minLoadingTime = 600; // 最小加载时间，避免闪烁过快

    // 显示内容，移除加载状态
    function showContent() {
        const elapsedTime = Date.now() - loadStartTime;
        const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
        
        // 确保最小加载时间，避免卡顿感
        setTimeout(() => {
            document.body.classList.add('content-loaded');
            
            // 加载完成后删除加载层
            setTimeout(() => {
                const loadingOverlay = document.querySelector('.loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.style.display = 'none';
                }
            }, 500); // 过渡动画结束后再移除
        }, remainingTime);
    }

    // 加载并应用站点设置
    async function applySiteSettings() {
        try {
            // 正在加载站点设置
            
            // 检查是否已经有预加载的设置
            if (window.siteSettings && window.siteSettings.loaded && window.siteSettings.data) {
                // 使用预加载的站点设置
                applySettings(window.siteSettings.data);
                showContent();
                return;
            }
            
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
                // 获取站点设置失败
                // 即使失败也显示页面
                showContent();
                return;
            }
            
            const data = await response.json();
            // 获取到站点设置
            
            // 成功应用设置
            if (data.success && data.settings) {
                // 存储到全局变量中便于后续使用
                window.siteSettings = {
                    loaded: true,
                    data: data
                };
                
                // 应用设置
                applySettings(data);
            }
            
            // 应用设置后显示内容
            showContent();
            
        } catch (error) {
            // 应用站点设置失败
            // 出错时仍然显示页面
            showContent();
        }
    }
    
    // 应用设置到页面元素
    function applySettings(data) {
        if (!data.settings) return;
        
        const { project_name, site_name, favicon_path } = data.settings;
        
        // 应用项目名称到特定元素
        if (project_name) {
            // 应用项目名称
            // 更新登录页面的多开管理平台文本
            const subtitleElements = document.querySelectorAll('.logo p, .subtitle');
            subtitleElements.forEach(el => {
                el.textContent = project_name;
            });
        }
        
        // 应用网站标题
        if (site_name) {
            // 应用网站标题
            // 更新所有带有网站名称的元素，但排除包含log的元素
            const siteNameElements = document.querySelectorAll('.site-name');
            siteNameElements.forEach(el => {
                // 保留页面特殊文本，如控制台或管理员面板
                if (el.textContent.includes('控制台')) {
                    el.textContent = `${site_name} 控制台`;
                } else if (el.textContent.includes('面板')) {
                    // 管理员面板由h2处理，不修改
                } else {
                    el.textContent = site_name;
                }
            });
            
            // 保留页面特定的前缀，如“管理员面板 -”
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
    
    // 页面加载完成后应用设置
    // 使用immediate策略，让脚本尽早运行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applySiteSettings);
    } else {
        applySiteSettings();
    }
})();
