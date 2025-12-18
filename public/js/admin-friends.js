// 友情链接管理功能

// 全局变量，存储当前编辑的友情链接ID
let currentEditingFriendLinkId = null;

// 初始化友情链接管理
function initFriendsLinksManagement() {
    loadFriendsLinksTable();
    setupFriendsLinksEventListeners();
}

// 加载友情链接数据并填充表格
async function loadFriendsLinksTable() {
    try {
        showSpinner('friendsLinksTableContainer');
        const response = await fetch('/api/admin/friends');
        const data = await response.json();
        
        const tableBody = document.getElementById('friendsLinksTableBody');
        tableBody.innerHTML = '';
        
        if (data.success && data.data && data.data.length > 0) {
            data.data.forEach(link => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${link.id}</td>
                    <td>
                        <div class="link-info">
                            ${link.logo ? `<img src="${link.logo}" alt="${link.name}" class="friend-logo-thumbnail">` : ''}
                            <span>${link.name}</span>
                        </div>
                    </td>
                    <td><a href="${link.url}" target="_blank">${link.url}</a></td>
                    <td>${link.description || '-'}</td>
                    <td>${link.sort_order}</td>
                    <td><span class="status-badge ${link.is_active ? 'status-active' : 'status-inactive'}">${link.is_active ? '启用' : '禁用'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-secondary" onclick="editFriendLink(${link.id})">编辑</button>
                        <button class="btn btn-sm btn-danger" onclick="confirmDeleteFriendLink(${link.id}, '${link.name}')">删除</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center">暂无友情链接</td></tr>`;
        }
        hideSpinner('friendsLinksTableContainer');
        
    } catch (error) {
        // 错误处理
        hideSpinner('friendsLinksTableContainer');
        showMessage('加载友情链接失败，请稍后重试', 'error', 'friendsLinkMessage');
    }
}

// 设置友情链接管理的事件监听器
function setupFriendsLinksEventListeners() {
    // 打开添加友情链接模态框
    document.getElementById('addFriendLinkBtn').addEventListener('click', function() {
        resetFriendLinkForm();
        document.getElementById('friendLinkModalTitle').textContent = '添加友情链接';
        document.getElementById('friendLinkSaveBtn').textContent = '添加';
        currentEditingFriendLinkId = null;
        showModalById('friendLinkModal');
    });
    
    // 友情链接表单提交
    document.getElementById('friendLinkForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveFriendLink();
    });
    
    // 友情链接Logo输入变化时预览
    document.getElementById('friendLinkLogo').addEventListener('input', updateFriendLinkLogoPreview);
}

// 更新友情链接Logo预览
function updateFriendLinkLogoPreview() {
    const logoInput = document.getElementById('friendLinkLogo');
    const logoPreview = document.getElementById('friendLinkLogoPreview');
    
    if (logoInput.value.trim()) {
        logoPreview.innerHTML = `<img src="${logoInput.value}" alt="Logo预览" class="friend-logo-preview">`;
    } else {
        logoPreview.innerHTML = '<p class="text-muted">无Logo</p>';
    }
}

// 编辑友情链接
async function editFriendLink(id) {
    try {
        const response = await fetch(`/api/admin/friends/${id}`);
        const data = await response.json();
        
        if (data.success && data.data) {
            const link = data.data;
            
            // 填充表单
            document.getElementById('friendLinkName').value = link.name;
            document.getElementById('friendLinkUrl').value = link.url;
            document.getElementById('friendLinkLogo').value = link.logo || '';
            document.getElementById('friendLinkDescription').value = link.description || '';
            document.getElementById('friendLinkSortOrder').value = link.sort_order;
            document.getElementById('friendLinkIsActive').checked = !!link.is_active;
            
            // 更新Logo预览
            updateFriendLinkLogoPreview();
            
            // 设置模态框标题和按钮文本
            document.getElementById('friendLinkModalTitle').textContent = '编辑友情链接';
            document.getElementById('friendLinkSaveBtn').textContent = '保存';
            
            // 记录当前编辑的ID
            currentEditingFriendLinkId = id;
            
            // 显示模态框
            showModalById('friendLinkModal');
        } else {
            showMessage('获取友情链接详情失败', 'error', 'friendsLinkMessage');
        }
    } catch (error) {
        // 错误处理
        showMessage('获取友情链接详情失败，请稍后重试', 'error', 'friendsLinkMessage');
    }
}

// 保存友情链接（添加或更新）
async function saveFriendLink() {
    try {
        const name = document.getElementById('friendLinkName').value;
        const url = document.getElementById('friendLinkUrl').value;
        const logo = document.getElementById('friendLinkLogo').value;
        const description = document.getElementById('friendLinkDescription').value;
        const sort_order = parseInt(document.getElementById('friendLinkSortOrder').value) || 0;
        const is_active = document.getElementById('friendLinkIsActive').checked;
        
        if (!name || !url) {
            showMessage('名称和URL不能为空', 'error', 'friendsLinkMessage');
            return;
        }
        
        const friendLinkData = {
            name,
            url,
            logo: logo || null,
            description: description || null,
            sort_order,
            is_active
        };
        
        // 添加或更新友情链接
        const isUpdate = currentEditingFriendLinkId !== null;
        const apiUrl = isUpdate 
            ? `/api/admin/friends/${currentEditingFriendLinkId}` 
            : '/api/admin/friends';
        
        const response = await fetch(apiUrl, {
            method: isUpdate ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(friendLinkData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage(isUpdate ? '友情链接更新成功' : '友情链接添加成功', 'success', 'friendsLinkMessage');
            hideModal('friendLinkModal');
            loadFriendsLinksTable(); // 重新加载表格
        } else {
            showMessage(data.error || '操作失败', 'error', 'friendsLinkMessage');
        }
    } catch (error) {
        // 错误处理
        showMessage('保存友情链接失败，请稍后重试', 'error', 'friendsLinkMessage');
    }
}

// 确认删除友情链接
function confirmDeleteFriendLink(id, name) {
    showConfirm(
        `确定要删除友情链接「${name}」吗？此操作不可撤销。`,
        '确认删除',
        {
            type: 'warning',
            confirmText: '删除',
            cancelText: '取消'
        }
    ).then(result => {
        if (result) {
            deleteFriendLink(id);
        }
    });
}

// 删除友情链接
async function deleteFriendLink(id) {
    try {
        const response = await fetch(`/api/admin/friends/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('友情链接删除成功', 'success', 'friendsLinkMessage');
            loadFriendsLinksTable(); // 重新加载表格
        } else {
            showMessage(data.error || '删除失败', 'error', 'friendsLinkMessage');
        }
    } catch (error) {
        // 错误处理
        showMessage('删除友情链接失败，请稍后重试', 'error', 'friendsLinkMessage');
    }
}

// 重置友情链接表单
function resetFriendLinkForm() {
    document.getElementById('friendLinkName').value = '';
    document.getElementById('friendLinkUrl').value = '';
    document.getElementById('friendLinkLogo').value = '';
    document.getElementById('friendLinkDescription').value = '';
    document.getElementById('friendLinkSortOrder').value = '0';
    document.getElementById('friendLinkIsActive').checked = true;
    
    const logoPreview = document.getElementById('friendLinkLogoPreview');
    logoPreview.innerHTML = '<p class="text-muted">无Logo</p>';
}

// 切换到友情链接管理标签
function switchToFriendsLinksManagement() {
    // 重新加载友情链接数据
    loadFriendsLinksTable();
    
    // 可以在这里添加其他标签切换逻辑，如隐藏其他标签内容等
    // 切换到友情链接管理模块
}

// 页面加载完成后初始化友情链接管理
document.addEventListener('DOMContentLoaded', function() {
    // 检查是否在管理员页面
    if (document.getElementById('friendsLinksManagementTab')) {
        initFriendsLinksManagement();
        
        // 为友链管理标签添加点击事件
        document.getElementById('friendsLinksManagementTab').addEventListener('click', function() {
            switchToFriendsLinksManagement();
        });
    }
});
