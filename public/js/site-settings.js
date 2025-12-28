// 站点设置管理
// 自动适应当前协议，而不是硬编码 HTTP 或 HTTPS
// 使用全局 API_BASE 变量，避免重复声明
// const API_BASE = '/api';  // 已在 admin.js 中定义

// 加载站点设置
async function loadSiteSettings() {
    console.log('开始请求加载站点设置...');
    try {
        console.log('开始加载站点设置...');
        
        // 生成随机查询参数防止缓存
        const timestamp = new Date().getTime();
        const apiUrl = `${API_BASE}/site-settings?_nocache=${timestamp}`;
        
        // 使用协议辅助工具或默认URL
        const finalUrl = window.protocolHelper ? 
            window.protocolHelper.getApiUrl(apiUrl) : apiUrl;
        
        console.log('签发站点设置请求到:', finalUrl);
        
        const response = await fetch(finalUrl, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            credentials: 'same-origin' // 确保发送cookie
        });
        
        console.log('站点设置 API 响应状态:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('加载设置响应错误:', errorText);
            showSiteSettingsMessage('加载设置失败 (' + response.status + ')', 'error');
            return;
        }
        
        const data = await response.json();
        console.log('站点设置 API 原始响应数据:', data);
        
        // 查找表单元素
        const projectNameInput = document.getElementById('projectName');
        const siteNameInput = document.getElementById('siteName');
        const maxUsersInput = document.getElementById('maxUsers');
        const currentFaviconImg = document.getElementById('currentFavicon');
        
        if (!projectNameInput || !siteNameInput || !maxUsersInput) {
            console.error('未找到表单元素:', {
                projectNameInput: !!projectNameInput,
                siteNameInput: !!siteNameInput,
                maxUsersInput: !!maxUsersInput
            });
            showSiteSettingsMessage('表单元素不存在', 'error');
            return;
        }
        
        if (data.success && data.settings) {
            // 显示原始值用于调试
            console.log('收到的设置数据:', {
                project_name: data.settings.project_name,
                site_name: data.settings.site_name,
                favicon_path: data.settings.favicon_path,
                max_users: data.settings.max_users
            });
            
            // 强制设置表单值，即使为空也需要设置
            projectNameInput.value = data.settings.project_name || '';
            console.log('设置项目名称为:', projectNameInput.value);
            
            siteNameInput.value = data.settings.site_name || '';
            console.log('设置网站名称为:', siteNameInput.value);
            
            // 确保 max_users 值正确加载和显示
            const rawMaxUsers = data.settings.max_users;
            console.log('原始 max_users 值:', rawMaxUsers, '类型:', typeof rawMaxUsers);
            
            // 将值转换为整数
            const parsedMaxUsers = rawMaxUsers !== undefined && rawMaxUsers !== null ? parseInt(rawMaxUsers, 10) : 0;
            console.log('解析后的 max_users 值:', parsedMaxUsers);
            
            // 设置到输入框
            maxUsersInput.value = parsedMaxUsers;
            console.log('设置用户数量上限输入框为:', maxUsersInput.value);
            
            // 验证设置的值是否生效
            setTimeout(() => {
                console.log('检查表单实际值:', {
                    projectName: projectNameInput.value,
                    siteName: siteNameInput.value,
                    maxUsers: maxUsersInput.value
                });
            }, 100);
            
            // 显示当前图标
            if (currentFaviconImg && data.settings.favicon_path) {
                currentFaviconImg.src = data.settings.favicon_path + '?t=' + new Date().getTime();
                currentFaviconImg.style.display = 'block';
            }
            
            // 使用DOM API直接设置值以确保它生效
            document.querySelector('#projectName').setAttribute('value', data.settings.project_name || '');
            document.querySelector('#siteName').setAttribute('value', data.settings.site_name || '');
            const maxUsersValue = data.settings.max_users !== undefined && data.settings.max_users !== null ? parseInt(data.settings.max_users, 10) : 0;
            document.querySelector('#maxUsers').setAttribute('value', maxUsersValue);
            console.log('设置 max_users 属性为:', maxUsersValue);
            
            // 更新页面标题
            updatePageTitle(data.settings.site_name);
            
            console.log('站点设置加载成功', {
                projectNameValue: projectNameInput.value,
                siteNameValue: siteNameInput.value,
                maxUsersValue: maxUsersInput.value
            });
            
            // 显示成功消息
            showSiteSettingsMessage('站点设置已加载', 'success', 2000);
        } else {
            console.warn('站点设置数据无效:', data);
            showSiteSettingsMessage('加载站点设置失败: 无效数据', 'error');
        }
    } catch (error) {
        console.error('加载站点设置失败:', error);
        showSiteSettingsMessage('加载设置失败: ' + error.message, 'error');
    }
}

