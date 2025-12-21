/**
 * 管理员面板 实例管理
 */

// 使用已经存在的API_BASE变量或默认为'/api'
let instancesApiBase = '/api';

// 尝试使用全局API_BASE变量如果存在
try {
    if (typeof API_BASE !== 'undefined') {
        instancesApiBase = API_BASE;
    }
} catch (e) {
    // 如果API_BASE未定义，使用默认值
}

// 当前实例配置
let currentInstances = [];
let currentMainPort = 7091;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 加载实例配置
    loadInstancesConfig();
    
    // 绑定事件
    bindInstancesEvents();
});

// 绑定事件
function bindInstancesEvents() {
    // 添加实例按钮
    const addInstanceBtn = document.getElementById('addInstanceBtn');
    if (addInstanceBtn) {
        addInstanceBtn.addEventListener('click', function() {
            addNewInstance();
        });
    }
    
    // 保存主转发端口按钮
    const saveMainPortBtn = document.getElementById('saveMainPortBtn');
    if (saveMainPortBtn) {
        saveMainPortBtn.addEventListener('click', function() {
            saveMainPort();
        });
    }
}

// 加载实例配置
async function loadInstancesConfig() {
    try {
        // 显示加载指示器
        showInstancesLoadingIndicator(true);
        
        // 请求配置
        const response = await fetch(`${instancesApiBase}/instances`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // 保存配置到全局变量
            currentInstances = data.instances || [];
            currentMainPort = data.mainPort || 7091;
            
            // 填充表单
            document.getElementById('mainForwardPort').value = currentMainPort;
            
            // 渲染实例列表
            renderInstancesList();
        } else {
            showInstancesMessage(`加载实例配置失败: ${data.error}`, 'error');
        }
    } catch (error) {
        // 显示错误
        showInstancesMessage(`加载实例配置失败: ${error.message}`, 'error');
    } finally {
        // 隐藏加载指示器
        showInstancesLoadingIndicator(false);
    }
}

// 渲染实例列表
function renderInstancesList() {
    const instancesList = document.getElementById('instancesList');
    if (!instancesList) return;
    
    // 清空列表
    instancesList.innerHTML = '';
    
    // 如果没有实例，显示提示
    if (currentInstances.length === 0) {
        instancesList.innerHTML = '<tr><td colspan="3" class="text-center">暂无实例，请添加</td></tr>';
        return;
    }
    
    // 添加实例
    currentInstances.forEach((instance, index) => {
        const tr = document.createElement('tr');
        
        // 创建单元格
        const indexCell = document.createElement('td');
        indexCell.textContent = index + 1;
        
        const addressCell = document.createElement('td');
        addressCell.textContent = instance.address;
        
        const actionsCell = document.createElement('td');
        actionsCell.className = 'text-end';
        
        // 创建删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger btn-sm';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.setAttribute('data-id', instance.id);
        deleteBtn.addEventListener('click', function() {
            deleteInstance(instance.id);
        });
        
        // 添加按钮到操作单元格
        actionsCell.appendChild(deleteBtn);
        
        // 添加单元格到行
        tr.appendChild(indexCell);
        tr.appendChild(addressCell);
        tr.appendChild(actionsCell);
        
        // 添加行到表格
        instancesList.appendChild(tr);
    });
}

// 添加新实例
async function addNewInstance() {
    // 获取地址输入框
    const instanceAddressInput = document.getElementById('instanceAddress');
    if (!instanceAddressInput) return;
    
    // 获取地址
    const address = instanceAddressInput.value.trim();
    
    if (!address) {
        showInstancesMessage('实例地址不能为空', 'error');
        return;
    }
    
    try {
        // 禁用按钮
        const addBtn = document.getElementById('addInstanceBtn');
        if (addBtn) {
            addBtn.disabled = true;
            addBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 添加中...';
        }
        
        // 发送请求
        const response = await fetch(`${instancesApiBase}/instances`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ address })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 清空输入框
            instanceAddressInput.value = '';
            
            // 显示成功消息
            showInstancesMessage('实例添加成功', 'success');
            
            // 重新加载实例列表
            loadInstancesConfig();
        } else {
            showInstancesMessage(`添加实例失败: ${data.error}`, 'error');
        }
    } catch (error) {
        showInstancesMessage(`添加实例失败: ${error.message}`, 'error');
    } finally {
        // 恢复按钮状态
        const addBtn = document.getElementById('addInstanceBtn');
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.textContent = '添加';
        }
    }
}

// 删除实例
async function deleteInstance(instanceId) {
    if (!instanceId) {
        showInstancesMessage('实例ID不能为空', 'error');
        return;
    }
    
    // 确认删除
    if (!confirm('确定要删除该实例吗？删除后将无法访问此实例。')) {
        return;
    }
    
    try {
        // 显示加载指示器
        showInstancesLoadingIndicator(true);
        
        // 发送请求
        const response = await fetch(`${instancesApiBase}/instances/${instanceId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 显示成功消息
            showInstancesMessage('实例删除成功', 'success');
            
            // 重新加载实例列表
            loadInstancesConfig();
        } else {
            showInstancesMessage(`删除实例失败: ${data.error}`, 'error');
        }
    } catch (error) {
        showInstancesMessage(`删除实例失败: ${error.message}`, 'error');
    } finally {
        // 隐藏加载指示器
        showInstancesLoadingIndicator(false);
    }
}

// 保存主转发端口
async function saveMainPort() {
    // 获取端口输入框
    const mainPortInput = document.getElementById('mainForwardPort');
    if (!mainPortInput) return;
    
    // 获取端口
    const port = parseInt(mainPortInput.value.trim());
    
    if (isNaN(port) || port < 1 || port > 65535) {
        showInstancesMessage('请输入有效的端口号 (1-65535)', 'error');
        return;
    }
    
    try {
        // 禁用按钮
        const saveBtn = document.getElementById('saveMainPortBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 保存中...';
        }
        
        // 发送请求
        const response = await fetch(`${instancesApiBase}/instances/main-port`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ port })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 更新当前主端口
            currentMainPort = port;
            
            // 显示成功消息
            showInstancesMessage('主转发端口更新成功', 'success');
            
            // 提示生成配置文件
            setTimeout(() => {
                showInstancesMessage('别忘了点击"生成配置文件"按钮来应用更改', 'info');
            }, 3000);
        } else {
            showInstancesMessage(`更新主转发端口失败: ${data.error}`, 'error');
        }
    } catch (error) {
        showInstancesMessage(`更新主转发端口失败: ${error.message}`, 'error');
    } finally {
        // 恢复按钮状态
        const saveBtn = document.getElementById('saveMainPortBtn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = '保存';
        }
    }
}

// 显示实例管理消息
function showInstancesMessage(text, type = 'info') {
    const messageEl = document.getElementById('instancesMessage');
    if (!messageEl) return;
    
    // 设置消息类型样式
    messageEl.className = 'message ' + type;
    messageEl.textContent = text;
    messageEl.style.display = 'block';
    
    // 滚动到消息位置
    messageEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 显示/隐藏加载指示器
function showInstancesLoadingIndicator(show) {
    const loadingIndicator = document.querySelector('.instances-settings .loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = show ? 'flex' : 'none';
    }
}

// 导出函数到全局
window.loadInstancesConfig = loadInstancesConfig;
window.addNewInstance = addNewInstance;
window.deleteInstance = deleteInstance;
window.saveMainPort = saveMainPort;
