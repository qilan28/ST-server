const API_BASE = '/api';
let statusCheckInterval = null;

// 设置 Cookie
function setCookie(name, value, days = 365) {
    try {
        // 方法 1：使用 max-age（更简单、更可靠）
        document.cookie = `${name}=${value}; path=/; max-age=${days * 24 * 60 * 60}`;
        
        // 验证是否设置成功
        if (document.cookie.includes(`${name}=`)) {
            console.log(`[Cookie] ✅ ${name} 设置成功`);
            return true;
        }
        
        // 方法 2：如果方法 1 失败，尝试添加 SameSite
        document.cookie = `${name}=${value}; path=/; max-age=${days * 24 * 60 * 60}; SameSite=Lax`;
        
        if (document.cookie.includes(`${name}=`)) {
            console.log(`[Cookie] ✅ ${name} 设置成功（方法2）`);
            return true;
        }
        
        console.error(`[Cookie] ❌ ${name} 设置失败 - 浏览器可能阻止了 Cookie`);
        console.error(`[Cookie] 💡 请检查浏览器地址栏左侧的锁图标 → Cookie 设置`);
        return false;
    } catch (error) {
        console.error(`[Cookie] ❌ 设置失败:`, error);
        return false;
    }
}

// 删除 Cookie
function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

// 公告轮播相关变量
let dashboardAnnouncements = [];
let currentDashboardAnnouncementIndex = 0;
let dashboardAnnouncementInterval = null;

// 加载用户面板公告
async function loadDashboardAnnouncements() {
    try {
        const response = await fetch(`${API_BASE}/announcements/dashboard`);
        if (!response.ok) return;
        
        const data = await response.json();
        dashboardAnnouncements = data.announcements;
        
        if (dashboardAnnouncements && dashboardAnnouncements.length > 0) {
            document.getElementById('dashboardAnnouncementContainer').style.display = 'block';
            showDashboardAnnouncement(0);
            
            // 如果有多个公告，显示控制按钮并启动自动轮播
            if (dashboardAnnouncements.length > 1) {
                document.getElementById('dashboardAnnouncementControls').style.display = 'flex';
                createDashboardIndicators();
                startDashboardAutoPlay();
            }
        }
    } catch (error) {
        console.error('Load dashboard announcements error:', error);
    }
}

