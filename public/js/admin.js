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

// 检查管理员权限
function checkAdmin() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('管理员验证失败: 无效令牌');
            window.location.href = '/login.html';
            return false;
        }
        
        // 验证用户角色后可以添加更严格的检查
        // 目前将权限验证委托给后端 API 处理
        return true;
    } catch (error) {
        console.error('检查管理员权限时出错:', error);
        return false;
    }
}

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

// 退出登录
function logout() {
    localStorage.removeItem('token');
    // 同时清除 st_token cookie
    deleteCookie('st_token');
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

// 生成头像 URL 函数
function getAvatarUrl(username) {
    if (/^[1-9]\d{4,12}$/.test(username)) {
        // 使用服务器代理API避免跨域问题
        return `/api/proxy/qq-avatar/${username}`;
    }
    return '/images/default-avatar.png';
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
// 延迟加载用户头像
function lazyLoadUserAvatars() {
    // 查找所有需要加载头像的元素
    const avatarImgs = document.querySelectorAll('img.user-avatar[data-username]');
    
    // 计算加载间隔
    const delay = Math.max(50, Math.min(200, Math.floor(2000 / (avatarImgs.length || 1))));
    
    // 逐个延迟加载头像
    avatarImgs.forEach((img, index) => {
        const username = img.getAttribute('data-username');
        if (username && /^[1-9]\d{4,12}$/.test(username)) {
            // 逐个延迟加载，避免同时发起太多请求
            setTimeout(() => {
                // 创建新的Image对象用于预加载和错误处理
                const tempImg = new Image();
                // 错误处理
                tempImg.onerror = function() {
                    console.log(`头像加载失败: ${username}`);
                    img.src = '/images/default-avatar.png';
                };
                // 加载成功后更新到正式元素
                tempImg.onload = function() {
                    img.src = tempImg.src;
                };
                // 开始加载
                tempImg.src = `/api/proxy/qq-avatar/${username}`;
            }, index * delay);
        }
    });
}

async function loadUsers() {
    try {
        const response = await apiRequest(`${API_BASE}/admin/users`);
        if (!response) return;
        
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
        
        // 使用全局的 getAvatarUrl 函数
        
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
        setTimeout(() => lazyLoadUserAvatars(), 300);
    } catch (error) {
        console.error('Load users error:', error);
        showMessage('加载用户列表失败', 'error');
    }
}

// 删除公告确认
async function deleteAnnouncementConfirm(id) {
    if (await showConfirm('确定要删除这条公告吗？此操作不可撤销！', '删除公告', { type: 'danger' })) {
        deleteAnnouncementAction(id);
    }
}

// 执行删除公告
async function deleteAnnouncementAction(id) {
    try {
        const response = await apiRequest(`${API_BASE}/admin/announcements/${id}`, {
            method: 'DELETE'
        });
        
        if (response) {
            showMessage('公告删除成功', 'success');
            loadAnnouncements();
        }
    } catch (error) {
        console.error('Delete announcement error:', error);
        showMessage('删除失败', 'error');
    }
}

// ==================== 自动备份配置 ====================

// 加载自动备份配置
async function loadAutoBackupConfig() {
    try {
        const response = await apiRequest(`${API_BASE}/admin/auto-backup/config`);
        if (!response) return;
        
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
        }
    } catch (error) {
        console.error('Load auto backup config error:', error);
    }
}

// 保存自动备份配置
async function saveAutoBackupConfig() {
    try {
        const enabled = document.getElementById('autoBackupEnabled').checked;
        const intervalHours = parseInt(document.getElementById('backupIntervalHours').value);
        const backupType = document.getElementById('backupType').value;
        const messageDiv = document.getElementById('autoBackupMessage');
        
        // 验证
        if (intervalHours < 1 || intervalHours > 168) {
            messageDiv.className = 'message error show';
            messageDiv.textContent = '❌ 间隔时间必须在 1-168 小时之间';
            messageDiv.style.display = 'block';
            return;
        }
        
        messageDiv.className = 'message info show';
        messageDiv.textContent = '⏳ 保存中...';
        messageDiv.style.display = 'block';
        
        const response = await apiRequest(`${API_BASE}/admin/auto-backup/config`, {
            method: 'PUT',
            body: JSON.stringify({
                enabled: enabled,
                interval_hours: intervalHours,
                backup_type: backupType
            })
        });
        
        if (!response) {
            messageDiv.className = 'message error show';
            messageDiv.textContent = '❌ 保存失败';
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            messageDiv.className = 'message success show';
            messageDiv.textContent = '✅ 配置保存成功！';
            
            // 显示成功弹窗
            await showAlert('自动备份配置已更新\n\n' + (enabled ? '定时任务已启动' : '定时任务已停止'), '✅ 保存成功', 'success');
            
            // 重新加载配置
            await loadAutoBackupConfig();
        } else {
            messageDiv.className = 'message error show';
            messageDiv.textContent = '❌ ' + (data.error || '保存失败');
        }
    } catch (error) {
        const messageDiv = document.getElementById('autoBackupMessage');
        messageDiv.className = 'message error show';
        messageDiv.textContent = '❌ 保存失败：' + error.message;
        messageDiv.style.display = 'block';
    }
}

// 查看符合备份条件的用户
async function showAutoBackupUsers() {
    try {
        const response = await apiRequest(`${API_BASE}/admin/auto-backup/users`);
        if (!response) return;
        
        const data = await response.json();
        
        if (data.success) {
            const usersDiv = document.getElementById('autoBackupUsersList');
            const usersContent = document.getElementById('autoBackupUsersContent');
            
            usersDiv.style.display = 'block';
            
            if (data.users && data.users.length > 0) {
                // 先显示统计信息的概要卡片
                let html = `
                    <div style="margin-bottom: 20px; background: #f7fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <h4 style="margin-top: 0; margin-bottom: 10px; color: #4a5568;">用户备份状态统计</h4>
                        <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                            <div style="flex: 1; min-width: 120px; background: white; padding: 10px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                <div style="color: #718096; font-size: 0.9rem;">总用户数</div>
                                <div style="font-size: 1.5rem; font-weight: 600; color: #4a5568;">${data.total}</div>
                            </div>
                            <div style="flex: 1; min-width: 120px; background: white; padding: 10px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                <div style="color: #718096; font-size: 0.9rem;">可备份用户</div>
                                <div style="font-size: 1.5rem; font-weight: 600; color: #48bb78;">${data.eligible}</div>
                            </div>
                            <div style="flex: 1; min-width: 120px; background: white; padding: 10px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                <div style="color: #718096; font-size: 0.9rem;">缺失HF配置</div>
                                <div style="font-size: 1.5rem; font-weight: 600; color: #ed8936;">${data.stats.missing_config}</div>
                            </div>
                            <div style="flex: 1; min-width: 120px; background: white; padding: 10px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                <div style="color: #718096; font-size: 0.9rem;">未启用备份</div>
                                <div style="font-size: 1.5rem; font-weight: 600; color: #f56565;">${data.stats.disabled}</div>
                            </div>
                        </div>
                        <div style="margin-top: 10px; color: #718096; font-size: 0.9rem;">
                            备份类型: <strong>${getBackupTypeText(data.backup_type)}</strong>
                        </div>
                    </div>
                `;
                
                // 然后显示详细的用户列表
                html += `
                    <div style="overflow-x: auto;">
                        <table class="users-table">
                            <thead>
                                <tr>
                                    <th>用户名</th>
                                    <th>邮箱</th>
                                    <th>状态</th>
                                    <th>最后登录</th>
                                    <th>HF配置</th>
                                    <th>自动备份</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                // 按照是否满足条件排序：先显示满足条件的用户
                const sortedUsers = [...data.users].sort((a, b) => {
                    // 满足备份条件的优先
                    const aEligible = a.hasHFConfig && a.auto_backup_enabled;
                    const bEligible = b.hasHFConfig && b.auto_backup_enabled;
                    
                    if (aEligible && !bEligible) return -1;
                    if (!aEligible && bEligible) return 1;
                    
                    // 其次按运行状态排序
                    if (a.status === 'running' && b.status !== 'running') return -1;
                    if (a.status !== 'running' && b.status === 'running') return 1;
                    
                    // 最后按用户名字母排序
                    return a.username.localeCompare(b.username);
                });
                
                sortedUsers.forEach(user => {
                    // 判断行的样式：可备份的用户高亮显示
                    const isEligible = user.hasHFConfig && user.auto_backup_enabled;
                    const rowStyle = isEligible ? 'background-color: #f0fff4;' : '';
                    
                    html += `
                        <tr style="${rowStyle}">
                            <td>${user.username}</td>
                            <td>${user.email}</td>
                            <td><span class="status-badge status-${user.status === 'running' ? 'running' : 'stopped'}">${user.status === 'running' ? '运行中' : '已停止'}</span></td>
                            <td>${user.last_login_at ? new Date(user.last_login_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '从未登录'}</td>
                            <td>${user.hasHFConfig ? '✅ 已配置' : '<span style="color: #f56565;">❌ 未配置</span>'}</td>
                            <td>${user.auto_backup_enabled ? '✅ 已启用' : '<span style="color: #ed8936;">❌ 未启用</span>'}</td>
                        </tr>
                    `;
                });
                
                html += `
                            </tbody>
                        </table>
                    </div>
                `;
                
                usersContent.innerHTML = html;
            } else {
                usersContent.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; background: #f7fafc; border-radius: 8px; color: #718096;">
                        <div style="font-size: 24px; margin-bottom: 10px;">📭</div>
                        <p style="margin: 0;">系统中暂无普通用户账号</p>
                        <p style="margin-top: 10px; font-size: 0.9rem;">请先创建用户账号再尝试查看备份用户</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Show auto backup users error:', error);
        await showAlert('加载用户列表失败：' + error.message, '❌ 错误', 'error');
    }
}

// 手动触发自动备份
async function triggerAutoBackup() {
    try {
        if (!await showConfirm('确定要立即执行自动备份吗？\n\n这将备份所有符合条件的用户数据。', '⚡ 立即执行', { type: 'warning' })) {
            return;
        }
        
        const response = await apiRequest(`${API_BASE}/admin/auto-backup/trigger`, {
            method: 'POST'
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (data.success) {
            await showAlert('自动备份任务已触发！\n\n备份正在后台执行，请查看服务器日志了解进度。', '✅ 任务已启动', 'success');
            
            // 3秒后重新加载状态
            setTimeout(() => {
                loadAutoBackupConfig();
            }, 3000);
        } else {
            await showAlert(data.error || '触发失败', '❌ 错误', 'error');
        }
    } catch (error) {
        console.error('Trigger auto backup error:', error);
        await showAlert('触发失败：' + error.message, '❌ 错误', 'error');
    }
}

// 获取备份类型文本
function getBackupTypeText(type) {
    const map = {
        'all': '所有用户',
        'logged_in_today': '当日登录过的用户',
        'running': '运行中的实例'
    };
    return map[type] || type;
}

// 加载当前管理员头像
function loadAdminAvatar() {
    const username = localStorage.getItem('username');
    if (username) {
        const adminUsernameEl = document.getElementById('adminUsername');
        const adminAvatarEl = document.getElementById('adminUserAvatar');
        
        if (adminUsernameEl) adminUsernameEl.textContent = username;
        
        if (adminAvatarEl) {
            // 使用默认头像先占位，然后再加载实际头像
            adminAvatarEl.src = '/images/default-avatar.png';
            
            // 延迟加载QQ头像
            if (/^[1-9]\d{4,12}$/.test(username)) {
                // 使用延时加载头像，避免阻塞页面渲染
                setTimeout(() => {
                    // 创建新的Image对象用于预加载和错误处理
                    const tempImg = new Image();
                    // 错误处理
                    tempImg.onerror = function() {
                        console.log(`管理员头像加载失败: ${username}`);
                    };
                    // 加载成功后更新到正式元素
                    tempImg.onload = function() {
                        adminAvatarEl.src = tempImg.src;
                    };
                    // 开始加载
                    tempImg.src = `/api/proxy/qq-avatar/${username}`;
                }, 500);
            }
        }
    }
}

// 页面加载完成后按顺序加载资源
document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) return;
    
    // 验证管理员权限
    checkAdmin();
    
    // 先加载头像和用户名
    loadAdminAvatar();
    
    // 延迟加载统计信息
    setTimeout(() => loadStats(), 100);
    
    // 按顺序延迟加载其他数据
    setTimeout(() => {
        loadUsers();
        setTimeout(() => {
            loadInstances();
            setTimeout(() => {
                loadAnnouncements();
                setTimeout(() => {
                    loadNginxConfig();
                    setTimeout(() => {
                        loadAutoBackupConfig();
                        setTimeout(() => {
                            // 加载站点设置
                            if (typeof loadSiteSettings === 'function') {
                                console.log('从 admin.js 中调用加载站点设置...');
                                loadSiteSettings();
                            } else {
                                console.error('找不到 loadSiteSettings 函数');
                            }
                            setTimeout(() => {
                                // 加载运行时长限制配置
                                if (typeof loadRuntimeLimitConfig === 'function') {
                                    loadRuntimeLimitConfig();
                                }
                            }, 300);
                        }, 300);
                    }, 300);
                }, 300);
            }, 300);
        }, 300);
    }, 300);
});
