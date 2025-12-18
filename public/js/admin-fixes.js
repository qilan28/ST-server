// 实例监控功能
async function loadInstances() {
    try {
        const tbody = document.getElementById('instancesTableBody');
        if (!tbody) {
            console.error('实例表格正文元素未找到');
            return;
        }

        // 显示加载中
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px;">加载中...</td></tr>';
        
        // 发送API请求
        const response = await apiRequest(`${API_BASE}/admin/instances`);
        if (!response) return;
        
        const data = await response.json();
        const instances = data.instances || [];
        
        if (instances.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px;">暂无运行中的实例</td></tr>';
            return;
        }
        
        // 渲染实例列表
        tbody.innerHTML = instances.map(instance => `
            <tr>
                <td>${instance.name}</td>
                <td>
                    <span class="status-badge ${instance.status === 'online' ? 'status-running' : 'status-stopped'}">
                        ${instance.status === 'online' ? '运行中' : '已停止'}
                    </span>
                </td>
                <td>${instance.cpu ? instance.cpu.toFixed(1) + '%' : '0%'}</td>
                <td>${formatMemory(instance.memory)}</td>
                <td>${formatUptime(instance.uptime)}</td>
                <td>${instance.restarts || 0}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('加载实例列表失败:', error);
        const tbody = document.getElementById('instancesTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: #e53e3e;">加载失败，请刷新页面重试</td></tr>';
        }
    }
}

// 公告功能
async function loadAnnouncements() {
    try {
        const tbody = document.getElementById('announcementsTableBody');
        if (!tbody) {
            console.error('公告表格正文元素未找到');
            return;
        }
        
        // 显示加载中
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px;">加载中...</td></tr>';
        
        // 发送API请求
        const response = await apiRequest(`${API_BASE}/admin/announcements`);
        if (!response) return;
        
        const data = await response.json();
        const announcements = data.announcements || [];
        
        if (announcements.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px;">暂无公告</td></tr>';
            return;
        }
        
        // 渲染公告列表
        tbody.innerHTML = announcements.map(announcement => `
            <tr>
                <td>
                    <span class="role-badge ${announcement.type === 'login' ? 'role-user' : 'role-admin'}">
                        ${announcement.type === 'login' ? '登录页' : '用户面板'}
                    </span>
                </td>
                <td>${announcement.title}</td>
                <td>
                    <div class="content-preview">${announcement.content.length > 50 ? announcement.content.substring(0, 50) + '...' : announcement.content}</div>
                </td>
                <td>
                    <span class="status-badge ${announcement.is_active ? 'status-running' : 'status-stopped'}">
                        ${announcement.is_active ? '启用' : '停用'}
                    </span>
                </td>
                <td>${formatDate(announcement.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button onclick="editAnnouncement('${announcement.id}')" class="btn-action" title="编辑">✏️</button>
                        <button onclick="toggleAnnouncementStatus('${announcement.id}')" class="btn-action" title="${announcement.is_active ? '停用' : '启用'}">${announcement.is_active ? '⏸️' : '▶️'}</button>
                        <button onclick="deleteAnnouncementConfirm('${announcement.id}')" class="btn-action btn-delete" title="删除">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('加载公告列表失败:', error);
        const tbody = document.getElementById('announcementsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: #e53e3e;">加载失败，请刷新页面重试</td></tr>';
        }
    }
}

// Nginx配置功能
async function loadNginxConfig() {
    try {
        // 发送API请求获取当前配置
        const response = await apiRequest(`${API_BASE}/config/nginx`);
        if (!response) return;
        
        const data = await response.json();
        const config = data.config || {};
        
        // 更新UI
        document.getElementById('nginxEnabled').checked = Boolean(config.enabled);
        document.getElementById('nginxDomain').value = config.domain || '';
        document.getElementById('nginxPort').value = config.port || 80;
    } catch (error) {
        console.error('加载Nginx配置失败:', error);
        // 可以添加错误提示
    }
}

// 保存Nginx配置
async function saveNginxConfig() {
    try {
        const enabled = document.getElementById('nginxEnabled').checked;
        const domain = document.getElementById('nginxDomain').value.trim();
        const port = parseInt(document.getElementById('nginxPort').value);
        
        // 验证输入
        if (enabled && !domain) {
            showMessage('启用Nginx模式时必须提供域名', 'error');
            return;
        }
        
        if (port < 1 || port > 65535) {
            showMessage('端口必须在1-65535之间', 'error');
            return;
        }
        
        // 发送保存请求
        const response = await apiRequest(`${API_BASE}/config/nginx`, {
            method: 'PUT',
            body: JSON.stringify({
                enabled,
                domain,
                port
            })
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Nginx配置保存成功', 'success', 'configMessage');
        } else {
            showMessage(data.error || '保存失败', 'error', 'configMessage');
        }
    } catch (error) {
        console.error('保存Nginx配置失败:', error);
        showMessage('保存失败，请重试', 'error', 'configMessage');
    }
}

// 生成Nginx配置文件
async function generateNginxConfig() {
    try {
        // 先检查是否已启用
        const enabled = document.getElementById('nginxEnabled').checked;
        
        if (!enabled) {
            if (!await showConfirm('Nginx模式未启用，确定要生成配置文件吗？', '生成配置文件')) {
                return;
            }
        }
        
        const response = await apiRequest(`${API_BASE}/config/nginx/generate`, {
            method: 'POST'
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Nginx配置文件生成成功，请在服务器上查看', 'success', 'configMessage');
            
            // 可以提示配置文件位置
            if (data.path) {
                showMessage(`配置文件路径: ${data.path}`, 'info', 'configMessage');
            }
        } else {
            showMessage(data.error || '生成配置文件失败', 'error', 'configMessage');
        }
    } catch (error) {
        console.error('生成Nginx配置文件失败:', error);
        showMessage('生成配置文件失败，请重试', 'error', 'configMessage');
    }
}

// 用户实例控制函数
async function startUserInstance(username) {
    if (!username) return;
    
    try {
        // 显示确认对话框
        if (!await showConfirm(`确定要启动用户 ${username} 的实例吗？`, '启动实例')) {
            return;
        }
        
        // 发送请求
        const response = await apiRequest(`${API_BASE}/admin/users/${username}/start`, {
            method: 'POST'
        });
        
        if (!response) return;
        
        // 解析响应
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`用户 ${username} 的实例启动成功`, 'success');
            // 重新加载用户列表和实例状态
            loadUsers();
            setTimeout(() => loadInstances(), 500);
        } else {
            showMessage(data.error || '启动失败', 'error');
        }
    } catch (error) {
        console.error(`启动实例失败 (${username}):`, error);
        showMessage('启动失败，请重试', 'error');
    }
}

async function stopUserInstance(username) {
    if (!username) return;
    
    try {
        // 显示确认对话框
        if (!await showConfirm(`确定要停止用户 ${username} 的实例吗？`, '停止实例')) {
            return;
        }
        
        // 发送请求
        const response = await apiRequest(`${API_BASE}/admin/users/${username}/stop`, {
            method: 'POST'
        });
        
        if (!response) return;
        
        // 解析响应
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`用户 ${username} 的实例已停止`, 'success');
            // 重新加载用户列表和实例状态
            loadUsers();
            setTimeout(() => loadInstances(), 500);
        } else {
            showMessage(data.error || '停止失败', 'error');
        }
    } catch (error) {
        console.error(`停止实例失败 (${username}):`, error);
        showMessage('停止失败，请重试', 'error');
    }
}

async function restartUserInstance(username) {
    if (!username) return;
    
    try {
        // 显示确认对话框
        if (!await showConfirm(`确定要重启用户 ${username} 的实例吗？`, '重启实例')) {
            return;
        }
        
        // 发送请求
        const response = await apiRequest(`${API_BASE}/admin/users/${username}/restart`, {
            method: 'POST'
        });
        
        if (!response) return;
        
        // 解析响应
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`用户 ${username} 的实例重启成功`, 'success');
            // 重新加载用户列表和实例状态
            loadUsers();
            setTimeout(() => loadInstances(), 500);
        } else {
            showMessage(data.error || '重启失败', 'error');
        }
    } catch (error) {
        console.error(`重启实例失败 (${username}):`, error);
        showMessage('重启失败，请重试', 'error');
    }
}

