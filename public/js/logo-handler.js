/**
 * 网站Logo处理工具
 * 用于替换网站文本Logo为图片Logo
 */

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    console.log('Logo处理工具已加载');
    
    // 添加样式
    addLogoStyles();
    
    // 应用Logo到所有页面
    setTimeout(() => {
        applyLogo();
    }, 300);
});

// 添加Logo相关样式
function addLogoStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        .logo-image {
            max-height: 60px;
            margin-bottom: 10px;
            display: block;
        }
        
        .header-logo-image {
            max-height: 40px;
            margin-right: 10px;
        }
        
        .logo-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .header-logo-container {
            display: flex;
            align-items: center;
        }
    `;
    document.head.appendChild(styleEl);
}

// 应用Logo到页面
function applyLogo() {
    // 确定当前页面类型
    const isLoginPage = document.querySelector('.auth-card') !== null;
    const isDashboard = document.querySelector('.dashboard-header') !== null;
    const isAdminPage = document.querySelector('.admin-header-buttons') !== null;
    
    // Logo路径
    const logoPath = '/logo.png';
    
    // 应用到不同页面
    if (isLoginPage) {
        // 登录页面 - 顶部居中Logo
        applyLoginPageLogo(logoPath);
    }
    
    if (isDashboard) {
        // 仪表盘页面 - 顶部导航条Logo
        applyDashboardLogo(logoPath);
    }
    
    if (isAdminPage) {
        // 管理页面 - 顶部导航条Logo
        applyAdminLogo(logoPath);
    }
}

// 应用到登录页
function applyLoginPageLogo(logoPath) {
    try {
        const logoContainer = document.querySelector('.logo');
        if (logoContainer) {
            // 创建新的Logo容器
            const newContainer = document.createElement('div');
            newContainer.className = 'logo-container';
            
            // 添加图片Logo
            const logoImg = document.createElement('img');
            logoImg.src = logoPath;
            logoImg.alt = '网站Logo';
            logoImg.className = 'logo-image';
            
            // 获取标题和副标题
            const siteNameEl = logoContainer.querySelector('.site-name');
            const subtitleEl = logoContainer.querySelector('.subtitle');
            
            // 移除表情符号
            if (siteNameEl && siteNameEl.textContent.includes('🎭')) {
                siteNameEl.textContent = siteNameEl.textContent.replace('🎭', '').trim();
            }
            
            // 将元素移入新容器
            newContainer.appendChild(logoImg);
            
            // 替换原容器
            logoContainer.parentNode.replaceChild(newContainer, logoContainer);
            
            // 再添加原来的文字元素
            if (siteNameEl) newContainer.appendChild(siteNameEl);
            if (subtitleEl) newContainer.appendChild(subtitleEl);
            
            console.log('登录页面Logo已更新');
        }
    } catch (error) {
        console.error('更新登录页面Logo失败:', error);
    }
}

// 应用到仪表盘页面
function applyDashboardLogo(logoPath) {
    try {
        const headerContent = document.querySelector('.dashboard-header .header-content');
        if (!headerContent) {
            console.warn('未找到仪表盘页面头部元素');
            return;
        }
        
        // 获取原标题和用户信息元素
        const siteNameEl = headerContent.querySelector('.site-name');
        const userInfoEl = headerContent.querySelector('.user-info');
        
        if (!siteNameEl) {
            console.warn('未找到网站标题元素');
            return;
        }
        
        // 创建Logo容器和标题容器
        const leftContainer = document.createElement('div');
        leftContainer.className = 'header-left-section';
        leftContainer.style.display = 'flex';
        leftContainer.style.alignItems = 'center';
        leftContainer.style.gap = '10px';
        
        // 添加Logo图片
        const logoImg = document.createElement('img');
        logoImg.src = logoPath;
        logoImg.alt = '网站Logo';
        logoImg.className = 'header-logo-image';
        logoImg.style.height = '32px';
        logoImg.style.width = 'auto';
        
        // 移除表情符号
        if (siteNameEl.textContent.includes('🎭')) {
            siteNameEl.textContent = siteNameEl.textContent.replace('🎭', '').trim();
        }
        
        // 保存原标题内容
        const titleClone = siteNameEl.cloneNode(true);
        
        // 清空 header-content并重建结构
        while (headerContent.firstChild) {
            headerContent.removeChild(headerContent.firstChild);
        }
        
        // 添加元素到左侧容器
        leftContainer.appendChild(logoImg);
        leftContainer.appendChild(titleClone);
        
        // 重新添加到页面
        headerContent.appendChild(leftContainer);
        
        // 如果有用户信息，再加回去
        if (userInfoEl) {
            headerContent.appendChild(userInfoEl);
        }
        
        // 添加样式使左右对齐
        headerContent.style.display = 'flex';
        headerContent.style.justifyContent = 'space-between';
        headerContent.style.alignItems = 'center';
        headerContent.style.width = '100%';
        
        console.log('仪表盘Logo已更新，布局已修复');
    } catch (error) {
        console.error('更新仪表盘Logo失败:', error);
    }
}

// 应用到管理页面
function applyAdminLogo(logoPath) {
    try {
        // 管理页面顶部添加Logo
        const headerButtons = document.querySelector('.admin-header-buttons');
        if (headerButtons) {
            const firstDiv = headerButtons.querySelector('div');
            
            if (firstDiv) {
                // 创建Logo容器
                const logoContainer = document.createElement('div');
                logoContainer.className = 'header-logo-container';
                logoContainer.style.marginRight = '15px';
                
                // 添加Logo图片
                const logoImg = document.createElement('img');
                logoImg.src = logoPath;
                logoImg.alt = '网站Logo';
                logoImg.className = 'header-logo-image';
                
                // 添加到页面
                logoContainer.appendChild(logoImg);
                firstDiv.insertBefore(logoContainer, firstDiv.firstChild);
                
                console.log('管理页面Logo已更新');
            }
        }
    } catch (error) {
        console.error('更新管理页面Logo失败:', error);
    }
}

// 导出到全局命名空间以便调试
window.logoHandler = {
    applyLogo: applyLogo
};
