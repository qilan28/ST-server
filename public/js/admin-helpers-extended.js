/**
 * 管理面板辅助函数扩展
 * 用于加载管理面板中的其他功能（公告、实例、自动备份等）
 */

// 加载用户列表
async function loadUsers() {
    try {
        // 使用带协议检测的URL
        const apiUrl = window.protocolHelper ? 
            window.protocolHelper.getApiUrl('/api/admin/users') : 
            '/api/admin/users';
            
        const token = localStorage.getItem('token');
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.status === 401 || response.status === 403) {
            console.error('加载用户列表需要管理员权限');
            return;
        }
        
        if (!response.ok) {
            console.error('加载用户列表失败:', response.status);
            return;
        }
        
        const data = await response.json();
        const users = data.users;
        
        // 存储原始用户数据，用于搜索功能
        if (typeof storeUsers === 'function') {
            storeUsers(users);
        }
        
        const tbody = document.getElementById('usersTableBody');
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 30px;">暂无用户</td></tr>';
            return;
        }
        
        // 构建HTML
        tbody.innerHTML = users.map(user => `
            <tr>
                <td style="padding: 0;">
                    <div class="user-cell-content">
                        <img src="/images/default-avatar.png" data-username="${user.username}" alt="头像" class="user-avatar">
                        <span>${user.username}</span>
                    </div>
                </td>
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
        
        // 延迟加载头像
        setTimeout(() => {
            lazyLoadUserAvatars();
        }, 100);
        
        console.log('用户列表加载完成');
        
    } catch (error) {
        console.error('加载用户列表错误:', error);
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 30px; color: #e53e3e;">加载失败: ${error.message}</td></tr>`;
    }
}

// 加载公告列表
async function loadAnnouncements() {
    try {
        const apiUrl = window.protocolHelper ? 
            window.protocolHelper.getApiUrl('/api/admin/announcements') : 
            '/api/admin/announcements';
            
        const token = localStorage.getItem('token');
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            console.error('加载公告列表失败:', response.status);
            return;
        }
        
        const data = await response.json();
        const announcements = data.announcements;
        
        const tbody = document.getElementById('announcementsTableBody');
        
        if (!announcements || announcements.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px;">暂无公告</td></tr>';
            return;
        }
        
        tbody.innerHTML = announcements.map(announcement => `
            <tr>
                <td>${announcement.type === 'login' ? '登录页' : '用户面板'}</td>
                <td>${announcement.title}</td>
                <td>
                    <div class="announcement-content">
                        ${announcement.content.replace(/\n/g, '<br>')}
                    </div>
                </td>
                <td>
                    <span class="status-badge ${announcement.is_active ? 'status-running' : 'status-stopped'}">
                        ${announcement.is_active ? '已启用' : '已停用'}
                    </span>
                </td>
                <td>${formatDate(announcement.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button onclick="toggleAnnouncementStatus('${announcement.id}')" class="btn-action ${announcement.is_active ? 'btn-stop' : 'btn-start'}" title="${announcement.is_active ? '停用' : '启用'}">
                            ${announcement.is_active ? '⏸️' : '▶️'}
                        </button>
                        <button onclick="editAnnouncement('${announcement.id}', '${announcement.type}', '${announcement.title}', ${JSON.stringify(announcement.content)}, ${announcement.is_active})" class="btn-action btn-edit" title="编辑">
                            ✏️
                        </button>
                        <button onclick="deleteAnnouncementConfirm('${announcement.id}')" class="btn-action btn-delete" title="删除">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        console.log('公告列表加载完成');
        
    } catch (error) {
        console.error('加载公告列表错误:', error);
        const tbody = document.getElementById('announcementsTableBody');
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: #e53e3e;">加载失败: ${error.message}</td></tr>`;
    }
}

// 加载实例监控
async function loadInstances() {
    try {
        const apiUrl = window.protocolHelper ? 
            window.protocolHelper.getApiUrl('/api/admin/instances') : 
            '/api/admin/instances';
            
        const token = localStorage.getItem('token');
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            console.error('加载实例列表失败:', response.status);
            return;
        }
        
        const data = await response.json();
        const instances = data.instances || [];
        
        const tbody = document.getElementById('instancesTableBody');
        
        if (instances.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px;">暂无运行实例</td></tr>';
            return;
        }
        
        tbody.innerHTML = instances.map(instance => `
            <tr>
                <td>${instance.name}</td>
                <td>
                    <span class="status-badge ${instance.status === 'online' ? 'status-running' : 'status-stopped'}">
                        ${instance.status === 'online' ? '运行中' : '已停止'}
                    </span>
                </td>
                <td>${instance.cpu ? instance.cpu.toFixed(1) + '%' : '0%'}</td>
                <td>${instance.memory ? formatMemory(instance.memory) : '0 MB'}</td>
                <td>${instance.uptime ? formatUptime(instance.uptime) : '0分钟'}</td>
                <td>${instance.restart_count || 0}</td>
            </tr>
        `).join('');
        
        console.log('实例监控列表加载完成');
        
    } catch (error) {
        console.error('加载实例监控错误:', error);
        const tbody = document.getElementById('instancesTableBody');
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: #e53e3e;">加载失败: ${error.message}</td></tr>`;
    }
}