// 保存站点设置（项目名和网站名）
function saveSiteSettings() {
    try {
        // 获取按钮
        const saveButton = document.getElementById('saveSiteSettings');
        console.log('开始保存站点设置...', saveButton ? '找到按钮' : '未找到按钮');
    
        // 显示通知在消息区域
        showSiteSettingsMessage('正在保存设置...', 'info');
        
        // 获取表单数据
        const projectName = document.getElementById('projectName').value.trim();
        const siteName = document.getElementById('siteName').value.trim();
        const maxUsers = document.getElementById('maxUsers').value.trim();
        
        if (!projectName || !siteName) {
            showSiteSettingsMessage('错误: 项目名称和网站名称不能为空', 'error');
            return;
        }
        
        // 验证用户数量上限为非负整数
        const maxUsersInt = parseInt(maxUsers);
        if (isNaN(maxUsersInt) || maxUsersInt < 0) {
            showSiteSettingsMessage('错误: 用户数量上限必须是非负整数', 'error');
            return;
        }
        
        // 显示数据在控制台
        console.log(`将保存的数据: 项目名称=${projectName}, 网站名称=${siteName}, 用户上限=${maxUsersInt}`);
        
        // 保存数据（这里简化为同步版本）
        const token = localStorage.getItem('token');
        
        // 使用更简单的方式访问后端，避免可能的Promise问题
        const xhr = new XMLHttpRequest();
        
        // 使用相对路径，自动适应当前协议 (HTTP/HTTPS)
        const apiUrl = '/api/site-settings';
        console.log('发送保存请求到:', apiUrl, '当前协议:', window.location.protocol);
        
        xhr.open('PUT', apiUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        
        // 添加监听器
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                // 成功处理
                document.getElementById('siteSettingsMessage').textContent = '站点设置保存成功!';
                document.getElementById('siteSettingsMessage').style.backgroundColor = '#dcfce7';
                document.getElementById('siteSettingsMessage').style.display = 'block';
                
                // 解析返回的数据
                try {
                    const responseData = JSON.parse(xhr.responseText);
                    console.log('服务器响应数据:', responseData);
                } catch (e) {
                    console.log('无法解析响应:', xhr.responseText);
                }
                
                // 成功后重新加载设置以验证变更
                console.log('保存成功，重新加载设置信息...');
                setTimeout(() => loadSiteSettings(), 1000);
            } else {
                // 错误处理
                document.getElementById('siteSettingsMessage').textContent = '保存失败: ' + xhr.responseText;
                document.getElementById('siteSettingsMessage').style.backgroundColor = '#fee2e2';
                document.getElementById('siteSettingsMessage').style.display = 'block';
            }
        };
        
        xhr.onerror = function() {
            console.error('网络错误！无法连接到服务器。');
            document.getElementById('siteSettingsMessage').textContent = '网络错误: 无法连接到服务器';
            document.getElementById('siteSettingsMessage').style.backgroundColor = '#fee2e2';
            document.getElementById('siteSettingsMessage').style.display = 'block';
        };
        
        // 发送数据
        xhr.send(JSON.stringify({
            project_name: projectName,
            site_name: siteName,
            max_users: maxUsersInt
        }));
    
    } catch (error) {
        // 捕获并显示任何错误
        console.error('在保存过程中出现错误:', error);
        alert('错误: ' + error.message);
    }
}

