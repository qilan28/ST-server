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
    // 直接在点击时显示消息，用于调试
    console.log('点击了保存网站设置按钮');
    showSiteSettingsMessage('正在保存设置...', 'info');
    
    try {
        const projectName = document.getElementById('projectName').value.trim();
        const siteName = document.getElementById('siteName').value.trim();
        
        console.log('要保存的数据:', { projectName, siteName });
        
        const token = localStorage.getItem('token');
        console.log('Token存在:', !!token);
        
        const response = await fetch(`${API_BASE}/site-settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                project_name: projectName,
                site_name: siteName
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSiteSettingsMessage('站点设置保存成功', 'success');
            updatePageTitle(siteName);
        } else {
            showSiteSettingsMessage(data.error || '保存失败', 'error');
        }
    } catch (error) {
        console.error('保存站点设置失败:', error);
        showSiteSettingsMessage('保存失败: ' + error.message, 'error');
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
        console.error('未找到消息元素!');
        alert(message); // 如果消息元素不存在，则使用alert显示
        return;
    }
    
    // 确保消息区域可见且有明显样式
    messageEl.style.display = 'block';
    messageEl.style.padding = '10px';
    messageEl.style.margin = '10px 0';
    messageEl.style.borderRadius = '4px';
    
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
    
    messageEl.textContent = message;
    messageEl.className = `message show ${type}`;
    
    // 滚动到消息区域，确保用户看到
    messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // 清除之前的定时器
    if (messageEl._hideTimer) {
        clearTimeout(messageEl._hideTimer);
    }
    
    // 8秒后隐藏消息
    messageEl._hideTimer = setTimeout(() => {
        messageEl.style.display = 'none';
    }, 8000);
}

// 更新页面标题
function updatePageTitle(siteName) {
    if (siteName) {
        document.title = `管理员面板 - ${siteName}`;
    }
}

// 初始化站点设置
document.addEventListener('DOMContentLoaded', function() {
    // 加载设置
    loadSiteSettings();
    
    // 保存按钮事件
    const saveButton = document.getElementById('saveSiteSettings');
    if (saveButton) {
        saveButton.addEventListener('click', saveSiteSettings);
    }
    
    // 上传图标按钮事件
    const uploadButton = document.getElementById('uploadFavicon');
    if (uploadButton) {
        uploadButton.addEventListener('click', uploadFavicon);
    }
    
    // URL图标设置按钮事件
    const setUrlButton = document.getElementById('setFaviconUrl');
    if (setUrlButton) {
        setUrlButton.addEventListener('click', setFaviconUrl);
    }
    
    // 增强消息区域显示
    const messageEl = document.getElementById('siteSettingsMessage');
    if (messageEl) {
        messageEl.style.transition = 'opacity 0.3s ease';
    }
});
