const API_BASE = '/api';

// ==================== 工具函数 ====================

// 检查认证状态
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// 退出登录
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}

// API 请求封装
async function apiRequest(url, options = {}) {
    const token = localStorage.getItem('token');
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(url, mergedOptions);
        
        if (response.status === 401 || response.status === 403) {
            const data = await response.json();
            if (data.message && data.message.includes('管理员')) {
                showMessage('需要管理员权限才能访问此页面', 'error');
                setTimeout(() => {
                    window.location.href = '/dashboard.html';
                }, 2000);
            } else {
                logout();
            }
            return null;
        }
        
        return response;
    } catch (error) {
        console.error('API request error:', error);
        showMessage('网络请求失败，请重试', 'error');
        return null;
    }
}

// 显示消息
function showMessage(text, type = 'error') {
    const messageEl = document.getElementById('adminMessage');
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.className = `message show ${type}`;
    
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
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
}

// ==================== 数据加载函数 ====================

// 加载系统统计
async function loadStats() {
    try {
        const response = await apiRequest(`${API_BASE}/admin/stats`);
        if (!response) return;
        
        const data = await response.json();
        const stats = data.stats;
        
        document.getElementById('totalUsers').textContent = stats.totalUsers;
        document.getElementById('adminUsers').textContent = stats.adminUsers;
        document.getElementById('regularUsers').textContent = stats.regularUsers;
        document.getElementById('runningInstances').textContent = stats.runningInstances;
        document.getElementById('stoppedInstances').textContent = stats.stoppedInstances;
        document.getElementById('totalCpu').textContent = stats.totalCpu + '%';
        document.getElementById('totalMemory').textContent = stats.totalMemory + ' MB';
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

// 加载用户列表
async function loadUsers() {
    try {
        const response = await apiRequest(`${API_BASE}/admin/users`);
        if (!response) return;
        
        const data = await response.json();
        const users = data.users;
        
        const tbody = document.getElementById('usersTableBody');
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 30px;">暂无用户</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>
                    <span class="role-badge ${user.role === 'admin' ? 'role-admin' : 'role-user'}">
                        ${user.role === 'admin' ? '管理员' : '用户'}
                    </span>
                </td>
                <td>${user.port}</td>
                <td>${user.lastLoginAt ? formatDate(user.lastLoginAt) : '从未登录'}</td>
                <td>
                    <span class="status-badge ${user.status === 'running' ? 'status-running' : 'status-stopped'}">
                        ${user.status === 'running' ? '运行中' : '已停止'}
                    </span>
                </td>
                <td>${user.stVersion || '未安装'}</td>
                <td>
                    <span class="status-badge ${getSetupStatusClass(user.stSetupStatus)}">
                        ${getSetupStatusText(user.stSetupStatus)}
                    </span>
                </td>
                <td>${formatDate(user.createdAt)}</td>
                <td>
                    <div class="action-buttons">
                        ${user.role !== 'admin' ? `
                            ${user.status === 'stopped' ? 
                                `<button onclick="startUserInstance('${user.username}')" class="btn-action btn-start" title="启动">▶️</button>` : 
                                `<button onclick="stopUserInstance('${user.username}')" class="btn-action btn-stop" title="停止">⏸️</button>`
                            }
                            <button onclick="restartUserInstance('${user.username}')" class="btn-action btn-restart" title="重启">🔄</button>
                        ` : ''}
                        <button onclick="toggleUserRole('${user.username}', '${user.role}')" class="btn-action btn-role" title="切换角色">
                            ${user.role === 'admin' ? '👤' : '👑'}
                        </button>
                        <button onclick="deleteUserAccount('${user.username}')" class="btn-action btn-delete" title="删除">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Load users error:', error);
    }
}

// 加载实例列表
async function loadInstances() {
    try {
        const response = await apiRequest(`${API_BASE}/admin/instances`);
        if (!response) return;
        
        const data = await response.json();
        const instances = data.instances;
        
        const tbody = document.getElementById('instancesTableBody');
        
        if (instances.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px;">暂无实例</td></tr>';
            return;
        }
        
        tbody.innerHTML = instances.map(instance => `
            <tr>
                <td>${instance.username}</td>
                <td>
                    <span class="status-badge ${instance.status === 'online' ? 'status-running' : 'status-stopped'}">
                        ${instance.status === 'online' ? '运行中' : '已停止'}
                    </span>
                </td>
                <td>${instance.cpu ? instance.cpu.toFixed(2) + '%' : '0%'}</td>
                <td>${formatMemory(instance.memory)}</td>
                <td>${instance.uptime ? formatUptime(Date.now() - instance.uptime) : '未运行'}</td>
                <td>${instance.restarts || 0}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Load instances error:', error);
    }
}

// 获取安装状态样式类
function getSetupStatusClass(status) {
    const map = {
        'pending': 'status-pending',
        'installing': 'status-installing',
        'completed': 'status-completed',
        'failed': 'status-failed'
    };
    return map[status] || 'status-pending';
}

// 获取安装状态文本
function getSetupStatusText(status) {
    const map = {
        'pending': '未安装',
        'installing': '安装中',
        'completed': '已完成',
        'failed': '失败'
    };
    return map[status] || '未知';
}

// ==================== 用户操作函数 ====================

// 启动用户实例
async function startUserInstance(username) {
    if (!confirm(`确定要启动 ${username} 的实例吗？`)) return;
    
    try {
        const response = await apiRequest(`${API_BASE}/admin/users/${username}/start`, {
            method: 'POST'
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`${username} 的实例已启动`, 'success');
            setTimeout(() => {
                loadUsers();
                loadInstances();
                loadStats();
            }, 1000);
        } else {
            showMessage(data.error || '启动失败', 'error');
        }
    } catch (error) {
        console.error('Start instance error:', error);
        showMessage('启动实例失败', 'error');
    }
}

// 停止用户实例
async function stopUserInstance(username) {
    if (!confirm(`确定要停止 ${username} 的实例吗？`)) return;
    
    try {
        const response = await apiRequest(`${API_BASE}/admin/users/${username}/stop`, {
            method: 'POST'
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`${username} 的实例已停止`, 'success');
            setTimeout(() => {
                loadUsers();
                loadInstances();
                loadStats();
            }, 1000);
        } else {
            showMessage(data.error || '停止失败', 'error');
        }
    } catch (error) {
        console.error('Stop instance error:', error);
        showMessage('停止实例失败', 'error');
    }
}

// 重启用户实例
async function restartUserInstance(username) {
    if (!confirm(`确定要重启 ${username} 的实例吗？`)) return;
    
    try {
        const response = await apiRequest(`${API_BASE}/admin/users/${username}/restart`, {
            method: 'POST'
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`${username} 的实例已重启`, 'success');
            setTimeout(() => {
                loadUsers();
                loadInstances();
                loadStats();
            }, 1000);
        } else {
            showMessage(data.error || '重启失败', 'error');
        }
    } catch (error) {
        console.error('Restart instance error:', error);
        showMessage('重启实例失败', 'error');
    }
}

// 切换用户角色
async function toggleUserRole(username, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const roleText = newRole === 'admin' ? '管理员' : '普通用户';
    
    if (!confirm(`确定要将 ${username} 的角色切换为 ${roleText} 吗？`)) return;
    
    try {
        const response = await apiRequest(`${API_BASE}/admin/users/${username}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role: newRole })
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`${username} 的角色已更新为 ${roleText}`, 'success');
            loadUsers();
            loadStats();
        } else {
            showMessage(data.message || data.error || '角色更新失败', 'error');
        }
    } catch (error) {
        console.error('Toggle role error:', error);
        showMessage('角色更新失败', 'error');
    }
}