// 用户角色管理
async function toggleUserRole(username, currentRole) {
    if (!username) return;
    
    try {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        
        // 显示确认对话框
        if (!await showConfirm(
            `确定要将用户 ${username} 的角色从 ${currentRole === 'admin' ? '管理员' : '普通用户'} 更改为 ${newRole === 'admin' ? '管理员' : '普通用户'} 吗？`, 
            '更改用户角色'
        )) {
            return;
        }
        
        // 发送请求
        const response = await apiRequest(`${API_BASE}/admin/users/${username}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role: newRole })
        });
        
        if (!response) return;
        
        // 解析响应
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`用户 ${username} 的角色已更新为 ${newRole === 'admin' ? '管理员' : '普通用户'}`, 'success');
            // 重新加载用户列表
            loadUsers();
        } else {
            showMessage(data.error || data.message || '更新角色失败', 'error');
        }
    } catch (error) {
        console.error(`更新用户角色失败 (${username}):`, error);
        showMessage('更新角色失败，请重试', 'error');
    }
}

// 删除用户账户
async function deleteUserAccount(username) {
    if (!username) return;
    
    try {
        // 显示确认对话框 (使用危险类型样式)
        if (!await showConfirm(
            `确定要删除用户 ${username} 吗？\n\n此操作将：\n- 删除用户账号\n- 删除用户的SillyTavern实例\n- 删除所有用户数据\n\n此操作不可恢复！`, 
            '删除用户账户', 
            { type: 'danger' }
        )) {
            return;
        }
        
        // 再次确认
        if (!await showConfirm(
            `最后确认：删除用户 ${username}？\n\n所有数据将被永久删除。`, 
            '确认删除', 
            { type: 'danger' }
        )) {
            return;
        }
        
        // 发送请求
        const response = await apiRequest(`${API_BASE}/admin/users/${username}`, {
            method: 'DELETE'
        });
        
        if (!response) return;
        
        // 解析响应
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`用户 ${username} 已成功删除`, 'success');
            // 重新加载用户列表和统计数据
            loadStats();
            loadUsers();
            setTimeout(() => loadInstances(), 500);
        } else {
            showMessage(data.error || data.message || '删除用户失败', 'error');
        }
    } catch (error) {
        console.error(`删除用户失败 (${username}):`, error);
        showMessage('删除用户失败，请重试', 'error');
    }
}

// 公告管理功能
function showCreateAnnouncementModal() {
    // 重置表单
    document.getElementById('announcementForm').reset();
    
    // 设置表单标题和按钮文字
    document.getElementById('modalTitle').textContent = '创建公告';
    document.getElementById('announcementId').value = '';
    
    // 显示模态框
    document.getElementById('announcementModal').style.display = 'block';
}

function closeAnnouncementModal() {
    document.getElementById('announcementModal').style.display = 'none';
}

// 处理公告表单提交
async function handleAnnouncementSubmit(event) {
    event.preventDefault();
    
    const id = document.getElementById('announcementId').value;
    const type = document.getElementById('announcementType').value;
    const title = document.getElementById('announcementTitle').value;
    const content = document.getElementById('announcementContent').value;
    const isActive = document.getElementById('announcementIsActive').checked;
    
    // 验证输入
    if (!type) {
        showMessage('请选择公告类型', 'error');
        return;
    }
    
    if (!title.trim()) {
        showMessage('请输入公告标题', 'error');
        return;
    }
    
    if (!content.trim()) {
        showMessage('请输入公告内容', 'error');
        return;
    }
    
    try {
        let response;
        let successMessage;
        
        if (id) {
            // 更新现有公告
            response = await apiRequest(`${API_BASE}/admin/announcements/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title,
                    content,
                    isActive
                })
            });
            successMessage = '公告更新成功';
        } else {
            // 创建新公告
            response = await apiRequest(`${API_BASE}/admin/announcements`, {
                method: 'POST',
                body: JSON.stringify({
                    type,
                    title,
                    content
                })
            });
            successMessage = '公告创建成功';
        }
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(successMessage, 'success');
            closeAnnouncementModal();
            loadAnnouncements();
        } else {
            showMessage(data.error || '操作失败', 'error');
        }
    } catch (error) {
        console.error('公告操作失败:', error);
        showMessage('操作失败，请重试', 'error');
    }
}

