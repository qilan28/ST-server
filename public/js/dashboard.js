const API_BASE = '/api';
let statusCheckInterval = null;

// 获取token
function getToken() {
    return localStorage.getItem('token');
}

// 获取用户名
function getUsername() {
    return localStorage.getItem('username');
}

// API请求辅助函数
async function apiRequest(url, options = {}) {
    const token = getToken();
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    if (response.status === 401 || response.status === 403) {
        // Token无效，跳转到登录页
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.href = '/';
        return null;
    }
    
    return response;
}

// 显示消息
function showMessage(text, type = 'error') {
    const messageEl = document.getElementById('controlMessage');
    messageEl.textContent = text;
    messageEl.className = `message show ${type}`;
    
    // 3秒后自动隐藏
    setTimeout(() => {
        messageEl.className = 'message';
    }, 3000);
}

// 格式化时间
function formatUptime(milliseconds) {
    if (!milliseconds) return '0分钟';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}天`;
    if (hours > 0) return `${hours}小时`;
    if (minutes > 0) return `${minutes}分钟`;
    return `${seconds}秒`;
}

// 格式化内存
function formatMemory(bytes) {
    if (!bytes) return '0 MB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// 格式化日期
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
}

// 加载用户信息
async function loadUserInfo() {
    try {
        const response = await apiRequest(`${API_BASE}/instance/info`);
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            // 检查 ST 是否已设置
            if (data.stSetupStatus === 'pending') {
                // 重定向到设置页面
                window.location.href = '/setup.html';
                return;
            }
            
            // 更新页面信息
            document.getElementById('currentUsername').textContent = data.username;
            document.getElementById('username').textContent = data.username;
            document.getElementById('email').textContent = data.email;
            document.getElementById('port').textContent = data.port;
            document.getElementById('createdAt').textContent = formatDate(data.createdAt);
            
            const accessUrl = data.accessUrl;
            const accessLink = document.getElementById('accessUrl');
            accessLink.textContent = accessUrl;
            accessLink.href = accessUrl;
            
            // 显示 ST 版本
            if (data.stVersion) {
                document.getElementById('createdAt').insertAdjacentHTML('afterend', 
                    `<div class="info-item"><span class="label">ST版本：</span><span class="value">${data.stVersion}</span></div>`
                );
            }
            
            // 更新状态
            updateStatusUI(data.status);
        }
    } catch (error) {
        console.error('Load user info error:', error);
    }
}

// 更新状态UI
function updateStatusUI(status) {
    const statusEl = document.getElementById('status');
    const statusBadge = statusEl.querySelector('.status-badge');
    
    if (status === 'running' || status === 'online') {
        statusBadge.textContent = '运行中';
        statusBadge.className = 'status-badge status-running';
    } else {
        statusBadge.textContent = '已停止';
        statusBadge.className = 'status-badge status-stopped';
    }
    
    // 更新按钮状态
    updateButtonStates(status);
}

// 更新按钮状态
function updateButtonStates(status) {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const restartBtn = document.getElementById('restartBtn');
    
    if (status === 'running' || status === 'online') {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        restartBtn.disabled = false;
    } else {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        restartBtn.disabled = true;
    }
}

// 加载实例状态
async function loadInstanceStatus() {
    try {
        const response = await apiRequest(`${API_BASE}/instance/status`);
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            // 更新状态
            updateStatusUI(data.status);
            
            // 更新资源使用
            document.getElementById('cpuUsage').textContent = (data.cpu || 0).toFixed(1) + '%';
            document.getElementById('memoryUsage').textContent = formatMemory(data.memory);
            document.getElementById('uptime').textContent = formatUptime(data.uptime);
            document.getElementById('restarts').textContent = data.restarts || 0;
        }
    } catch (error) {
        console.error('Load instance status error:', error);
    }
}

// 启动实例
async function handleStart() {
    const startBtn = document.getElementById('startBtn');
    startBtn.disabled = true;
    startBtn.textContent = '启动中...';
    
    try {
        const response = await apiRequest(`${API_BASE}/instance/start`, {
            method: 'POST'
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('实例启动成功！', 'success');
            await loadUserInfo();
            await loadInstanceStatus();
        } else {
            showMessage(data.error || '启动失败');
        }
    } catch (error) {
        console.error('Start instance error:', error);
        showMessage('启动失败，请重试');
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = '▶️ 启动实例';
    }
}

// 停止实例
async function handleStop() {
    if (!confirm('确定要停止实例吗？')) return;
    
    const stopBtn = document.getElementById('stopBtn');
    stopBtn.disabled = true;
    stopBtn.textContent = '停止中...';
    
    try {
        const response = await apiRequest(`${API_BASE}/instance/stop`, {
            method: 'POST'
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('实例已停止', 'success');
            await loadUserInfo();
            await loadInstanceStatus();
        } else {
            showMessage(data.error || '停止失败');
        }
    } catch (error) {
        console.error('Stop instance error:', error);
        showMessage('停止失败，请重试');
    } finally {
        stopBtn.disabled = false;
        stopBtn.textContent = '⏹️ 停止实例';
    }
}

// 重启实例
async function handleRestart() {
    if (!confirm('确定要重启实例吗？')) return;
    
    const restartBtn = document.getElementById('restartBtn');
    restartBtn.disabled = true;
    restartBtn.textContent = '重启中...';
    
    try {
        const response = await apiRequest(`${API_BASE}/instance/restart`, {
            method: 'POST'
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('实例重启成功！', 'success');
            await loadUserInfo();
            await loadInstanceStatus();
        } else {
            showMessage(data.error || '重启失败');
        }
    } catch (error) {
        console.error('Restart instance error:', error);
        showMessage('重启失败，请重试');
    } finally {
        restartBtn.disabled = false;
        restartBtn.textContent = '🔄 重启实例';
    }
}

// 退出登录
function handleLogout() {
    if (confirm('确定要退出登录吗？')) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.href = '/';
    }
}

// 开始状态检查
function startStatusCheck() {
    // 立即执行一次
    loadInstanceStatus();
    
    // 每5秒检查一次
    statusCheckInterval = setInterval(loadInstanceStatus, 5000);
}

// 停止状态检查
function stopStatusCheck() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
}

// 检查认证状态
function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = '/';
        return false;
    }
    return true;
}

// 页面初始化
async function init() {
    if (!checkAuth()) return;
    
    await loadUserInfo();
    startStatusCheck();
}

// 页面卸载时停止状态检查
window.addEventListener('beforeunload', stopStatusCheck);

// 页面加载完成后初始化
init();
