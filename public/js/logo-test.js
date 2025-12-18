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
    
    // 不再显示成功消息
    function showSuccessMessage() {
        // 只在控制台记录成功信息
        console.log('✅ Logo已成功加载并应用到页面');
        // 不再显示UI通知
    }
    
    // 页面完全加载后执行测试
    window.addEventListener('load', function() {
        setTimeout(testLogoExists, 500);
    });
})();
