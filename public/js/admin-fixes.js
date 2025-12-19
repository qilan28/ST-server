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
    console.log('正在加载 Nginx 配置...');
    
    // 显示加载中状态
    const nginxSection = document.querySelector('.nginx-settings');
    const loadingIndicator = nginxSection ? nginxSection.querySelector('.loading-indicator') : null;
    const messageContainer = document.getElementById('nginxConfigMessage');
    
    // 显示加载中状态
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    if (messageContainer) messageContainer.style.display = 'none';
    
    try {
        // 生成随机查询参数防止缓存
        const timestamp = new Date().getTime();
        const requestUrl = `${API_BASE}/config/nginx?_nocache=${timestamp}`;
        console.log(`发送 Nginx 配置请求到: ${requestUrl}`);
        
        // 发送API请求获取当前配置
        const response = await apiRequest(requestUrl);
        
        if (!response) {
            console.error('加载 Nginx 配置失败: 无响应');
            
            // 显示错误消息
            if (messageContainer) {
                messageContainer.textContent = '加载 Nginx 配置失败: 服务器无响应';
                messageContainer.className = 'message error';
                messageContainer.style.display = 'block';
            }
            
            // 全局消息
            if (window.showMessage) {
                window.showMessage('加载 Nginx 配置失败: 服务器无响应', 'error');
            }
            return;
        }
        
        if (!response.ok) {
            console.error(`加载 Nginx 配置失败: HTTP 状态 ${response.status}`);
            
            // 显示错误消息
            const errorMsg = `加载失败: ${response.statusText || `状态码 ${response.status}`}`;
            
            if (messageContainer) {
                messageContainer.textContent = errorMsg;
                messageContainer.className = 'message error';
                messageContainer.style.display = 'block';
            }
            
            // 全局消息
            if (window.showMessage) {
                window.showMessage(errorMsg, 'error');
            }
            return;
        }
        
        const data = await response.json();
        console.log('收到 Nginx 配置数据:', data);
        
        const config = data.nginx || {};
        
        // 检查UI元素
        const enabledCheckbox = document.getElementById('nginxEnabled');
        const domainInput = document.getElementById('nginxDomain');
        const portInput = document.getElementById('nginxPort');
        
        if (!enabledCheckbox || !domainInput || !portInput) {
            console.error('加载 Nginx 配置失败: UI 元素不存在');
            
            if (messageContainer) {
                messageContainer.textContent = '加载 Nginx 配置失败: UI 元素不存在';
                messageContainer.className = 'message error';
                messageContainer.style.display = 'block';
            }
            return;
        }
        
        // 更新UI
        enabledCheckbox.checked = Boolean(config.enabled);
        domainInput.value = config.domain || '';
        portInput.value = config.port || 80;
        
        console.log('加载 Nginx 配置成功');
        
        // 显示成功消息
        if (messageContainer) {
            messageContainer.textContent = '配置已成功加载';
            messageContainer.className = 'message success';
            messageContainer.style.display = 'block';
            
            // 3秒后自动隐藏成功消息
            setTimeout(() => {
                messageContainer.style.display = 'none';
            }, 3000);
        }
        
        // 全局消息
        if (window.showMessage) {
            window.showMessage('配置已加载', 'success');
        }
    } catch (error) {
        console.error('加载Nginx配置失败:', error);
        
        // 显示错误消息
        const errorMsg = `加载 Nginx 配置失败: ${error.message || '未知错误'}`;
        
        if (messageContainer) {
            messageContainer.textContent = errorMsg;
            messageContainer.className = 'message error';
            messageContainer.style.display = 'block';
        }
        
        // 全局消息
        if (window.showMessage) {
            window.showMessage(errorMsg, 'error');
        }
    } finally {
        // 隐藏加载指示器
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}

