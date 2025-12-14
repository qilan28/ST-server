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
function showMessage(text, type = 'error', elementId = 'controlMessage') {
    const messageEl = document.getElementById(elementId);
    if (!messageEl) return;
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
            
            // 更新版本管理区域
            updateVersionInfo(data);
            
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

// ==================== 版本管理功能 ====================

let availableVersions = { releases: [], branches: [] };

// 更新版本信息显示
function updateVersionInfo(data) {
    // 显示当前版本
    const currentVersionEl = document.getElementById('currentVersion');
    if (data.stVersion) {
        currentVersionEl.textContent = data.stVersion;
    } else {
        currentVersionEl.textContent = '未安装';
    }
    
    // 显示安装状态
    const setupStatusEl = document.getElementById('setupStatus').querySelector('.status-badge');
    const statusMap = {
        'pending': { text: '未安装', class: 'status-pending' },
        'installing': { text: '安装中', class: 'status-installing' },
        'completed': { text: '已完成', class: 'status-completed' },
        'failed': { text: '失败', class: 'status-failed' }
    };
    
    const statusInfo = statusMap[data.stSetupStatus] || statusMap['pending'];
    setupStatusEl.textContent = statusInfo.text;
    setupStatusEl.className = `status-badge ${statusInfo.class}`;
    
    // 检查依赖状态
    checkDependencies();
}

// 检查依赖状态
async function checkDependencies() {
    try {
        const response = await apiRequest(`${API_BASE}/version/check-dependencies`);
        if (!response) return;
        
        const data = await response.json();
        
        const depStatusEl = document.getElementById('dependencyStatus').querySelector('.status-badge');
        if (data.installed) {
            depStatusEl.textContent = '已安装';
            depStatusEl.className = 'status-badge status-installed';
        } else {
            depStatusEl.textContent = '未安装';
            depStatusEl.className = 'status-badge status-not-installed';
        }
    } catch (error) {
        console.error('Check dependencies error:', error);
    }
}

// 显示版本选择器
async function showVersionSelector() {
    const selector = document.getElementById('versionSelector');
    selector.style.display = 'block';
    
    // 加载版本列表（如果还没加载）
    if (availableVersions.releases.length === 0 && availableVersions.branches.length === 0) {
        await loadVersionList();
    }
}

// 隐藏版本选择器
function hideVersionSelector() {
    const selector = document.getElementById('versionSelector');
    selector.style.display = 'none';
}

// 加载版本列表
async function loadVersionList() {
    try {
        const response = await fetch(`${API_BASE}/version/list`);
        if (!response.ok) {
            throw new Error('Failed to load versions');
        }
        
        const data = await response.json();
        availableVersions = data;
        
        // 渲染正式版本
        const releasesList = document.getElementById('releasesList');
        if (data.releases.length > 0) {
            releasesList.innerHTML = data.releases.map(version => `
                <div class="version-item">
                    <div>
                        <div class="version-name">${version.name}</div>
                        <div class="version-date">${new Date(version.published_at).toLocaleDateString('zh-CN')}</div>
                    </div>
                    <button class="btn btn-primary" onclick="handleSwitchVersion('${version.name}')">
                        选择
                    </button>
                </div>
            `).join('');
        } else {
            releasesList.innerHTML = '<div style="padding: 15px; text-align: center; color: #718096;">暂无版本</div>';
        }
        
        // 渲染开发分支
        const branchesList = document.getElementById('branchesList');
        if (data.branches.length > 0) {
            branchesList.innerHTML = data.branches.map(branch => `
                <div class="version-item">
                    <div>
                        <div class="version-name">${branch.name}</div>
                        <div class="version-date">最新提交: ${new Date(branch.commit.date).toLocaleDateString('zh-CN')}</div>
                    </div>
                    <button class="btn btn-primary" onclick="handleSwitchVersion('${branch.name}')">
                        选择
                    </button>
                </div>
            `).join('');
        } else {
            branchesList.innerHTML = '<div style="padding: 15px; text-align: center; color: #718096;">暂无分支</div>';
        }
        
    } catch (error) {
        console.error('Load versions error:', error);
        showMessage('加载版本列表失败', 'error', 'versionMessage');
    }
}

// 切换版本
async function handleSwitchVersion(version) {
    if (!confirm(`确定要切换到版本 ${version} 吗？\n\n这将删除当前版本并安装新版本，请确保已停止实例。`)) {
        return;
    }
    
    hideVersionSelector();
    showMessage(`正在切换到版本 ${version}，请稍候...`, 'info', 'versionMessage');
    
    try {
        const response = await apiRequest(`${API_BASE}/version/switch`, {
            method: 'POST',
            body: JSON.stringify({ version })
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`版本切换已开始，请等待安装完成（约3-5分钟）`, 'success', 'versionMessage');
            
            // 定期检查安装状态
            const checkInterval = setInterval(async () => {
                await loadUserInfo();
                const statusEl = document.getElementById('setupStatus').querySelector('.status-badge');
                
                if (statusEl.textContent === '已完成') {
                    clearInterval(checkInterval);
                    showMessage('版本切换完成！', 'success', 'versionMessage');
                } else if (statusEl.textContent === '失败') {
                    clearInterval(checkInterval);
                    showMessage('版本切换失败，请查看日志', 'error', 'versionMessage');
                }
            }, 5000);
        } else {
            showMessage(data.error || '切换版本失败', 'error', 'versionMessage');
        }
    } catch (error) {
        console.error('Switch version error:', error);
        showMessage('切换版本失败，请重试', 'error', 'versionMessage');
    }
}

// 重装依赖
async function handleReinstallDependencies() {
    if (!confirm('确定要重新安装依赖吗？\n\n请确保已停止实例。这可能需要几分钟时间。')) {
        return;
    }
    
    showMessage('正在重新安装依赖...', 'info', 'versionMessage');
    
    try {
        const response = await apiRequest(`${API_BASE}/version/reinstall-dependencies`, {
            method: 'POST'
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('依赖重装已开始，请等待完成（约2-3分钟）', 'success', 'versionMessage');
            
            // 5秒后重新检查依赖状态
            setTimeout(async () => {
                await checkDependencies();
            }, 5000);
        } else {
            showMessage(data.error || '重装依赖失败', 'error', 'versionMessage');
        }
    } catch (error) {
        console.error('Reinstall dependencies error:', error);
        showMessage('重装依赖失败，请重试', 'error', 'versionMessage');
    }
}

// 删除版本
async function handleDeleteVersion() {
    if (!confirm('确定要删除当前版本吗？\n\n这将删除所有 SillyTavern 代码文件，但不会删除您的数据。\n请确保已停止实例。')) {
        return;
    }
    
    showMessage('正在删除版本...', 'info', 'versionMessage');
    
    try {
        const response = await apiRequest(`${API_BASE}/version/delete`, {
            method: 'POST'
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('版本已删除', 'success', 'versionMessage');
            await loadUserInfo();
        } else {
            showMessage(data.error || '删除版本失败', 'error', 'versionMessage');
        }
    } catch (error) {
        console.error('Delete version error:', error);
        showMessage('删除版本失败，请重试', 'error', 'versionMessage');
    }
}

// ==================== 初始化 ====================

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
