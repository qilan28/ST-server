// 协议检测和修复工具
// 此脚本帮助自动检测当前页面协议并确保API请求使用正确的协议

// 检测当前页面使用的协议
function detectCurrentProtocol() {
    const protocol = window.location.protocol;
    console.log(`当前页面协议: ${protocol}`);
    return protocol;
}

// 获取适合当前环境的API URL
function getApiUrl(endpoint) {
    // 确保endpoint以/开头
    if (!endpoint.startsWith('/')) {
        endpoint = '/' + endpoint;
    }
    
    // 如果endpoint已经是完整URL，直接返回
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
        return endpoint;
    }
    
    // 使用相对路径，将自动匹配当前协议
    return endpoint;
}

// 创建安全的API请求
async function safeApiRequest(endpoint, options = {}) {
    const url = getApiUrl(endpoint);
    console.log(`安全API请求: ${url}`);
    
    // 确保options包含headers
    if (!options.headers) {
        options.headers = {};
    }
    
    // 添加缓存控制
    options.headers['Cache-Control'] = 'no-cache';
    options.headers['Pragma'] = 'no-cache';
    
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API请求错误 (${response.status}): ${errorText}`);
            throw new Error(`请求失败: ${response.status} - ${errorText}`);
        }
        return response;
    } catch (error) {
        console.error(`API请求异常: ${error.message}`);
        // 重新抛出以便调用者处理
        throw error;
    }
}

// 在页面加载时打印协议信息
document.addEventListener('DOMContentLoaded', function() {
    const protocol = detectCurrentProtocol();
    const baseUrl = window.location.origin;
    console.log(`站点基础URL: ${baseUrl}`);
    console.log(`API基础URL: ${getApiUrl('/api')}`);
});

// 导出工具函数
window.protocolHelper = {
    detectCurrentProtocol,
    getApiUrl,
    safeApiRequest
};
