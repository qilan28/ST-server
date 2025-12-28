/**
 * 实例转发管理 JavaScript
 */

// 全局变量
let forwardingConfig = {
    enabled: true  // 默认启用实例转发
};

let forwardingServers = [];
let isLoading = false;

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 绑定事件
    document.getElementById('refreshForwardingListBtn').addEventListener('click', loadForwardingServers);
    document.getElementById('addServerBtn').addEventListener('click', showAddServerModal);
    // 注释掉这个监听器，因为已在HTML中使用了onsubmit
    // document.getElementById('serverForm').addEventListener('submit', handleServerSubmit);
    
    // 直接加载服务器列表，不再加载配置
    loadForwardingServers();
});

// 加载转发服务器列表
function loadForwardingServers() {
    showLoading(true);
    
    fetch('/api/instance-forwarding/servers', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('token')
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('获取服务器列表失败，HTTP 状态码: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        showLoading(false);
        if (data.success) {
            forwardingServers = data.servers;
            updateServersTable();
        } else {
            showMessage('error', '获取服务器列表失败: ' + data.error);
        }
    })
    .catch(error => {
        showLoading(false);
        showMessage('error', '获取服务器列表出错: ' + error.message);
    });
}

// 更新服务器表格
function updateServersTable() {
    const tableBody = document.getElementById('forwardingServersTableBody');
    
    // 清空表格
    tableBody.innerHTML = '';
    
    // 如果没有服务器，显示空消息
    if (!forwardingServers || forwardingServers.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 30px;">暂无转发服务器</td>
            </tr>
        `;
        return;
    }
    
    // 添加服务器行
    forwardingServers.forEach(server => {
        const row = document.createElement('tr');
        
        // 创建日期
        const createdAt = new Date(server.created_at);
        const dateString = createdAt.toLocaleDateString() + ' ' + createdAt.toLocaleTimeString();
        
        row.innerHTML = `
            <td>${server.id}</td>
            <td>${server.address}</td>
            <td>${server.port}</td>
            <td>
                <span class="status-badge ${server.is_active ? 'status-running' : 'status-stopped'}">
                    ${server.is_active ? '启用' : '禁用'}
                </span>
            </td>
            <td>${dateString}</td>
            <td>
                <div class="action-buttons">
                    <button onclick="editServer(${server.id})" class="btn btn-sm btn-primary">编辑</button>
                    <button onclick="toggleServer(${server.id})" class="btn btn-sm ${server.is_active ? 'btn-warning' : 'btn-success'}">
                        ${server.is_active ? '禁用' : '启用'}
                    </button>
                    <button onclick="deleteServer(${server.id})" class="btn btn-sm btn-danger">删除</button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// 显示添加服务器模态框
function showAddServerModal() {
    // 清空表单
    document.getElementById('serverId').value = '';
    document.getElementById('serverAddress').value = '';
    document.getElementById('serverPort').value = '';
    document.getElementById('serverIsActive').checked = true;
    
    // 更新标题
    document.getElementById('serverModalTitle').textContent = '添加转发服务器';
    
    // 显示模态框
    document.getElementById('serverModal').style.display = 'block';
}

// 编辑服务器
function editServer(id) {
    const server = forwardingServers.find(s => s.id === id);
    if (!server) {
        showMessage('error', '找不到指定的服务器');
        return;
    }
    
    // 填充表单
    document.getElementById('serverId').value = server.id;
    document.getElementById('serverAddress').value = server.address;
    document.getElementById('serverPort').value = server.port;
    document.getElementById('serverIsActive').checked = server.is_active === 1;
    
    // 更新标题
    document.getElementById('serverModalTitle').textContent = '编辑转发服务器';
    
    // 显示模态框
    document.getElementById('serverModal').style.display = 'block';
}

// 关闭服务器模态框
function closeServerModal() {
    document.getElementById('serverModal').style.display = 'none';
}

// 防止重复提交的标志
let isSubmitting = false;

// 处理服务器表单提交
function handleServerSubmit(event) {
    event.preventDefault();
    
    // 如果正在提交，则忽略该请求
    if (isSubmitting) {
        console.log('防止重复提交');
        return;
    }
    
    // 设置标志为正在提交
    isSubmitting = true;
    
    const id = document.getElementById('serverId').value.trim();
    const address = document.getElementById('serverAddress').value.trim();
    const port = parseInt(document.getElementById('serverPort').value) || 7092;
    const isActive = document.getElementById('serverIsActive').checked;
    
    if (!address) {
        showMessage('error', '请输入服务器地址');
        return;
    }
    
    if (port < 1 || port > 65535) {
        showMessage('error', '端口必须在 1-65535 之间');
        return;
    }
    
    // 关闭模态框
    closeServerModal();
    
    showLoading(true);
    
    // 如果有ID，则更新，否则添加
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/instance-forwarding/servers/${id}` : '/api/instance-forwarding/servers';
    
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({
            address: address,
            port: port,
            is_active: isActive
        })
    })
    .then(async response => {
        const responseData = await response.json();
        if (!response.ok) {
            // 从响应中提取错误消息
            const errorMessage = responseData.error || '操作失败，HTTP 状态码: ' + response.status;
            throw new Error(errorMessage);
        }
        return responseData;
    })
    .then(data => {
        showLoading(false);
        // 重置提交标志
        isSubmitting = false;
        
        if (data.success) {
            showMessage('success', id ? '服务器已更新' : '服务器已添加');
            loadForwardingServers(); // 重新加载列表
        } else {
            showMessage('error', '操作失败: ' + data.error);
        }
    })
    .catch(error => {
        showLoading(false);
        // 重置提交标志
        isSubmitting = false;
        
        console.error('转发服务器操作失败:', error);
        
        // 显示友好的错误消息
        let errorMsg = error.message;
        
        // 针对常见错误提供更有用的提示
        if (errorMsg.includes('Invalid address format')) {
            errorMsg = '无效的服务器地址格式，请使用有效的 URL、IP 地址、域名或 localhost';
        }
        
        showMessage('error', '操作出错: ' + errorMsg);
    });
}

// 切换服务器状态
function toggleServer(id) {
    showLoading(true);
    
    fetch(`/api/instance-forwarding/servers/${id}/toggle`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('token')
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('切换状态失败，HTTP 状态码: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        showLoading(false);
        if (data.success) {
            showMessage('success', '服务器状态已切换');
            loadForwardingServers(); // 重新加载列表
        } else {
            showMessage('error', '切换状态失败: ' + data.error);
        }
    })
    .catch(error => {
        showLoading(false);
        showMessage('error', '切换状态出错: ' + error.message);
    });
}

// 删除服务器
function deleteServer(id) {
    if (!confirm('确定要删除此转发服务器吗？')) {
        return;
    }
    
    showLoading(true);
    
    fetch(`/api/instance-forwarding/servers/${id}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('token')
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('删除失败，HTTP 状态码: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        showLoading(false);
        if (data.success) {
            showMessage('success', '服务器已删除');
            loadForwardingServers(); // 重新加载列表
        } else {
            showMessage('error', '删除失败: ' + data.error);
        }
    })
    .catch(error => {
        showLoading(false);
        showMessage('error', '删除出错: ' + error.message);
    });
}

// 重新生成Nginx配置函数已移除 - 配置将自动生成

// 显示消息
function showMessage(type, message) {
    const messageElement = document.getElementById('forwardingConfigMessage');
    messageElement.textContent = message;
    messageElement.className = 'message';
    
    if (type === 'success') {
        messageElement.classList.add('success');
    } else if (type === 'error') {
        messageElement.classList.add('error');
    } else {
        messageElement.classList.add('info');
    }
    
    messageElement.style.display = 'block';
    
    // 设置自动消失
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 5000);
}

// 显示加载指示器
function showLoading(show) {
    isLoading = show;
    const loadingIndicator = document.querySelector('.forwarding-settings .loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = show ? 'block' : 'none';
    }
}