// 编辑公告
async function editAnnouncement(id) {
    if (!id) return;
    
    try {
        // 获取公告详情
        const response = await apiRequest(`${API_BASE}/admin/announcements/${id}`);
        if (!response) return;
        
        const data = await response.json();
        const announcement = data.announcement;
        
        if (!announcement) {
            showMessage('获取公告详情失败', 'error');
            return;
        }
        
        // 填充表单
        document.getElementById('announcementId').value = announcement.id;
        document.getElementById('announcementType').value = announcement.type;
        document.getElementById('announcementTitle').value = announcement.title;
        document.getElementById('announcementContent').value = announcement.content;
        document.getElementById('announcementIsActive').checked = Boolean(announcement.is_active);
        
        // 设置表单标题
        document.getElementById('modalTitle').textContent = '编辑公告';
        
        // 显示模态框
        document.getElementById('announcementModal').style.display = 'block';
    } catch (error) {
        console.error(`获取公告详情失败 (ID: ${id}):`, error);
        showMessage('获取公告详情失败，请重试', 'error');
    }
}

// 切换公告状态
async function toggleAnnouncementStatus(id) {
    if (!id) return;
    
    try {
        const response = await apiRequest(`${API_BASE}/admin/announcements/${id}/toggle`, {
            method: 'PATCH'
        });
        
        if (response) {
            showMessage('公告状态已更新', 'success');
            loadAnnouncements();
        }
    } catch (error) {
        console.error('切换公告状态失败:', error);
        showMessage('操作失败，请重试', 'error');
    }
}

