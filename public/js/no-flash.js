/**
 * 无闪烁加载工具
 * 在页面渲染前隐藏标题元素，等内容替换后再显示
 */

// 立即执行函数
(function() {
    // 创建并添加样式到页面头部
    const style = document.createElement('style');
    style.textContent = `
        /* 隐藏Logo和标题，直到替换完成 */
        .logo h1, .logo p, .site-name, .subtitle, 
        .dashboard-header .header-content h1,
        .logo-container, .header-logo-container {
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
        }
        
        /* 预设管理面板布局样式 */
        .admin-header-buttons > div {
            display: flex !important;
            justify-content: space-between !important;
            width: 100% !important;
            align-items: center !important;
        }

        /* 管理面板左侧元素布局 */
        .admin-header-buttons .header-logo-container {
            margin-right: 15px !important;
        }

        /* 管理面板用户信息固定在右边 */
        .admin-header-buttons > div > div:nth-child(1) {
            margin-left: auto !important;
            order: 2 !important;
        }

        /* 页面加载指示器样式 */
        .initial-loader {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 60px;
            margin-bottom: 10px;
        }
        
        .initial-loader:after {
            content: "";
            width: 20px;
            height: 20px;
            border: 2px solid #6366f1;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spinner 0.6s linear infinite;
        }
        
        @keyframes spinner {
            to {transform: rotate(360deg);}
        }
        
        /* 预先为Logo腾出空间，避免布局跳动 */
        .logo, .header-content {
            min-height: 60px;
        }
    `;
    
    // 优先添加样式，在页面开始渲染前就隐藏元素
    document.head.appendChild(style);
    
    // 创建页面加载指示器，显示在Logo位置
    function createLoaders() {
        // 登录页面
        const loginLogo = document.querySelector('.logo');
        if (loginLogo) {
            const loader = document.createElement('div');
            loader.className = 'initial-loader';
            loginLogo.parentNode.insertBefore(loader, loginLogo);
        }
        
        // 控制台页面
        const headerContent = document.querySelector('.dashboard-header .header-content');
        if (headerContent) {
            const loader = document.createElement('div');
            loader.className = 'initial-loader';
            headerContent.insertBefore(loader, headerContent.firstChild);
        }
    }
    
    // 预加载Logo图片
    function preloadLogo() {
        const img = new Image();
        img.onload = function() {
            console.log('Logo图片预加载完成');
        };
        img.onerror = function() {
            console.error('Logo图片预加载失败');
        };
        img.src = '/logo.png';
    }
    
    // 在页面构建时就开始预加载
    preloadLogo();
    
    // 在HTML解析期间添加加载指示器
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createLoaders);
    } else {
        createLoaders();
    }
    
    // 在所有资源加载完成后显示Logo和标题
    window.addEventListener('load', function() {
        // 延迟一小段时间，确保logo-handler.js已经替换了内容
        setTimeout(function() {
            // 移除加载指示器
            document.querySelectorAll('.initial-loader').forEach(function(loader) {
                if (loader && loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }
            });
            
            // 显示所有替换后的内容
            const elements = document.querySelectorAll('.logo h1, .logo p, .site-name, .subtitle, .dashboard-header .header-content h1, .logo-container, .header-logo-container');
            elements.forEach(function(el) {
                el.style.opacity = '1';
            });
            
            console.log('内容替换完成，显示UI');
        }, 300); // 300毫秒后显示，确保替换已完成
    });
})();
