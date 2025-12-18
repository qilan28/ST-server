// 调试脚本 - 用于诊断管理面板问题

// 创建一个可视化的调试日志区域
function createDebugPanel() {
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debugPanel';
    debugPanel.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        width: 300px;
        max-height: 200px;
        background: #f8f9fa;
        border: 1px solid #007bff;
        border-radius: 4px;
        padding: 10px;
        font-size: 12px;
        font-family: monospace;
        overflow-y: auto;
        z-index: 9999;
        display: none;
    `;
    
    const header = document.createElement('div');
    header.innerHTML = '<strong>管理面板诊断</strong>';
    header.style.marginBottom = '5px';
    debugPanel.appendChild(header);
    
    const content = document.createElement('div');
    content.id = 'debugPanelContent';
    debugPanel.appendChild(content);
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: none;
        border: none;
        color: #007bff;
        font-size: 16px;
        cursor: pointer;
    `;
    closeBtn.onclick = () => debugPanel.style.display = 'none';
    debugPanel.appendChild(closeBtn);
    
    const toggleBtn = document.createElement('button');
    toggleBtn.innerHTML = '诊断';
    toggleBtn.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 5px 10px;
        cursor: pointer;
        z-index: 9998;
    `;
    toggleBtn.onclick = () => {
        debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
    };
    
    document.body.appendChild(debugPanel);
    document.body.appendChild(toggleBtn);
    
    return { panel: debugPanel, content };
}

// 记录调试信息
function logDebug(message, type = 'info') {
    const content = document.getElementById('debugPanelContent');
    if (!content) return;
    
    const entry = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString();
    
    let color = 'black';
    switch (type) {
        case 'error':
            color = '#dc3545';
            break;
        case 'success':
            color = '#28a745';
            break;
        case 'warn':
            color = '#ffc107';
            break;
        default:
            color = '#007bff';
    }
    
    entry.innerHTML = `<span style="color: #6c757d;">[${timestamp}]</span> <span style="color: ${color};">${message}</span>`;
    entry.style.marginBottom = '2px';
    
    content.appendChild(entry);
    content.scrollTop = content.scrollHeight;
}

// 检查API端点是否可访问
async function testApiEndpoint(endpoint) {
    try {
        const response = await fetch(endpoint);
        const status = response.status;
        const ok = response.ok;
        
        if (ok) {
            logDebug(`✅ API端点 ${endpoint} 可访问 (状态: ${status})`, 'success');
        } else {
            logDebug(`❌ API端点 ${endpoint} 返回错误 (状态: ${status})`, 'error');
        }
        
        return { endpoint, status, ok };
    } catch (error) {
        logDebug(`❌ 无法访问API端点 ${endpoint}: ${error.message}`, 'error');
        return { endpoint, error: error.message, ok: false };
    }
}

// 诊断常见API端点
async function diagnoseApiEndpoints() {
    logDebug('开始诊断API端点...', 'info');
    
    const endpoints = [
        '/api/health',
        '/api/admin/stats',
        '/api/admin/instances',
        '/api/admin/users',
        '/api/admin/announcements',
        '/api/config/nginx'
    ];
    
    let hasErrors = false;
    
    for (const endpoint of endpoints) {
        const result = await testApiEndpoint(endpoint);
        if (!result.ok) {
            hasErrors = true;
        }
    }
    
    if (hasErrors) {
        logDebug('⚠️ 发现API端点问题，可能影响管理面板功能', 'warn');
    } else {
        logDebug('✅ 所有API端点正常访问', 'success');
    }
}

// 检查本地存储和Cookie状态
function checkStorageAndCookies() {
    // 检查localStorage
    try {
        const token = localStorage.getItem('token');
        const username = localStorage.getItem('username');
        
        if (token) {
            logDebug(`✅ 已找到认证令牌 (${token.substring(0, 10)}...)`, 'success');
        } else {
            logDebug('❌ 未找到认证令牌，请重新登录', 'error');
        }
        
        if (username) {
            logDebug(`✅ 已找到用户名: ${username}`, 'success');
        } else {
            logDebug('❌ 未找到用户名，请重新登录', 'error');
        }
    } catch (error) {
        logDebug(`❌ 无法访问本地存储: ${error.message}`, 'error');
    }
    
    // 检查Cookie
    try {
        const cookies = document.cookie;
        
        if (cookies.includes('st_token=')) {
            logDebug('✅ 已找到认证Cookie (st_token)', 'success');
        } else {
            logDebug('❌ 未找到认证Cookie，请重新登录', 'error');
        }
        
        logDebug(`已设置的Cookie: ${cookies || '无'}`, 'info');
    } catch (error) {
        logDebug(`❌ 无法访问Cookie: ${error.message}`, 'error');
    }
}

// 诊断JS资源加载
function checkResourceLoading() {
    const resources = [
        { name: 'admin.js', global: 'apiRequest' },
        { name: 'admin-fixes.js', global: 'loadInstances' },
        { name: 'modal.js', global: 'showModal' },
        { name: 'user-search.js', global: 'storeUsers' }
    ];
    
    let allLoaded = true;
    
    for (const resource of resources) {
        if (typeof window[resource.global] === 'function') {
            logDebug(`✅ ${resource.name} 已正确加载`, 'success');
        } else {
            logDebug(`❌ ${resource.name} 未加载或存在错误`, 'error');
            allLoaded = false;
        }
    }
    
    if (allLoaded) {
        logDebug('✅ 所有JS资源已正确加载', 'success');
    } else {
        logDebug('⚠️ 部分JS资源未正确加载，可能影响功能', 'warn');
    }
}

// 检查DOM元素是否存在
function checkDomElements() {
    const elements = [
        { id: 'usersTableBody', description: '用户表格' },
        { id: 'instancesTableBody', description: '实例表格' },
        { id: 'announcementsTableBody', description: '公告表格' },
        { id: 'totalUsers', description: '用户统计' },
        { id: 'refreshIntervalSelect', description: '刷新控制' }
    ];
    
    let allFound = true;
    
    for (const element of elements) {
        const el = document.getElementById(element.id);
        if (el) {
            logDebug(`✅ ${element.description} (${element.id}) 已找到`, 'success');
        } else {
            logDebug(`❌ ${element.description} (${element.id}) 未找到`, 'error');
            allFound = false;
        }
    }
    
    if (allFound) {
        logDebug('✅ 所有DOM元素已正确加载', 'success');
    } else {
        logDebug('⚠️ 部分DOM元素未找到，可能影响页面渲染', 'warn');
    }
}

// 运行完整诊断
async function runDiagnostics() {
    logDebug('开始运行管理面板诊断...');
    
    checkStorageAndCookies();
    checkResourceLoading();
    checkDomElements();
    await diagnoseApiEndpoints();
    
    logDebug('诊断完成', 'info');
}

// 页面加载完成后初始化诊断工具
document.addEventListener('DOMContentLoaded', function() {
    const { panel, content } = createDebugPanel();
    
    // 延迟运行诊断，确保页面完全加载
    setTimeout(() => {
        runDiagnostics();
    }, 1500);
});