// 获取安装状态类
function getSetupStatusClass(status) {
    const statusMap = {
        'pending': 'status-pending',
        'installing': 'status-installing',
        'completed': 'status-completed',
        'failed': 'status-failed',
        'N/A': 'status-na'
    };
    
    return statusMap[status] || 'status-pending';
}

// 获取安装状态文本
function getSetupStatusText(status) {
    const statusMap = {
        'pending': '未安装',
        'installing': '安装中',
        'completed': '已完成',
        'failed': '失败',
        'N/A': '不适用'
    };
    
    return statusMap[status] || '未知';
}

// 手动刷新功能
function manualRefresh() {
    console.log('手动刷新数据');
    
    // 重置定时器
    if (window.refreshTimer) {
        clearInterval(window.refreshTimer);
    }
    
    // 加载数据
    loadStats();
    loadUsers();
    loadInstances();
    loadAnnouncements();
    
    // 显示通知
    showMessage('数据已刷新', 'success');
    
    // 重新启动定时刷新
    startAutoRefresh();
}

// 启动自动刷新
function startAutoRefresh() {
    // 清除现有定时器
    if (window.refreshTimer) {
        clearInterval(window.refreshTimer);
    }
    
    // 获取刷新间隔
    const refreshInterval = parseInt(document.getElementById('refreshIntervalSelect').value);
    
    // 更新状态指示器
    updateRefreshStatusIndicator(refreshInterval);
    
    // 如果选择了"关闭"选项，不启动定时器
    if (refreshInterval === 0) {
        return;
    }
    
    // 启动新定时器
    window.refreshTimer = setInterval(() => {
        loadStats();
        loadUsers();
        loadInstances();
    }, refreshInterval);
}

// 更新刷新状态指示器
function updateRefreshStatusIndicator(interval) {
    const indicator = document.getElementById('refreshStatusIndicator');
    
    if (interval === 0) {
        indicator.textContent = '已关闭';
        indicator.className = 'status-badge status-stopped';
    } else {
        const seconds = interval / 1000;
        indicator.textContent = `${seconds}秒`;
        indicator.className = 'status-badge status-running';
    }
}

// 当刷新间隔选择发生变化时的处理函数
function handleRefreshIntervalChange() {
    // 保存用户选择到本地存储
    const interval = document.getElementById('refreshIntervalSelect').value;
    localStorage.setItem('admin_refresh_interval', interval);
    
    // 重启自动刷新
    startAutoRefresh();
}

// 初始化刷新间隔选择器
function initRefreshIntervalSelect() {
    const selectEl = document.getElementById('refreshIntervalSelect');
    if (!selectEl) return;
    
    // 从本地存储加载之前的设置
    const savedInterval = localStorage.getItem('admin_refresh_interval');
    if (savedInterval) {
        selectEl.value = savedInterval;
    }
    
    // 添加变化事件监听器
    selectEl.addEventListener('change', handleRefreshIntervalChange);
    
    // 启动自动刷新
    startAutoRefresh();
}

// 确认对话框
async function showConfirm(message, title = '确认', options = {}) {
    return new Promise((resolve) => {
        // 检查模态框函数是否存在
        if (typeof showModal !== 'function') {
            // 回退到原生确认
            const confirmed = confirm(message);
            resolve(confirmed);
            return;
        }
        
        // 使用模态框
        showModal({
            title: title,
            content: message,
            type: options.type || 'warning',
            buttons: [
                {
                    text: '取消',
                    type: 'secondary',
                    onClick: () => resolve(false)
                },
                {
                    text: '确认',
                    type: options.type || 'warning',
                    onClick: () => resolve(true)
                }
            ]
        });
    });
}

// 在页面加载完成后初始化自动刷新功能
document.addEventListener('DOMContentLoaded', function() {
    // 初始化刷新间隔选择器
    initRefreshIntervalSelect();
});