// 删除用户
async function deleteUserAccount(username) {
    if (!confirm(`⚠️ 警告：确定要删除用户 ${username} 吗？\n\n这将删除该用户的所有数据，包括：\n- 用户账户\n- SillyTavern 实例\n- 所有数据文件\n\n此操作不可恢复！`)) {
        return;
    }
    
    // 二次确认
    const confirmText = prompt(`请输入用户名 "${username}" 以确认删除：`);
    if (confirmText !== username) {
        showMessage('用户名不匹配，已取消删除', 'error');
        return;
    }
    
    try {
        const response = await apiRequest(`${API_BASE}/admin/users/${username}`, {
            method: 'DELETE'
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`用户 ${username} 已删除`, 'success');
            loadUsers();
            loadInstances();
            loadStats();
        } else {
            showMessage(data.message || data.error || '删除失败', 'error');
        }
    } catch (error) {
        console.error('Delete user error:', error);
        showMessage('删除用户失败', 'error');
    }
}

// ==================== 配置管理 ====================

// 加载配置
async function loadConfig() {
    try {
        const response = await apiRequest(`${API_BASE}/config/nginx`);
        if (!response || !response.ok) {
            throw new Error('Failed to load config');
        }
        
        const data = await response.json();
        const config = data.nginx;
        
        // 填充表单
        document.getElementById('nginxEnabled').checked = config.enabled || false;
        document.getElementById('nginxDomain').value = config.domain || 'localhost';
        document.getElementById('nginxPort').value = config.port || 80;
    } catch (error) {
        console.error('Load config error:', error);
        showMessage('加载配置失败', 'error', 'configMessage');
    }
}

