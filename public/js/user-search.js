// 用户搜索与过滤功能

// 存储原始用户数据
let allUsers = [];

// 初始化搜索与过滤功能
function initUserSearch() {
    const searchInput = document.getElementById('userSearchInput');
    const roleFilter = document.getElementById('userRoleFilter');
    const statusFilter = document.getElementById('userStatusFilter');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    if (!searchInput || !roleFilter || !statusFilter) return;
    
    // 添加搜索和过滤的事件监听器
    searchInput.addEventListener('input', function() {
        // 更新清除按钮的显示状态
        clearSearchBtn.style.display = this.value ? 'block' : 'none';
        filterUsers();
    });
    
    roleFilter.addEventListener('change', filterUsers);
    statusFilter.addEventListener('change', filterUsers);
    
    // 清除搜索按钮
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            searchInput.value = '';
            this.style.display = 'none';
            filterUsers();
            searchInput.focus();
        });
    }
    
    console.log('用户搜索功能已初始化');
}

// 保存原始用户列表数据
function storeUsers(users) {
    allUsers = [...users];
}

// 过滤用户
function filterUsers() {
    const searchInput = document.getElementById('userSearchInput');
    const roleFilter = document.getElementById('userRoleFilter');
    const statusFilter = document.getElementById('userStatusFilter');
    
    if (!searchInput || !roleFilter || !statusFilter) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    const roleValue = roleFilter.value;
    const statusValue = statusFilter.value;
    
    // 如果没有原始数据，则直接返回
    if (!allUsers || allUsers.length === 0) return;
    
    // 过滤用户
    const filteredUsers = allUsers.filter(user => {
        // 搜索条件
        const matchSearch = 
            !searchTerm || 
            user.username.toLowerCase().includes(searchTerm) ||
            (user.email && user.email.toLowerCase().includes(searchTerm)) ||
            String(user.port).includes(searchTerm);
        
        // 角色过滤
        const matchRole = 
            roleValue === 'all' || 
            (roleValue === 'admin' && user.role === 'admin') || 
            (roleValue === 'user' && user.role !== 'admin');
        
        // 状态过滤
        const matchStatus = 
            statusValue === 'all' || 
            (statusValue === 'running' && user.status === 'running') || 
            (statusValue === 'stopped' && user.status !== 'running');
        
        return matchSearch && matchRole && matchStatus;
    });
    
    // 更新用户表格
    renderFilteredUsers(filteredUsers);
}

// 渲染过滤后的用户列表
function renderFilteredUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    const resultCountElement = document.getElementById('searchResultCount');
    if (!tbody) return;
    
    // 更新搜索结果计数
    if (resultCountElement) {
        if (users.length !== allUsers.length) {
            resultCountElement.textContent = `显示 ${users.length}/${allUsers.length} 条`;
        } else {
            resultCountElement.textContent = `共 ${users.length} 条`;
        }
    }
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 30px;">未找到匹配的用户</td></tr>';
        return;
    }
    
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
    
    // 为用户操作按钮添加事件监听器
    attachUserActionListeners();
    
    // 延迟加载用户头像
    setTimeout(() => {
        lazyLoadUserAvatars();
    }, 300);
}

// 窗口加载时初始化搜索功能
document.addEventListener('DOMContentLoaded', initUserSearch);
