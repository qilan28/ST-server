/**
 * Logo测试工具
 */
(function() {
    // 在控制台检测Logo
    console.log('Logo测试工具已加载');
    
    // 检测logo.png是否存在
    function testLogoExists() {
        const img = new Image();
        img.onload = function() {
            console.log('✅ Logo加载成功! 尺寸:', img.width, 'x', img.height);
            showSuccessMessage();
        };
        img.onerror = function() {
            console.error('❌ Logo加载失败，请检查logo.png是否在正确位置');
        };
        img.src = '/logo.png?t=' + new Date().getTime();
    }
    
    // 显示成功消息
    function showSuccessMessage() {
        // 创建临时消息
        const messageDiv = document.createElement('div');
        messageDiv.style.position = 'fixed';
        messageDiv.style.bottom = '20px';
        messageDiv.style.left = '50%';
        messageDiv.style.transform = 'translateX(-50%)';
        messageDiv.style.backgroundColor = '#4BB543';
        messageDiv.style.color = 'white';
        messageDiv.style.padding = '10px 20px';
        messageDiv.style.borderRadius = '5px';
        messageDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        messageDiv.style.zIndex = '9999';
        messageDiv.textContent = 'Logo已成功加载并应用到页面';
        
        // 添加到页面
        document.body.appendChild(messageDiv);
        
        // 3秒后移除
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            messageDiv.style.transition = 'opacity 0.5s';
            setTimeout(() => document.body.removeChild(messageDiv), 500);
        }, 3000);
    }
    
    // 页面完全加载后执行测试
    window.addEventListener('load', function() {
        setTimeout(testLogoExists, 500);
    });
})();