// 保存 Nginx 配置
async function saveNginxConfig() {
    try {
        const enabled = document.getElementById('nginxEnabled').checked;
        const domain = document.getElementById('nginxDomain').value.trim();
        const port = parseInt(document.getElementById('nginxPort').value);
        
        // 验证
        if (!domain) {
            showMessage('请输入域名', 'error', 'configMessage');
            return;
        }
        
        if (isNaN(port) || port < 1 || port > 65535) {
            showMessage('端口必须在 1-65535 之间', 'error', 'configMessage');
            return;
        }
        
        const response = await apiRequest(`${API_BASE}/config/nginx`, {
            method: 'PUT',
            body: JSON.stringify({ enabled, domain, port })
        });
        
        if (!response || !response.ok) {
            throw new Error('Failed to save config');
        }
        
        showMessage('配置保存成功', 'success', 'configMessage');
    } catch (error) {
        console.error('Save config error:', error);
        showMessage('保存配置失败', 'error', 'configMessage');
    }
}

// 生成 Nginx 配置文件
async function generateNginxConfig() {
    try {
        showMessage('正在生成配置文件...', 'info', 'configMessage');
        
        const response = await apiRequest(`${API_BASE}/config/nginx/generate`, {
            method: 'POST'
        });
        
        if (!response || !response.ok) {
            throw new Error('Failed to generate config');
        }
        
        showMessage('Nginx 配置文件生成成功！请查看 nginx/nginx.conf', 'success', 'configMessage');
    } catch (error) {
        console.error('Generate config error:', error);
        showMessage('生成配置文件失败', 'error', 'configMessage');
    }
}

// ==================== 初始化 ====================

let refreshInterval = null;

// 检查当前管理员是否有 ST 实例
async function checkAdminSTStatus() {
    try {
        const response = await apiRequest(`${API_BASE}/instance/info`);
        if (!response) return;
        
        const data = await response.json();
        
        // 如果管理员有 ST 实例，显示返回用户面板按钮
        if (data.stSetupStatus !== 'N/A' && data.stSetupStatus !== 'pending') {
            const backBtn = document.getElementById('backToDashboard');
            if (backBtn) {
                backBtn.style.display = 'inline-block';
            }
        }
    } catch (error) {
        console.error('Check admin ST status error:', error);
    }
}

async function init() {
    if (!checkAuth()) return;
    
    // 检查管理员是否有 ST 实例
    await checkAdminSTStatus();
    
    // 加载数据
    await loadConfig();
    await loadStats();
    await loadUsers();
    await loadInstances();
    
    // 定时刷新（每5秒）
    refreshInterval = setInterval(() => {
        loadStats();
        loadUsers();
        loadInstances();
    }, 5000);
}

// 页面卸载时停止刷新
window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

// 页面加载完成后初始化
init();
