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
    try {
        const projectName = document.getElementById('projectName').value.trim();
        const siteName = document.getElementById('siteName').value.trim();
        
        const token = localStorage.getItem('token');
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
            
            // 刷新页面上的图标（带时间戳避免缓存）
            const links = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
            if (links.length > 0) {
                links.forEach(link => {
                    link.href = data.faviconPath + '?t=' + new Date().getTime();
                });
            } else {
                const link = document.createElement('link');
                link.rel = 'icon';
                link.href = data.faviconPath + '?t=' + new Date().getTime();
                document.head.appendChild(link);
            }
            
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

// 显示站点设置消息
function showSiteSettingsMessage(message, type = 'info') {
    const messageEl = document.getElementById('siteSettingsMessage');
    if (!messageEl) return;
    
    messageEl.textContent = message;
    messageEl.className = `message show ${type}`;
    messageEl.style.display = 'block';
    
    // 5秒后隐藏消息
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
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
});