// 显示指定索引的公告
function showDashboardAnnouncement(index) {
    if (!dashboardAnnouncements || dashboardAnnouncements.length === 0) return;
    
    currentDashboardAnnouncementIndex = index;
    const announcement = dashboardAnnouncements[index];
    
    document.getElementById('dashboardAnnouncementTitle').textContent = announcement.title;
    document.getElementById('dashboardAnnouncementContent').textContent = announcement.content;
    
    const date = new Date(announcement.created_at);
    document.getElementById('dashboardAnnouncementDate').textContent = `发布于 ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    
    updateDashboardIndicators();
}

// 创建指示器
function createDashboardIndicators() {
    const container = document.getElementById('dashboardAnnouncementIndicators');
    container.innerHTML = '';
    
    for (let i = 0; i < dashboardAnnouncements.length; i++) {
        const dot = document.createElement('span');
        dot.style.cssText = 'width: 12px; height: 12px; border-radius: 50%; background: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.3s;';
        dot.onclick = () => {
            stopDashboardAutoPlay();
            showDashboardAnnouncement(i);
            startDashboardAutoPlay();
        };
        container.appendChild(dot);
    }
}

// 更新指示器
function updateDashboardIndicators() {
    const dots = document.getElementById('dashboardAnnouncementIndicators').children;
    for (let i = 0; i < dots.length; i++) {
        dots[i].style.background = i === currentDashboardAnnouncementIndex ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.5)';
        dots[i].style.transform = i === currentDashboardAnnouncementIndex ? 'scale(1.3)' : 'scale(1)';
    }
}

// 上一个公告
function prevDashboardAnnouncement() {
    stopDashboardAutoPlay();
    const newIndex = (currentDashboardAnnouncementIndex - 1 + dashboardAnnouncements.length) % dashboardAnnouncements.length;
    showDashboardAnnouncement(newIndex);
    startDashboardAutoPlay();
}

// 下一个公告
function nextDashboardAnnouncement() {
    stopDashboardAutoPlay();
    const newIndex = (currentDashboardAnnouncementIndex + 1) % dashboardAnnouncements.length;
    showDashboardAnnouncement(newIndex);
    startDashboardAutoPlay();
}

// 启动自动轮播
function startDashboardAutoPlay() {
    stopDashboardAutoPlay();
    if (dashboardAnnouncements.length > 1) {
        dashboardAnnouncementInterval = setInterval(() => {
            const newIndex = (currentDashboardAnnouncementIndex + 1) % dashboardAnnouncements.length;
            showDashboardAnnouncement(newIndex);
        }, 5000); // 每5秒切换
    }
}

// 停止自动轮播
function stopDashboardAutoPlay() {
    if (dashboardAnnouncementInterval) {
        clearInterval(dashboardAnnouncementInterval);
        dashboardAnnouncementInterval = null;
    }
}

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
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;
    const seconds = totalSeconds % 60;
    
    if (days > 0) {
        return hours > 0 ? `${days}天${hours}小时` : `${days}天`;
    }
    if (totalHours > 0) {
        return minutes > 0 ? `${totalHours}小时${minutes}分钟` : `${totalHours}小时`;
    }
    if (totalMinutes > 0) return `${totalMinutes}分钟`;
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
            // 如果是纯管理员用户（没有 SillyTavern 实例），重定向到管理员面板
            if (data.role === 'admin' && data.stSetupStatus === 'N/A') {
                window.location.href = '/admin.html';
                return;
            }
            
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
            
            // 如果是管理员，显示管理员面板链接
            if (data.role === 'admin') {
                const adminLink = document.getElementById('adminLink');
                if (adminLink) {
                    adminLink.style.display = 'inline-block';
                }
            }
            
            const accessUrl = data.accessUrl;
            const accessLink = document.getElementById('accessUrl');
            accessLink.textContent = accessUrl;
            accessLink.href = accessUrl;
            accessLink.title = accessUrl; // 悬停显示完整URL
            
            // 增加点击事件日志和 Cookie 检查
            accessLink.onclick = function(e) {
                e.preventDefault(); // 阻止默认行为
                
                const token = localStorage.getItem('token');
                const cookies = document.cookie;
                console.log('\n========== [前端] 点击访问地址 ==========');
                console.log('[前端] 📍 目标地址:', accessUrl);
                console.log('[前端] 👤 当前用户:', data.username);
                console.log('[前端] 🔑 localStorage token:', token ? `存在 (${token.substring(0, 20)}...)` : '不存在');
                console.log('[前端] 🍪 所有 Cookies:', cookies || '无');
                console.log('[前端] 🍪 st_token Cookie:', cookies.includes('st_token') ? '存在' : '❌ 不存在！');
                
                // 检查 token
                if (!token) {
                    console.error('[前端] ❌ 未找到 token，请重新登录');
                    alert('登录状态已失效，请重新登录');
                    console.log('==========================================\n');
                    window.location.href = '/';
                    return;
                }
                
                // 使用中转页面打开，确保 Cookie 被正确设置
                // 中转页会先设置 Cookie，然后再跳转到实例
                const redirectUrl = `/redirect-with-auth.html?url=${encodeURIComponent(accessUrl)}`;
                console.log('[前端] 🔄 使用中转页面:', redirectUrl);
                console.log('[前端] 💡 中转页将自动设置 Cookie 并跳转');
                console.log('==========================================\n');
                
                // 打开中转页
                window.open(redirectUrl, '_blank');
            };
            
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
        // 同时清除 st_token cookie
        deleteCookie('st_token');
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

// ==================== 日志查看功能 ====================

let currentLogType = 'out';
let autoRefreshInterval = null;
let isAutoRefreshing = false;

// 加载日志
async function loadLogs(type = currentLogType, lines = 100) {
    try {
        const response = await apiRequest(`${API_BASE}/instance/logs?type=${type}&lines=${lines}`);
        if (!response) return;
        
        const data = await response.json();
        
        const logsContent = document.getElementById('logsContent');
        const logsStatus = document.getElementById('logsStatus');
        const logsTotalLines = document.getElementById('logsTotalLines');
        
        if (!data.exists) {
            logsContent.textContent = '日志文件不存在（实例可能未启动过）';
            logsStatus.textContent = '日志状态: 不存在';
            logsTotalLines.textContent = '';
            return;
        }
        
        if (data.logs.length === 0) {
            logsContent.textContent = '暂无日志内容';
            logsStatus.textContent = '日志状态: 空';
            logsTotalLines.textContent = '';
            return;
        }
        
        // 格式化日志内容
        const formattedLogs = data.logs.map(line => {
            // 简单的日志高亮
            if (line.toLowerCase().includes('error') || line.toLowerCase().includes('err')) {
                return `<div class="log-line error">${escapeHtml(line)}</div>`;
            } else if (line.toLowerCase().includes('warn') || line.toLowerCase().includes('warning')) {
                return `<div class="log-line warn">${escapeHtml(line)}</div>`;
            } else if (line.toLowerCase().includes('info')) {
                return `<div class="log-line info">${escapeHtml(line)}</div>`;
            }
            return `<div class="log-line">${escapeHtml(line)}</div>`;
        }).join('');
        
        logsContent.innerHTML = formattedLogs;
        logsStatus.textContent = `日志状态: ${type === 'out' ? '标准输出' : '错误日志'}`;
        logsTotalLines.textContent = `总行数: ${data.totalLines} | 显示: ${data.logs.length}`;
        
        // 自动滚动到底部
        const container = document.getElementById('logsContainer');
        container.scrollTop = container.scrollHeight;
        
    } catch (error) {
        console.error('Load logs error:', error);
        document.getElementById('logsContent').textContent = '加载日志失败';
    }
}

// HTML转义（防止XSS）
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 切换日志类型
function switchLogType(type) {
    currentLogType = type;
    
    // 更新按钮样式
    const outBtn = document.getElementById('outLogBtn');
    const errorBtn = document.getElementById('errorLogBtn');
    
    if (type === 'out') {
        outBtn.className = 'btn btn-sm btn-primary';
        errorBtn.className = 'btn btn-sm btn-secondary';
    } else {
        outBtn.className = 'btn btn-sm btn-secondary';
        errorBtn.className = 'btn btn-sm btn-primary';
    }
    
    loadLogs(type);
}

// 刷新日志
function refreshLogs() {
    loadLogs(currentLogType);
}

// 清空日志显示
function clearLogsDisplay() {
    document.getElementById('logsContent').textContent = '已清空显示（点击刷新重新加载）';
    document.getElementById('logsStatus').textContent = '已清空';
    document.getElementById('logsTotalLines').textContent = '';
}

// 切换自动刷新
function toggleAutoRefresh() {
    const btn = document.getElementById('autoRefreshBtn');
    
    if (isAutoRefreshing) {
        // 停止自动刷新
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        isAutoRefreshing = false;
        btn.textContent = '▶️ 自动刷新';
        btn.className = 'btn btn-sm btn-success';
    } else {
        // 开始自动刷新
        loadLogs(); // 立即加载一次
        autoRefreshInterval = setInterval(() => {
            loadLogs(currentLogType);
        }, 3000); // 每3秒刷新一次
        isAutoRefreshing = true;
        btn.textContent = '⏸️ 停止刷新';
        btn.className = 'btn btn-sm btn-danger';
    }
}

// 停止自动刷新
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        isAutoRefreshing = false;
        const btn = document.getElementById('autoRefreshBtn');
        if (btn) {
            btn.textContent = '▶️ 自动刷新';
            btn.className = 'btn btn-sm btn-success';
        }
    }
}

// ==================== 删除账号 ====================

// 删除账号
async function handleDeleteAccount() {
    const username = getUsername();
    
    // 第一次确认
    const confirmMessage1 = `⚠️ 危险操作！\n\n您确定要删除账号 "${username}" 吗？\n\n此操作将会：\n• 删除您的 SillyTavern 实例\n• 删除所有对话记录、角色和设置\n• 删除用户数据目录\n• 此操作不可恢复！\n\n请输入 "DELETE" 以确认删除`;
    
    const userInput = prompt(confirmMessage1);
    
    if (userInput !== 'DELETE') {
        if (userInput !== null) {
            alert('❌ 输入不正确，删除已取消');
        }
        return;
    }
    
    // 第二次确认
    const confirmMessage2 = `🚨 最后确认！\n\n您真的要删除账号 "${username}" 吗？\n\n点击"确定"将立即删除账号，此操作无法撤销！`;
    
    if (!confirm(confirmMessage2)) {
        return;
    }
    
    try {
        // 显示处理中
        const deleteBtn = event.target;
        const originalText = deleteBtn.textContent;
        deleteBtn.disabled = true;
        deleteBtn.textContent = '⏳ 删除中...';
        
        const response = await apiRequest(`${API_BASE}/auth/account`, {
            method: 'DELETE'
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            // 清除本地存储
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            
            // 显示成功消息并跳转
            alert('✅ 账号已成功删除！\n\n感谢您使用 SillyTavern 多开管理平台。');
            
            // 跳转到首页
            window.location.href = '/';
        } else {
            throw new Error(data.message || data.error || '删除失败');
        }
    } catch (error) {
        console.error('Delete account error:', error);
        alert('❌ 删除账号失败：' + error.message);
        
        // 恢复按钮状态
        if (event.target) {
            event.target.disabled = false;
            event.target.textContent = '🗑️ 删除我的账号';
        }
    }
}

// ==================== 备份功能 ====================

// 加载备份配置
async function loadBackupConfig() {
    try {
        const response = await fetch(`${API_BASE}/backup/hf-config`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.config) {
                document.getElementById('hfRepo').value = data.config.hfRepo || '';
                document.getElementById('hfEmail').value = data.config.hfEmail || '';
                // Token 不显示完整内容，只显示是否已设置
                if (data.config.hfTokenSet) {
                    document.getElementById('hfToken').placeholder = `已设置 (${data.config.hfTokenPreview})`;
                }
            }
        }
    } catch (error) {
        console.error('Load backup config error:', error);
    }
}

// 保存备份配置
async function handleSaveBackupConfig() {
    const hfRepo = document.getElementById('hfRepo').value.trim();
    const hfToken = document.getElementById('hfToken').value.trim();
    const hfEmail = document.getElementById('hfEmail').value.trim();
    const messageDiv = document.getElementById('backupMessage');
    
    if (!hfRepo || !hfToken || !hfEmail) {
        messageDiv.className = 'message error';
        messageDiv.textContent = '❌ 请填写完整的配置信息（Token、仓库名、邮箱）';
        return;
    }
    
    // 验证仓库名格式
    if (!hfRepo.includes('/')) {
        messageDiv.className = 'message error';
        messageDiv.textContent = '❌ 仓库名格式错误，应为: username/repo-name';
        return;
    }
    
    try {
        messageDiv.className = 'message info';
        messageDiv.textContent = '⏳ 正在保存配置...';
        
        const response = await fetch(`${API_BASE}/backup/hf-config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ hfToken, hfRepo, hfEmail })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            messageDiv.className = 'message success';
            messageDiv.textContent = '✅ 配置保存成功！';
            
            // 清空密码框并更新提示
            document.getElementById('hfToken').value = '';
            document.getElementById('hfToken').placeholder = '已设置';
            document.getElementById('hfEmail').value = '';
            document.getElementById('hfEmail').placeholder = '已设置';
        } else {
            throw new Error(data.error || '保存失败');
        }
    } catch (error) {
        console.error('Save backup config error:', error);
        messageDiv.className = 'message error';
        messageDiv.textContent = '❌ 保存失败：' + error.message;
    }
}

