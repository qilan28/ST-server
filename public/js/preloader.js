/**
 * 页面预加载处理工具
 * 防止内容闪烁，在设置加载完成前隐藏内容
 */

(function() {
    // 立即执行 - 在DOM解析的同时就运行
    console.log('页面预加载工具启动');
    
    // 创建预加载样式
    const styleEl = document.createElement('style');
    styleEl.id = 'preloader-style';
    styleEl.textContent = `
        /* 隐藏特定内容直到加载完成 */
        .logo h1, .site-name, .logo p, .subtitle {
            visibility: hidden !important;
            opacity: 0 !important;
            transition: opacity 0.3s ease;
        }
        
        /* 页面加载指示器 */
        .preloader {
            position: absolute;
            top: 30%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 40px;
            height: 40px;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .preloader:after {
            content: '';
            width: 30px;
            height: 30px;
            border: 3px solid rgba(100, 125, 220, 0.2);
            border-radius: 50%;
            border-top-color: #647ddc;
            animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        /* 设置已加载状态 */
        body.settings-loaded .logo h1, 
        body.settings-loaded .site-name, 
        body.settings-loaded .logo p, 
        body.settings-loaded .subtitle {
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        body.settings-loaded .preloader {
            display: none;
        }
    `;
    
    // 添加样式到页面头部
    document.head.appendChild(styleEl);
    
    // 检查是否为登录页面
    function isLoginPage() {
        // 页面完全加载后检查
        if (document.readyState === 'complete') {
            return document.querySelector('.auth-card') !== null;
        }
        // 如果页面未完全加载，通过URL判断
        return window.location.pathname === '/' || 
               window.location.pathname === '/index.html';
    }
    
    // 添加加载指示器
    function addPreloader() {
        if (!isLoginPage()) return;
        
        const logoContainer = document.querySelector('.logo');
        if (logoContainer) {
            const preloader = document.createElement('div');
            preloader.className = 'preloader';
            logoContainer.appendChild(preloader);
        }
    }
    
    // 当DOM内容加载完成时添加预加载器
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addPreloader);
    } else {
        addPreloader();
    }
    
    // 设置全局标记，供其他脚本使用
    window.preloader = {
        settingsLoaded: false,
        
        // 标记设置已加载完成
        markSettingsLoaded: function() {
            if (this.settingsLoaded) return;
            
            this.settingsLoaded = true;
            document.body.classList.add('settings-loaded');
            console.log('网站设置加载完成，显示内容');
            
            // 删除预加载样式
            setTimeout(() => {
                const preloaderStyle = document.getElementById('preloader-style');
                if (preloaderStyle) {
                    preloaderStyle.remove();
                }
            }, 500); // 给过渡效果留出时间
        }
    };
})();