// 加载自动备份配置
async function loadAutoBackupConfig() {
    try {
        const apiUrl = window.protocolHelper ? 
            window.protocolHelper.getApiUrl('/api/admin/auto-backup/config') : 
            '/api/admin/auto-backup/config';
            
        const token = localStorage.getItem('token');
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            console.error('加载自动备份配置失败:', response.status);
            return;
        }
        
        const data = await response.json();
        
        if (data.success && data.config) {
            document.getElementById('autoBackupEnabled').checked = Boolean(data.config.enabled);
            document.getElementById('backupIntervalHours').value = data.config.interval_hours || 24;
            document.getElementById('backupType').value = data.config.backup_type || 'all';
            
            // 显示状态
            if (data.status) {
                const statusDiv = document.getElementById('autoBackupStatus');
                const statusContent = document.getElementById('autoBackupStatusContent');
                statusDiv.style.display = 'block';
                
                let statusHtml = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                        <div>
                            <strong>状态：</strong> ${data.config.enabled ? '🟢 已启用' : '🔴 已停用'}
                        </div>
                        <div>
                            <strong>运行中：</strong> ${data.status.isRunning ? '⏳ 是' : '❌ 否'}
                        </div>
                        <div>
                            <strong>调度器：</strong> ${data.status.hasScheduler ? '✅ 运行中' : '❌ 未运行'}
                        </div>
                        <div>
                            <strong>最后运行：</strong> ${data.config.last_run_at || '从未运行'}
                        </div>
                    </div>
                `;
                statusContent.innerHTML = statusHtml;
            }
            
            console.log('自动备份配置加载完成');
        }
    } catch (error) {
        console.error('加载自动备份配置错误:', error);
        document.getElementById('autoBackupStatus').innerHTML = `<div style="color: #e53e3e;">加载失败: ${error.message}</div>`;
    }
}

// 辅助函数
// 获取安装状态样式类
function getSetupStatusClass(status) {
    if (!status) return 'status-unknown';
    
    switch(status) {
        case 'not_installed': return 'status-stopped';
        case 'installing': return 'status-pending';
        case 'installed': return 'status-running';
        case 'error': return 'status-error';
        default: return 'status-unknown';
    }
}

// 获取安装状态文本
function getSetupStatusText(status) {
    if (!status) return '未知';
    
    switch(status) {
        case 'not_installed': return '未安装';
        case 'installing': return '安装中';
        case 'installed': return '已安装';
        case 'error': return '安装失败';
        default: return status;
    }
}

// 立即刷新加载所有数据
function manualRefresh() {
    console.log('手动刷新...');
    
    // 显示刷新中状态
    const refreshStatus = document.getElementById('refreshStatusIndicator');
    if (refreshStatus) {
        const originalText = refreshStatus.textContent;
        refreshStatus.textContent = '刷新中...';
        refreshStatus.style.backgroundColor = '#90CDF4';
        
        setTimeout(() => {
            refreshStatus.textContent = originalText;
            refreshStatus.style.backgroundColor = '';
        }, 2000);
    }
    
    // 按顺序加载各种数据
    loadStats();
    
    setTimeout(() => {
        loadUsers();
        setTimeout(() => {
            loadInstances();
            setTimeout(() => {
                loadAnnouncements();
                setTimeout(() => {
                    loadAutoBackupConfig();
                }, 300);
            }, 300);
        }, 300);
    }, 300);
}

// 导出到全局作用域
window.loadUsers = loadUsers;
window.loadInstances = loadInstances;
window.loadAnnouncements = loadAnnouncements;
window.loadAutoBackupConfig = loadAutoBackupConfig;
window.manualRefresh = manualRefresh;
window.getSetupStatusClass = getSetupStatusClass;
window.getSetupStatusText = getSetupStatusText;

// 在页面加载时通知
console.log('管理面板扩展辅助函数已加载');