// 保存Nginx配置
async function saveNginxConfig() {
    try {
        // 显示加载指示器
        const saveButton = document.querySelector('button.btn.btn-primary');
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = '保存中...';
        }

        const enabled = document.getElementById('nginxEnabled').checked;
        const domain = document.getElementById('nginxDomain').value.trim() || 'localhost'; // 提供默认值
        const port = parseInt(document.getElementById('nginxPort').value) || 80;
        
        // 验证输入
        if (port < 1 || port > 65535) {
            showMessage('端口必须在1-65535之间', 'error');
            return;
        }
        
        console.log('发送Nginx配置:', { enabled, domain, port });
        
        // 发送保存请求
        const response = await fetch(`${API_BASE}/config/nginx`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                enabled,
                domain,
                port
            })
        });
        
        // 处理非200响应
        if (!response.ok) {
            console.error(`保存失败: HTTP ${response.status} ${response.statusText}`);
            showMessage(`保存失败: HTTP ${response.status} ${response.statusText}`, 'error');
            return;
        }
        
        const data = await response.json();
        console.log('服务器响应:', data);
        
        // 判断成功条件 - 没有error且有message或nginx
        if (!data.error && (data.message || data.nginx)) {
            console.log('保存成功');
            showMessage('Nginx配置保存成功', 'success');
            
            // 重新加载数据
            setTimeout(() => loadNginxConfig(), 500);
        } else {
            console.error('保存失败:', data.error || '未知错误');
            showMessage(data.error || '保存失败', 'error');
        }
    } catch (error) {
        console.error('保存Nginx配置失败:', error);
        showMessage(`保存失败: ${error.message || '未知错误'}`, 'error');
    } finally {
        // 恢复按钮状态
        const saveButton = document.querySelector('button.btn.btn-primary');
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = '保存配置';
        }
    }
}