// 测试连接
async function handleTestConnection() {
    const hfRepo = document.getElementById('hfRepo').value.trim();
    const hfToken = document.getElementById('hfToken').value.trim();
    const messageDiv = document.getElementById('backupMessage');
    
    try {
        messageDiv.className = 'message info';
        messageDiv.textContent = '⏳ 正在测试连接...';
        
        const body = {};
        if (hfRepo) body.hfRepo = hfRepo;
        if (hfToken) body.hfToken = hfToken;
        
        const response = await fetch(`${API_BASE}/backup/test-connection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (data.success) {
            messageDiv.className = 'message success';
            let message = '✅ 连接成功！\n';
            if (data.repoInfo) {
                message += `\n仓库: ${data.repoInfo.id || data.repoInfo.name}\n`;
                message += `作者: ${data.repoInfo.author}\n`;
                message += `类型: ${data.repoInfo.private ? '私有' : '公开'}`;
            }
            messageDiv.textContent = message;
        } else {
            messageDiv.className = 'message error';
            messageDiv.textContent = '❌ ' + (data.message || '连接失败');
        }
    } catch (error) {
        console.error('Test connection error:', error);
        messageDiv.className = 'message error';
        messageDiv.textContent = '❌ 连接测试失败：' + error.message;
    }
}

// 执行备份（使用 SSE 实时日志）
let backupEventSource = null;

async function handleBackup() {
    const messageDiv = document.getElementById('backupMessage');
    const statusDiv = document.getElementById('backupStatus');
    const statusContent = document.getElementById('backupStatusContent');
    const logsContainer = document.getElementById('backupLogsContainer');
    const logsDiv = document.getElementById('backupLogs');
    
    // 确认操作
    if (!confirm('确定要立即备份您的数据到 Hugging Face 吗？\n\n备份过程可能需要几分钟，取决于数据大小。')) {
        return;
    }
    
    try {
        // 清空日志
        logsDiv.innerHTML = '';
        logsContainer.style.display = 'block';
        statusDiv.style.display = 'none';
        
        messageDiv.className = 'message info';
        messageDiv.textContent = '🚀 备份中，请查看下方实时日志...';
        
        // 关闭旧的 EventSource
        if (backupEventSource) {
            backupEventSource.close();
        }
        
        // 创建 SSE 连接
        backupEventSource = new EventSource(`${API_BASE}/backup/backup?token=${localStorage.getItem('token')}`);
        
        // 监听消息
        backupEventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // 添加日志
                addBackupLog(data.message, data.type);
                
                // 检查完成状态
                if (data.type === 'done') {
                    messageDiv.className = 'message success';
                    messageDiv.textContent = '✅ 备份完成！';
                    
                    backupEventSource.close();
                    backupEventSource = null;
                    
                    // 显示备份详情
                    if (data.result) {
                        statusDiv.style.display = 'block';
                        statusContent.innerHTML = `
                            <p><strong>备份文件:</strong> ${data.result.filename}</p>
                            <p><strong>文件大小:</strong> ${(data.result.size / 1024 / 1024).toFixed(2)} MB</p>
                            <p><strong>备份时间:</strong> ${new Date(data.result.timestamp).toLocaleString()}</p>
                            <p><strong>下载地址:</strong> <a href="${data.result.url}" target="_blank">${data.result.url}</a></p>
                        `;
                    }
                } else if (data.type === 'error') {
                    messageDiv.className = 'message error';
                    messageDiv.textContent = '❌ 备份失败：' + data.error;
                    
                    backupEventSource.close();
                    backupEventSource = null;
                }
            } catch (err) {
                console.error('解析日志消息失败:', err);
            }
        };
        
        // 监听错误
        backupEventSource.onerror = (error) => {
            console.error('SSE 连接错误:', error);
            messageDiv.className = 'message error';
            messageDiv.textContent = '❌ 连接失败，请重试';
            
            addBackupLog('❌ 连接失败，请重试', 'error');
            
            if (backupEventSource) {
                backupEventSource.close();
                backupEventSource = null;
            }
        };
        
    } catch (error) {
        console.error('Backup error:', error);
        messageDiv.className = 'message error';
        messageDiv.textContent = '❌ 备份失败：' + error.message;
        logsContainer.style.display = 'none';
    }
}

// 添加备份日志
function addBackupLog(message, type = 'info') {
    const logsDiv = document.getElementById('backupLogs');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    
    // 添加时间戳
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `
        <span class="log-time">[${timestamp}]</span>
        <span class="log-message">${escapeHtml(message)}</span>
    `;
    
    logsDiv.appendChild(logEntry);
    
    // 自动滚动到底部
    logsDiv.scrollTop = logsDiv.scrollHeight;
}

// 转义 HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== 初始化 ====================

// 页面初始化
async function init() {
    if (!checkAuth()) return;
    
    console.log('\n========== [前端] 页面初始化 ==========');
    
    // 确保 cookie 中也有 token（用于 Nginx 权限验证）
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    console.log('[前端] 👤 当前用户:', username);
    console.log('[前端] 🔑 localStorage token:', token ? `存在 (${token.substring(0, 20)}...)` : '❌ 不存在');
    
    if (token) {
        console.log('[前端] 🍪 设置前的 Cookies:', document.cookie || '(空)');
        
        const success = setCookie('st_token', token);
        
        // 立即读取验证
        const cookiesAfter = document.cookie;
        console.log('[前端] 🍪 设置后的 Cookies:', cookiesAfter || '(空)');
        
        if (!success || !cookiesAfter.includes('st_token')) {
            console.error('[前端] ❌ Cookie 设置失败！正在尝试诊断...');
            console.error('[前端] 当前域名:', window.location.hostname);
            console.error('[前端] 当前协议:', window.location.protocol);
            console.error('[前端] 当前路径:', window.location.pathname);
            
            // 尝试最简单的 Cookie 设置
            console.log('[前端] 尝试最简单的 Cookie 设置...');
            document.cookie = 'test=1';
            console.log('[前端] 测试 Cookie 结果:', document.cookie);
            
            if (!document.cookie.includes('test')) {
                console.error('[前端] ❌❌❌ 浏览器完全无法设置 Cookie！');
                console.error('[前端] 可能原因：');
                console.error('[前端] 1. 浏览器隐私模式/无痕模式');
                console.error('[前端] 2. 浏览器扩展阻止了 Cookie');
                console.error('[前端] 3. 浏览器安全策略限制');
            }
        }
    } else {
        console.log('[前端] ❌ 无法设置 st_token cookie - localStorage 中没有 token');
    }
    console.log('==========================================\n');
    
    await loadUserInfo();
    await loadDashboardAnnouncements();
    await loadBackupConfig();
    startStatusCheck();
    
    // 初始加载日志
    loadLogs('out');
}

// 页面卸载时停止状态检查和自动刷新
window.addEventListener('beforeunload', () => {
    stopStatusCheck();
    stopAutoRefresh();
});

// ==================== 恢复备份功能 ====================

// 显示/隐藏恢复面板并加载备份列表
async function handleShowRestorePanel() {
    const restorePanel = document.getElementById('restorePanel');
    const restoreList = document.getElementById('restoreList');
    const restoreMessage = document.getElementById('restoreMessage');
    
    // 切换面板显示
    if (restorePanel.style.display === 'none') {
        restorePanel.style.display = 'block';
        restoreMessage.className = 'message';
        restoreMessage.textContent = '';
        
        // 加载备份列表
        restoreList.innerHTML = '<div class="loading">加载备份列表中...</div>';
        
        try {
            const response = await fetch(`${API_BASE}/backup/list`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            const data = await response.json();
            
            if (data.success && data.backups) {
                if (data.backups.length === 0) {
                    restoreList.innerHTML = '<div class="empty-logs">仓库中没有备份文件</div>';
                } else {
                    // 显示备份列表
                    let html = '<div class="backup-list-container">';
                    html += '<table class="backup-table">';
                    html += '<thead><tr><th>备份时间</th><th>文件大小</th><th>操作</th></tr></thead>';
                    html += '<tbody>';
                    
                    data.backups.forEach(backup => {
                        const date = new Date(backup.timestamp);
                        const dateStr = date.toLocaleString('zh-CN');
                        const sizeMB = (backup.size / 1024 / 1024).toFixed(2);
                        
                        html += '<tr>';
                        html += `<td>${dateStr}</td>`;
                        html += `<td>${sizeMB} MB</td>`;
                        html += `<td><button class="btn btn-sm btn-primary" onclick="handleRestore('${backup.filename}')">恢复</button></td>`;
                        html += '</tr>';
                    });
                    
                    html += '</tbody></table>';
                    html += '<div style="margin-top: 10px; color: #666;">';
                    html += '💡 提示：默认恢复最早的备份。点击"恢复"按钮将覆盖当前数据。';
                    html += '</div>';
                    html += '</div>';
                    
                    restoreList.innerHTML = html;
                }
            } else {
                restoreList.innerHTML = `<div class="message error">加载失败: ${data.error || '未知错误'}</div>`;
            }
        } catch (error) {
            console.error('Load backups error:', error);
            restoreList.innerHTML = `<div class="message error">❌ 加载备份列表失败: ${error.message}</div>`;
        }
    } else {
        restorePanel.style.display = 'none';
    }
}

// 恢复备份（使用 SSE 实时日志）
let restoreEventSource = null;

async function handleRestore(filename = null) {
    const restoreMessage = document.getElementById('restoreMessage');
    const restoreLogsContainer = document.getElementById('restoreLogsContainer');
    const restoreLogs = document.getElementById('restoreLogs');
    
    // 确认操作
    let confirmMsg = '确定要恢复备份吗？\n\n⚠️ 警告：此操作将：\n1. 备份当前数据到临时目录\n2. 用备份文件替换当前数据\n3. 自动重启 SillyTavern 实例\n\n是否继续？';
    if (filename) {
        confirmMsg = `确定要恢复备份 "${filename}" 吗？\n\n` + confirmMsg;
    } else {
        confirmMsg = '将恢复最早的备份。\n\n' + confirmMsg;
    }
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    try {
        // 清空日志
        restoreLogs.innerHTML = '';
        restoreLogsContainer.style.display = 'block';
        
        restoreMessage.className = 'message info';
        restoreMessage.textContent = '🚀 恢复中，请查看下方实时日志...';
        
        // 关闭旧的 EventSource
        if (restoreEventSource) {
            restoreEventSource.close();
        }
        
        // 创建 SSE 连接
        const url = filename 
            ? `${API_BASE}/backup/restore?token=${localStorage.getItem('token')}&filename=${encodeURIComponent(filename)}`
            : `${API_BASE}/backup/restore?token=${localStorage.getItem('token')}`;
        
        restoreEventSource = new EventSource(url);
        
        // 监听消息
        restoreEventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // 添加日志
                addRestoreLog(data.message, data.type);
                
                // 检查完成状态
                if (data.type === 'done') {
                    restoreMessage.className = 'message success';
                    restoreMessage.textContent = '✅ 恢复完成！数据已恢复并实例已重启。';
                    
                    restoreEventSource.close();
                    restoreEventSource = null;
                } else if (data.type === 'error') {
                    restoreMessage.className = 'message error';
                    restoreMessage.textContent = '❌ 恢复失败：' + data.error;
                    
                    restoreEventSource.close();
                    restoreEventSource = null;
                }
            } catch (err) {
                console.error('解析日志消息失败:', err);
            }
        };
        
        // 监听错误
        restoreEventSource.onerror = (error) => {
            console.error('SSE 连接错误:', error);
            restoreMessage.className = 'message error';
            restoreMessage.textContent = '❌ 连接失败，请重试';
            
            addRestoreLog('❌ 连接失败，请重试', 'error');
            
            if (restoreEventSource) {
                restoreEventSource.close();
                restoreEventSource = null;
            }
        };
        
    } catch (error) {
        console.error('Restore error:', error);
        restoreMessage.className = 'message error';
        restoreMessage.textContent = '❌ 恢复失败：' + error.message;
        restoreLogsContainer.style.display = 'none';
    }
}

// 添加恢复日志
function addRestoreLog(message, type = 'info') {
    const logsDiv = document.getElementById('restoreLogs');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    
    // 添加时间戳
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `
        <span class="log-time">[${timestamp}]</span>
        <span class="log-message">${escapeHtml(message)}</span>
    `;
    
    logsDiv.appendChild(logEntry);
    
    // 自动滚动到底部
    logsDiv.scrollTop = logsDiv.scrollHeight;
}

// 页面加载完成后初始化
init();