// 上传网站图标
async function uploadFavicon() {
    try {
        const fileInput = document.getElementById('faviconFile');
        const file = fileInput.files[0];
        
        if (!file) {
            showSiteSettingsMessage('请选择图标文件', 'error');
            return;
        }
        
        // 检查文件类型
        const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'];
        if (!validTypes.includes(file.type)) {
            showSiteSettingsMessage('请上传有效的图标文件（PNG, JPG, GIF, ICO）', 'error');
            return;
        }
        
        // 检查文件大小（1MB）
        if (file.size > 1024 * 1024) {
            showSiteSettingsMessage('图标文件过大，请上传小于1MB的文件', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('favicon', file);
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/site-settings/favicon`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSiteSettingsMessage('图标上传成功', 'success');
            
            // 更新当前显示的图标
            document.getElementById('currentFavicon').src = data.faviconPath + '?t=' + new Date().getTime();
            
            // 刷新页面上的图标
            updateFaviconInPage(data.faviconPath);
            
            // 清空文件输入
            fileInput.value = '';
        } else {
            showSiteSettingsMessage(data.error || '上传失败', 'error');
        }
    } catch (error) {
        console.error('上传图标失败:', error);
        showSiteSettingsMessage('上传失败: ' + error.message, 'error');
    }
}

// 通过URL设置图标
async function setFaviconUrl() {
    try {
        const urlInput = document.getElementById('faviconUrl');
        const url = urlInput.value.trim();
        
        if (!url) {
            showSiteSettingsMessage('请输入图标URL', 'error');
            return;
        }
        
        // 验证URL格式
        try {
            new URL(url);
        } catch (e) {
            showSiteSettingsMessage('无效的URL格式', 'error');
            return;
        }
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/site-settings/favicon-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ url })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSiteSettingsMessage('图标URL设置成功', 'success');
            
            // 更新当前显示的图标
            document.getElementById('currentFavicon').src = data.faviconPath + '?t=' + new Date().getTime();
            
            // 刷新页面上的图标（带时间戳避免缓存）
            updateFaviconInPage(data.faviconPath);
            
            // 清空输入框
            urlInput.value = '';
        } else {
            showSiteSettingsMessage(data.error || '设置失败', 'error');
        }
    } catch (error) {
        console.error('设置图标URL失败:', error);
        showSiteSettingsMessage('设置失败: ' + error.message, 'error');
    }
}

// 更新页面上的图标
function updateFaviconInPage(faviconPath) {
    const timestamp = new Date().getTime(); // 避免缓存
    const links = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
    
    if (links.length > 0) {
        links.forEach(link => {
            link.href = `${faviconPath}?t=${timestamp}`;
        });
    } else {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = `${faviconPath}?t=${timestamp}`;
        document.head.appendChild(link);
    }
}

// 显示站点设置消息
function showSiteSettingsMessage(message, type = 'info') {
    console.log('显示消息:', message, type);
    
    const messageEl = document.getElementById('siteSettingsMessage');
    if (!messageEl) {
        console.error('未找到消息元素 ID: siteSettingsMessage!');
        console.log('尝试创建新的消息元素');
        
        // 尝试创建新的消息元素
        try {
            const container = document.querySelector('.stats-card') || document.body;
            const newMessageEl = document.createElement('div');
            newMessageEl.id = 'siteSettingsMessage';
            newMessageEl.style.padding = '10px';
            newMessageEl.style.margin = '10px 0';
            newMessageEl.style.borderRadius = '4px';
            newMessageEl.style.border = '1px solid #ccc';
            newMessageEl.textContent = message;
            
            if (container) {
                container.insertBefore(newMessageEl, container.firstChild);
                console.log('成功创建了新的消息元素');
                
                // 显示消息
                newMessageEl.className = `message show ${type}`;
                switch(type) {
                    case 'error':
                        newMessageEl.style.backgroundColor = '#fee2e2';
                        newMessageEl.style.color = '#b91c1c';
                        break;
                    case 'success':
                        newMessageEl.style.backgroundColor = '#dcfce7';
                        newMessageEl.style.color = '#15803d';
                        break;
                    default:
                        newMessageEl.style.backgroundColor = '#e0f2fe';
                        newMessageEl.style.color = '#0369a1';
                }
                return;
            }
        } catch (e) {
            console.error('创建消息元素失败:', e);
        }
        
        // 如果所有尝试都失败，使用警告框
        alert(message);
        return;
    }
    
    // 确保消息区域可见且有明显样式
    messageEl.style.display = 'block';
    messageEl.style.padding = '10px';
    messageEl.style.margin = '10px 0';
    messageEl.style.borderRadius = '4px';
    messageEl.style.opacity = '0';
    
    // 先设置消息内容
    messageEl.textContent = message;
    messageEl.className = `message show ${type}`;
    
    switch(type) {
        case 'error':
            messageEl.style.backgroundColor = '#fee2e2';
            messageEl.style.color = '#b91c1c';
            messageEl.style.border = '1px solid #f87171';
            break;
        case 'success':
            messageEl.style.backgroundColor = '#dcfce7';
            messageEl.style.color = '#15803d';
            messageEl.style.border = '1px solid #86efac';
            break;
        default:
            messageEl.style.backgroundColor = '#e0f2fe';
            messageEl.style.color = '#0369a1';
            messageEl.style.border = '1px solid #7dd3fc';
    }
    
    // 添加渐变动画效果
    setTimeout(() => {
        messageEl.style.transition = 'opacity 0.5s ease';
        messageEl.style.opacity = '1';
    }, 10);
    
    // 滚动到消息区域，确保用户看到
    try {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
        console.warn('滚动到消息区域失败:', e);
    }
    
    // 清除之前的定时器
    if (messageEl._hideTimer) {
        clearTimeout(messageEl._hideTimer);
    }
    
    // 10秒后渐隐消息
    messageEl._hideTimer = setTimeout(() => {
        messageEl.style.opacity = '0';
        setTimeout(() => {
            messageEl.textContent = '';
        }, 500);
    }, 10000);
}

// 更新页面标题
function updatePageTitle(siteName) {
    if (siteName) {
        document.title = `管理员面板 - ${siteName}`;
    }
}

// 专门更新用户数量上限
function saveMaxUsers() {
    try {
        // 获取表单数据
        const maxUsers = document.getElementById('maxUsers').value.trim();
        
        // 验证用户数量上限为非负整数
        const maxUsersInt = parseInt(maxUsers);
        if (isNaN(maxUsersInt) || maxUsersInt < 0) {
            showSiteSettingsMessage('错误: 用户数量上限必须是非负整数', 'error');
            return;
        }
        
        showSiteSettingsMessage('正在保存用户数量上限...', 'info');
        
        // 使用专门的 API 端点更新用户上限
        const xhr = new XMLHttpRequest();
        const token = localStorage.getItem('token');
        
        xhr.open('PUT', `${API_BASE}/site-settings/max-users`, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                // 成功处理
                document.getElementById('siteSettingsMessage').textContent = '用户数量上限保存成功!';
                document.getElementById('siteSettingsMessage').style.backgroundColor = '#dcfce7';
                document.getElementById('siteSettingsMessage').style.display = 'block';
                
                // 解析返回的数据
                try {
                    const responseData = JSON.parse(xhr.responseText);
                    console.log('服务器响应数据:', responseData);
                    
                    // 更新输入框显示值
                    if (responseData.max_users !== undefined) {
                        document.getElementById('maxUsers').value = responseData.max_users;
                    }
                } catch (e) {
                    console.log('无法解析响应:', xhr.responseText);
                }
                
                // 成功后重新加载设置
                console.log('保存成功，重新加载设置信息...');
                setTimeout(() => loadSiteSettings(), 1000);
            } else {
                // 错误处理
                document.getElementById('siteSettingsMessage').textContent = '保存失败: ' + xhr.responseText;
                document.getElementById('siteSettingsMessage').style.backgroundColor = '#fee2e2';
                document.getElementById('siteSettingsMessage').style.display = 'block';
            }
        };
        
        xhr.onerror = function() {
            console.error('网络错误！无法连接到服务器。');
            document.getElementById('siteSettingsMessage').textContent = '网络错误: 无法连接到服务器';
            document.getElementById('siteSettingsMessage').style.backgroundColor = '#fee2e2';
            document.getElementById('siteSettingsMessage').style.display = 'block';
        };
        
        // 发送数据
        xhr.send(JSON.stringify({ max_users: maxUsersInt }));
        console.log('发送更新请求，用户数量上限为:', maxUsersInt);
    } catch (error) {
        console.error('保存用户数量上限时出错:', error);
        showSiteSettingsMessage('保存失败: ' + error.message, 'error');
    }
}

// 初始化站点设置
function initSiteSettings() {
    const logPrefix = '初始化:';
    console.log(`${logPrefix} 开始初始化站点设置...`);
    
    try {
        // 检查表单元素是否存在
        const projectNameInput = document.getElementById('projectName');
        const siteNameInput = document.getElementById('siteName');
        const maxUsersInput = document.getElementById('maxUsers');
        
        if (!projectNameInput || !siteNameInput || !maxUsersInput) {
            console.error(`${logPrefix} 关键表单元素缺失:`, {
                projectNameInput: !!projectNameInput,
                siteNameInput: !!siteNameInput,
                maxUsersInput: !!maxUsersInput
            });
        } else {
            console.log(`${logPrefix} 表单元素已找到`);
            
            // 添加变更检测
            projectNameInput.addEventListener('change', function() {
                console.log('项目名称已更改:', this.value);
            });
            
            siteNameInput.addEventListener('change', function() {
                console.log('网站名称已更改:', this.value);
            });
            
            maxUsersInput.addEventListener('change', function() {
                console.log('用户数量上限已更改:', this.value);
            });
        }
        
        // 加载设置
        setTimeout(() => {
            console.log(`${logPrefix} 延迟加载站点设置...`);
            loadSiteSettings();
        }, 500); // 等待DOM完全加载
        
        // 保存按钮事件
        const saveButton = document.getElementById('saveSiteSettings');
        if (saveButton) {
            console.log(`${logPrefix} 找到保存按钮，绑定事件`);
            
            // 移除内联点击处理程序
            saveButton.onclick = null;
            
            // 移除所有点击事件监听器
            const oldClickListeners = getEventListeners(saveButton, 'click');
            if (oldClickListeners.length > 0) {
                console.log(`${logPrefix} 移除 ${oldClickListeners.length} 个旧的点击事件监听器`);
                oldClickListeners.forEach(listener => {
                    saveButton.removeEventListener('click', listener);
                });
            }
            
            // 添加新的事件监听器
            saveButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation(); // 阻止事件冒泡
                console.log(`${logPrefix} 保存按钮被点击`);
                
                // 直接调用directSaveSettings而不是saveSiteSettings
                if (typeof directSaveSettings === 'function') {
                    directSaveSettings();
                } else {
                    saveSiteSettings();
                }
            });
            
            // 添加额外的视觉反馈
            saveButton.addEventListener('mousedown', function() {
                this.style.transform = 'scale(0.97)';
            });
            
            saveButton.addEventListener('mouseup', function() {
                this.style.transform = 'scale(1)';
            });
        } else {
            console.error(`${logPrefix} 未找到保存按钮 ID: saveSiteSettings`);
        }
        
        // 添加帮助函数
        window.debugSiteSettings = function() {
            const inputs = {
                projectName: document.getElementById('projectName')?.value,
                siteName: document.getElementById('siteName')?.value,
                maxUsers: document.getElementById('maxUsers')?.value
            };
            console.log('当前表单状态:', inputs);
            return inputs;
        };
        
        // 上传图标按钮事件
        const uploadButton = document.getElementById('uploadFavicon');
        if (uploadButton) {
            uploadButton.addEventListener('click', uploadFavicon);
        } else {
            console.warn('未找到上传图标按钮');
        }
        
        // URL图标设置按钮事件
        const setUrlButton = document.getElementById('setFaviconUrl');
        if (setUrlButton) {
            setUrlButton.addEventListener('click', setFaviconUrl);
        } else {
            console.warn('未找到图标URL按钮');
        }
        
        // 增强消息区域显示
        const messageEl = document.getElementById('siteSettingsMessage');
        if (messageEl) {
            messageEl.style.transition = 'opacity 0.3s ease';
            // 确保消息区域默认可见
            messageEl.style.display = 'block';
        } else {
            console.error('未找到消息元素 ID: siteSettingsMessage');
            // 如果消息元素不存在，创建一个
            createMessageElement();
        }
        
        console.log('站点设置初始化完成');
    } catch (error) {
        console.error('初始化站点设置时出错:', error);
        alert('初始化站点设置失败: ' + error.message);
    }
}

// 创建消息元素（如果不存在）
function createMessageElement() {
    if (!document.getElementById('siteSettingsMessage')) {
        const containerDiv = document.querySelector('.form-group') || 
                            document.getElementById('saveSiteSettings').parentElement;
        
        if (containerDiv) {
            const messageEl = document.createElement('div');
            messageEl.id = 'siteSettingsMessage';
            messageEl.className = 'message';
            messageEl.style.display = 'none';
            messageEl.style.margin = '15px 0';
            messageEl.style.padding = '10px';
            messageEl.style.borderRadius = '4px';
            messageEl.style.transition = 'opacity 0.3s ease';
            
            containerDiv.parentNode.insertBefore(messageEl, containerDiv);
            console.log('已创建消息元素');
        }
    }
}

// 获取事件监听器
function getEventListeners(element, eventType) {
    // 在没有浏览器原生 API 的情况下模拟
    // 我们不能直接获取已注册的监听器
    // 在这里返回空数组，但会执行清除操作
    
    // 使用更直接的方法清除事件
    if (element && eventType) {
        // 将元素的指定事件处理程序设置为空
        try {
            const clonedElement = element.cloneNode(true);
            // 替换原始元素
            if (element.parentNode) {
                element.parentNode.replaceChild(clonedElement, element);
                console.log('成功清除事件监听器通过克隆元素');
                return [() => {}]; // 返回非空数组以指示已清除事件
            }
        } catch (e) {
            console.error('尝试清除事件监听器时出错:', e);
        }
    }
    return [];
}

// 当页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initSiteSettings);

// 如果页面已经加载完成，立即初始化
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('页面已加载，立即初始化站点设置');
    initSiteSettings();
}