// 生成Nginx配置文件
async function generateNginxConfig() {
    try {
        // 显示加载状态
        const generateButton = document.querySelector('button.btn.btn-secondary');
        if (generateButton) {
            generateButton.disabled = true;
            generateButton.textContent = '生成中...';
        }

        // 先检查是否已启用
        const enabled = document.getElementById('nginxEnabled').checked;
        
        if (!enabled) {
            const confirmResult = confirm('Nginx模式未启用，确定要生成配置文件吗？');
            if (!confirmResult) {
                if (generateButton) {
                    generateButton.disabled = false;
                    generateButton.textContent = '生成 Nginx 配置文件';
                }
                return;
            }
        }
        
        console.log('发送生成Nginx配置文件请求');
        
        const response = await fetch(`${API_BASE}/config/nginx/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        // 处理非200响应
        if (!response.ok) {
            console.error(`生成配置文件失败: HTTP ${response.status} ${response.statusText}`);
            showMessage(`生成失败: HTTP ${response.status} ${response.statusText}`, 'error');
            return;
        }
        
        const data = await response.json();
        console.log('服务器响应:', data);
        
        // Windows环境下有特殊处理
        if (data.method === 'windows_simulation') {
            showMessage('配置文件已生成（Windows环境下不自动重载）', 'success');
            if (data.message) {
                showMessage(data.message, 'info');
            }
            return;
        }
        
        // 判断成功条件 - 没有error就认为成功
        if (!data.error) {
            showMessage('Nginx配置文件生成成功', 'success');
            
            // 如果有路径信息
            if (data.path) {
                showMessage(`配置文件路径: ${data.path}`, 'info');
            }
            
            // 如果有警告信息
            if (data.warning) {
                showMessage(`警告: ${data.warning}`, 'warning');
            }
            
            // 如果需要手动重载
            if (data.needManualReload) {
                showMessage('配置文件已生成，但需要手动重载Nginx', 'warning');
            }
        } else {
            console.error('生成失败:', data.error);
            showMessage(data.error || '生成配置文件失败', 'error');
        }
    } catch (error) {
        console.error('生成Nginx配置文件失败:', error);
        showMessage(`生成失败: ${error.message || '未知错误'}`, 'error');
    } finally {
        // 恢复按钮状态
        const generateButton = document.querySelector('button.btn.btn-secondary');
        if (generateButton) {
            generateButton.disabled = false;
            generateButton.textContent = '生成 Nginx 配置文件';
        }
    }
}

// 用户实例控制函数
async function startUserInstance(username) {
    if (!username) return;
    
    try {
        // 显示确认对话框
        if (!await showConfirm(`确定要启动用户 ${username} 的实例吗？\n\n启动时将分配随机端口，可能与原端口不同。`, '启动实例')) {
            return;
        }
        
        // 发送请求
        const response = await fetch(`${API_BASE}/admin/users/${username}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response) return;
        
        // 处理各种错误状态
        if (response.status === 404) {
            showMessage(`启动失败: 找不到用户 ${username}`, 'error');
            // 重新加载用户列表
            loadUsers();
            return;
        } else if (response.status === 400) {
            showMessage(`启动失败: 用户 ${username} 未配置 SillyTavern`, 'error');
            loadUsers();
            return;
        }
        
        // 解析响应
        const data = await response.json();
        
        if (response.ok) {
            // 检查是否返回了新的端口信息
            if (data.port) {
                showMessage(`用户 ${username} 的实例启动成功，使用端口: ${data.port}`, 'success');
            } else {
                showMessage(`用户 ${username} 的实例启动成功`, 'success');
            }
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
        const response = await fetch(`${API_BASE}/admin/users/${username}/stop`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response) return;
        
        // 处理各种错误状态
        if (response.status === 404) {
            showMessage(`停止失败: 找不到用户 ${username} 的实例，可能该实例已经停止或不存在`, 'warning');
            // 重新加载用户列表和实例状态
            loadUsers();
            setTimeout(() => loadInstances(), 500);
            return;
        }
        
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
        if (!await showConfirm(`确定要重启用户 ${username} 的实例吗？\n\n重启时将分配随机端口，可能与原端口不同。`, '重启实例')) {
            return;
        }
        
        // 发送请求
        const response = await fetch(`${API_BASE}/admin/users/${username}/restart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response) return;
        
        // 处理各种错误状态
        if (response.status === 404) {
            showMessage(`重启失败: 找不到用户 ${username} 的实例，可能实例不存在`, 'warning');
            // 重新加载用户列表和实例状态
            loadUsers();
            setTimeout(() => loadInstances(), 500);
            return;
        }
        
        // 解析响应
        const data = await response.json();
        
        if (response.ok) {
            // 检查是否返回了新的端口信息
            if (data.port) {
                showMessage(`用户 ${username} 的实例重启成功，使用端口: ${data.port}`, 'success');
            } else {
                showMessage(`用户 ${username} 的实例重启成功`, 'success');
            }
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
        // 检查是否可以安全使用模态框
        const canUseModal = typeof showModal === 'function' && 
                        // 确保不是在admin-fixes.js这里定义的自身函数
                        (window.showModal !== undefined && window.showModal !== showConfirm);
        
        if (!canUseModal) {
            // 回退到原生确认
            console.log('使用原生确认对话框');
            const confirmed = confirm(message);
            resolve(confirmed);
            return;
        }
        
        // 使用原生modal.js中的确认对话框函数
        if (window.originalModalConfirm) {
            window.originalModalConfirm(message, title, options)
                .then(result => resolve(result))
                .catch(err => {
                    console.error('模态框错误，回退到原生:', err);
                    const confirmed = confirm(message);
                    resolve(confirmed);
                });
            return;
        }
        
        // 如果上面都不可用，尝试使用showModal
        try {
            showModal({
                title: title,
                content: message,
                type: options.type || 'warning',
                buttons: [
                    {
                        text: options.cancelText || '取消',
                        type: 'secondary',
                        onClick: () => resolve(false)
                    },
                    {
                        text: options.confirmText || '确认',
                        type: options.type || 'warning',
                        onClick: () => resolve(true)
                    }
                ]
            });
        } catch (error) {
            // 发生错误，回退到原生确认
            console.error('模态框异常，回退到原生:', error);
            const confirmed = confirm(message);
            resolve(confirmed);
        }
    });
}

// 在页面加载完成后初始化自动刷新功能
document.addEventListener('DOMContentLoaded', function() {
    // 初始化刷新间隔选择器
    initRefreshIntervalSelect();
});
