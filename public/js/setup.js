const API_BASE = '/api';
const GITHUB_API = 'https://api.github.com/repos/SillyTavern/SillyTavern';

// 删除 Cookie
function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

let versions = { releases: [], branches: [] };
let currentTab = 'releases';
let checkInterval = null;

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
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.href = '/';
        return null;
    }
    
    return response;
}

// 切换标签页
function switchTab(tab) {
    currentTab = tab;
    
    // 更新按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tab}Content`).classList.add('active');
}

// 显示错误消息
function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

// 隐藏错误消息
function hideError() {
    const errorEl = document.getElementById('errorMessage');
    errorEl.style.display = 'none';
}

// 加载版本列表
async function loadVersions() {
    try {
        const response = await fetch(`${API_BASE}/version/list`);
        if (!response.ok) {
            throw new Error('Failed to load versions');
        }
        
        versions = await response.json();
        
        // 渲染版本列表
        renderReleases();
        renderBranches();
        
        // 显示版本列表
        document.getElementById('loading').style.display = 'none';
        document.getElementById('versionList').style.display = 'block';
        
    } catch (error) {
        console.error('Load versions error:', error);
        document.getElementById('loading').style.display = 'none';
        showError('无法加载版本列表，请检查网络连接或稍后重试');
    }
}

// 渲染正式版本列表
function renderReleases() {
    const container = document.getElementById('releasesList');
    
    if (versions.releases.length === 0) {
        container.innerHTML = '<p class="empty-state">暂无正式版本</p>';
        return;
    }
    
    container.innerHTML = versions.releases.map(release => `
        <div class="version-item ${release.prerelease ? 'prerelease' : ''}">
            <div class="version-info">
                <h3 class="version-name">
                    ${release.name || release.tag}
                    ${release.prerelease ? '<span class="badge badge-warning">预览版</span>' : '<span class="badge badge-success">稳定版</span>'}
                </h3>
                <div class="version-meta">
                    <span>📦 ${release.tag}</span>
                    <span>📅 ${new Date(release.published_at).toLocaleDateString('zh-CN')}</span>
                </div>
            </div>
            <button class="btn btn-primary" onclick="selectVersion('${release.tag}', '${release.name || release.tag}')">
                选择此版本
            </button>
        </div>
    `).join('');
}

// 渲染分支列表
function renderBranches() {
    const container = document.getElementById('branchesList');
    
    if (versions.branches.length === 0) {
        container.innerHTML = '<p class="empty-state">暂无可用分支</p>';
        return;
    }
    
    container.innerHTML = versions.branches.map(branch => `
        <div class="version-item">
            <div class="version-info">
                <h3 class="version-name">
                    ${branch.name}
                    ${branch.name === 'release' ? '<span class="badge badge-info">推荐</span>' : ''}
                </h3>
                <div class="version-meta">
                    <span>🌿 开发分支</span>
                </div>
            </div>
            <button class="btn btn-primary" onclick="selectVersion('${branch.name}', '${branch.name}')">
                选择此分支
            </button>
        </div>
    `).join('');
}

// 选择版本
async function selectVersion(version, displayName) {
    if (!await showConfirm(`确定要安装 ${displayName} 吗？\n\n安装过程可能需要几分钟时间。`, '安装版本')) {
        return;
    }
    
    try {
        // 隐藏版本选择，显示安装进度
        document.getElementById('versionSelectCard').style.display = 'none';
        document.getElementById('installCard').style.display = 'block';
        document.getElementById('installVersion').textContent = displayName;
        document.getElementById('installStatus').textContent = '正在初始化安装...';
        
        // 开始安装
        const response = await apiRequest(`${API_BASE}/version/setup`, {
            method: 'POST',
            body: JSON.stringify({ version })
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('installStatus').textContent = '正在克隆仓库并安装依赖，请耐心等待...';
            
            // 开始轮询检查安装状态
            startStatusCheck();
        } else {
            throw new Error(data.error || '安装失败');
        }
    } catch (error) {
        console.error('Select version error:', error);
        alert('安装失败：' + error.message);
        
        // 返回版本选择
        document.getElementById('installCard').style.display = 'none';
        document.getElementById('versionSelectCard').style.display = 'block';
    }
}

// 开始检查安装状态
function startStatusCheck() {
    checkInterval = setInterval(checkSetupStatus, 3000);
    checkSetupStatus(); // 立即执行一次
}

// 停止检查
function stopStatusCheck() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
}

// 检查安装状态
async function checkSetupStatus() {
    try {
        const response = await apiRequest(`${API_BASE}/version/setup-status`);
        if (!response) return;
        
        const data = await response.json();
        
        if (data.status === 'completed') {
            stopStatusCheck();
            showInstallComplete();
        } else if (data.status === 'failed') {
            stopStatusCheck();
            showInstallFailed();
        } else if (data.status === 'installing') {
            document.getElementById('installStatus').textContent = 
                '正在安装中... 这可能需要几分钟，请不要关闭页面';
        }
    } catch (error) {
        console.error('Check status error:', error);
    }
}

// 显示安装完成
function showInstallComplete() {
    document.getElementById('installCard').style.display = 'none';
    document.getElementById('completeCard').style.display = 'block';
}

// 显示安装失败
function showInstallFailed() {
    document.getElementById('installCard').style.display = 'none';
    alert('安装失败，请重试或联系管理员');
    document.getElementById('versionSelectCard').style.display = 'block';
}

// 进入控制台
function goToDashboard() {
    window.location.href = '/dashboard.html';
}

// 退出登录
async function handleLogout() {
    if (await showConfirm('确定要退出登录吗？', '退出登录')) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        // 同时清除 st_token cookie
        deleteCookie('st_token');
        window.location.href = '/';
    }
}

// 检查认证状态
function checkAuth() {
    const token = getToken();
    const username = getUsername();
    
    if (!token || !username) {
        window.location.href = '/';
        return false;
    }
    
    document.getElementById('currentUsername').textContent = username;
    return true;
}

// 页面初始化
async function init() {
    if (!checkAuth()) return;
    
    // 加载版本列表
    await loadVersions();
}

// 页面卸载时停止检查
window.addEventListener('beforeunload', stopStatusCheck);

// 页面加载完成后初始化
init();
