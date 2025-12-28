/**
 * 消息工具函数
 */

// 全局消息计数
let messageCounter = 0;

// 显示消息弹窗
function showMessage(message, type = 'info', containerId = 'messageContainer') {
    // 检查容器是否存在
    let container = document.getElementById(containerId);
    
    if (!container) {
        // 创建消息容器
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'message-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 350px;
        `;
        document.body.appendChild(container);
    }
    
    // 消息ID
    const messageId = `message-${Date.now()}-${++messageCounter}`;
    
    // 根据类型选择颜色和图标
    let bgColor, icon;
    switch (type) {
        case 'success':
            bgColor = 'var(--success-color, #48bb78)';
            icon = '✅';
            break;
        case 'error':
            bgColor = 'var(--danger-color, #f56565)';
            icon = '❌';
            break;
        case 'warning':
            bgColor = 'var(--warning-color, #ed8936)';
            icon = '⚠️';
            break;
        case 'info':
        default:
            bgColor = 'var(--primary-color, #667eea)';
            icon = 'ℹ️';
            break;
    }
    
    // 创建消息元素
    const messageElement = document.createElement('div');
    messageElement.id = messageId;
    messageElement.className = `message message-${type}`;
    messageElement.style.cssText = `
        background-color: ${bgColor};
        color: white;
        padding: 12px 35px 12px 15px;
        border-radius: 4px;
        margin-bottom: 10px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        position: relative;
        display: flex;
        align-items: center;
        animation: slideInRight 0.3s, fadeOut 0.5s 3.5s;
        opacity: 0;
    `;
    
    // 添加内容
    messageElement.innerHTML = `
        <span style="margin-right: 8px;">${icon}</span>
        <span>${message}</span>
        <button aria-label="关闭" style="position: absolute; right: 8px; top: 8px; background: none; border: none; color: white; cursor: pointer; font-size: 16px;">×</button>
    `;
    
    // 添加到容器
    container.appendChild(messageElement);
    
    // 显示动画
    setTimeout(() => {
        messageElement.style.opacity = '1';
    }, 10);
    
    // 绑定关闭按钮事件
    const closeBtn = messageElement.querySelector('button');
    closeBtn.addEventListener('click', () => {
        removeMessage(messageId);
    });
    
    // 自动移除
    setTimeout(() => {
        removeMessage(messageId);
    }, 4000);
    
    // 返回消息ID，以便手动控制
    return messageId;
}

// 移除消息
function removeMessage(messageId) {
    const messageElement = document.getElementById(messageId);
    if (!messageElement) return;
    
    // 添加淡出动画
    messageElement.style.opacity = '0';
    messageElement.style.transform = 'translateX(100%)';
    messageElement.style.transition = 'opacity 0.3s, transform 0.3s';
    
    // 移除元素
    setTimeout(() => {
        if (messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
        }
    }, 300);
}

// 导出为全局函数
window.showMessage = showMessage;
window.removeMessage = removeMessage;

// 添加必要的CSS动画
const addAnimationStyles = () => {
    // 检查是否已添加
    if (document.getElementById('message-animations')) return;
    
    const style = document.createElement('style');
    style.id = 'message-animations';
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    
    document.head.appendChild(style);
};

// 页面加载完成后添加动画样式
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addAnimationStyles);
} else {
    addAnimationStyles();
}
