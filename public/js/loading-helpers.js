/**
 * 加载状态辅助函数
 * 提供显示和隐藏加载状态的功能
 */

// 显示加载状态
function showSpinner(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.classList.add('loading');
    }
}

// 隐藏加载状态
function hideSpinner(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.classList.remove('loading');
    }
}

// 导出到全局作用域
window.showSpinner = showSpinner;
window.hideSpinner = hideSpinner;

// 在页面加载时通知
// 页面加载时初始化
