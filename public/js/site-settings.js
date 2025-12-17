// 站点设置管理
const API_BASE = '/api';

// 加载站点设置
async function loadSiteSettings() {
    try {
        const response = await fetch(`${API_BASE}/site-settings`);
        
        if (!response.ok) {
            showSiteSettingsMessage('加载设置失败', 'error');
            return;
        }
        
        const data = await response.json();
        
        if (data.success && data.settings) {
            // 填充表单
            document.getElementById('projectName').value = data.settings.project_name || '';
            document.getElementById('siteName').value = data.settings.site_name || '';
            
            // 显示当前图标
            if (data.settings.favicon_path) {
                document.getElementById('currentFavicon').src = data.settings.favicon_path;
            }
            
            console.log('站点设置加载成功');
        }
    } catch (error) {
        console.error('加载站点设置失败:', error);
        showSiteSettingsMessage('加载设置失败: ' + error.message, 'error');
    }
}

// 保存站点设置（项目名和网站名）
async function saveSiteSettings() {
    // 获取按钮并添加加载状态
    const saveButton = document.getElementById('saveSiteSettings');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = '<span style="display:inline-block;animation:spin 1s infinite linear;margin-right:5px;">⟳</span> 保存中...';
        saveButton.style.opacity = '0.7';
    }
    
    // 显示正在保存的提示
    console.log('点击了保存网站设置按钮', new Date().toISOString());
    showSiteSettingsMessage('正在保存设置...', 'info');
    
    try {
        // 获取表单数据
        const projectNameInput = document.getElementById('projectName');
        const siteNameInput = document.getElementById('siteName');
        
        if (!projectNameInput || !siteNameInput) {
            throw new Error('无法找到表单字段');
        }
        
        const projectName = projectNameInput.value.trim();
        const siteName = siteNameInput.value.trim();
        
        if (!projectName || !siteName) {
            throw new Error('项目名称和网站名称不能为空');
        }
        
        console.log('要保存的数据:', { projectName, siteName });
        
        // 获取认证Token
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未找到认证令牌，请重新登录');
        }
        
        // 发送API请求
        const response = await fetch(`${API_BASE}/site-settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                project_name: projectName,
                site_name: siteName
            }),
            // 添加请求超时
            signal: AbortSignal.timeout(10000) // 10秒超时
        });
        
        // 检查响应状态
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`服务器响应错误 (${response.status}): ${errorText || '未知错误'}`);
        }
        
        const data = await response.json();
        
        // 处理响应
        if (data.success) {
            showSiteSettingsMessage('✅ 站点设置保存成功\n新设置将在页面刷新后生效', 'success');
            updatePageTitle(siteName);
            
            // 添加动画效果等更多的反馈
            if (projectNameInput) projectNameInput.style.backgroundColor = '#dcfce7';
            if (siteNameInput) siteNameInput.style.backgroundColor = '#dcfce7';
            
            // 3秒后恢复正常背景色
            setTimeout(() => {
                if (projectNameInput) projectNameInput.style.backgroundColor = '';
                if (siteNameInput) siteNameInput.style.backgroundColor = '';
            }, 3000);
        } else {
            throw new Error(data.error || '保存失败，服务器没有提供错误详情');
        }
    } catch (error) {
        console.error('保存站点设置失败:', error);
        showSiteSettingsMessage('⚠️ 保存失败: ' + error.message, 'error');
    } finally {
        // 恢复按钮状态
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = '保存网站设置';
            saveButton.style.opacity = '1';
        }
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

// 初始化站点设置
function initSiteSettings() {
    console.log('初始化站点设置...');
    
    try {
        // 加载设置
        loadSiteSettings();
        
        // 保存按钮事件
        const saveButton = document.getElementById('saveSiteSettings');
        if (saveButton) {
            console.log('找到保存按钮，绑定事件');
            // 移除可能的旧事件监听器
            saveButton.removeEventListener('click', saveSiteSettings);
            // 添加新的事件监听器
            saveButton.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('保存按钮被点击');
                saveSiteSettings();
            });
            
            // 添加额外的视觉反馈
            saveButton.addEventListener('mousedown', function() {
                this.style.transform = 'scale(0.97)';
            });
            saveButton.addEventListener('mouseup', function() {
                this.style.transform = 'scale(1)';
            });
        } else {
            console.error('未找到保存按钮 ID: saveSiteSettings');
        }
        
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

// 当页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initSiteSettings);

// 如果页面已经加载完成，立即初始化
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('页面已加载，立即初始化站点设置');
    initSiteSettings();
}
