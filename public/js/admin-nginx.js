/**
 * 管理员面板 Nginx 配置管理
 */

// 使用已经存在的API_BASE变量或默认为'/api'
let nginxApiBase = '/api';

// 尝试使用全局API_BASE变量如果存在
try {
    if (typeof API_BASE !== 'undefined') {
        nginxApiBase = API_BASE;
    }
} catch (e) {
    // 如果API_BASE未定义，使用默认值
}

// 当前Nginx配置
let currentNginxConfig = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 加载Nginx配置
    loadNginxConfig();
    
    // 绑定事件
    bindEvents();
});

// 绑定事件
function bindEvents() {
    // 切换高级设置
    const toggleBtn = document.getElementById('toggleAdvancedBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            const advancedSettings = document.getElementById('advancedSettings');
            if (advancedSettings.style.display === 'none') {
                advancedSettings.style.display = 'block';
                this.textContent = '隐藏高级选项';
            } else {
                advancedSettings.style.display = 'none';
                this.textContent = '显示高级选项';
            }
        });
    }
    
    // 刷新配置预览
    const refreshBtn = document.getElementById('refreshPreviewBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', updateConfigPreview);
    }
    
    // 配置模板改变
    const templateSelect = document.getElementById('nginxTemplate');
    if (templateSelect) {
        templateSelect.addEventListener('change', function() {
            // 如果选择HTTPS模板，显示SSL证书选项
            const sslOptions = document.getElementById('sslCertOptions');
            if (sslOptions) {
                sslOptions.style.display = this.value === 'https' ? 'block' : 'none';
            }
            
            // 更新配置预览
            updateConfigPreview();
        });
    }
    
    // 域名、端口等基本配置改变时更新预览
    ['nginxDomain', 'nginxPort'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updateConfigPreview);
        }
    });
}

// 加载Nginx配置
async function loadNginxConfig() {
    try {
        // 显示加载指示器
        const loadingIndicator = document.querySelector('.nginx-settings .loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
        }
        
        // 请求配置
        const response = await fetch(`${nginxApiBase}/config/nginx`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.nginx) {
            // 保存配置到全局变量
            currentNginxConfig = data.nginx;
            
            // 填充表单
            document.getElementById('nginxEnabled').checked = !!data.nginx.enabled;
            document.getElementById('nginxDomain').value = data.nginx.domain || '';
            document.getElementById('nginxPort').value = data.nginx.port || 80;
            
            // 高级设置
            if (data.nginx.template) {
                const templateSelect = document.getElementById('nginxTemplate');
                // 如果选择项存在则设置
                if ([...templateSelect.options].some(opt => opt.value === data.nginx.template)) {
                    templateSelect.value = data.nginx.template;
                }
                
                // 如果是HTTPS模板，显示SSL选项
                if (data.nginx.template === 'https') {
                    document.getElementById('sslCertOptions').style.display = 'block';
                    if (data.nginx.ssl_cert_path) {
                        document.getElementById('sslCertPath').value = data.nginx.ssl_cert_path;
                    }
                }
            }
            
            if (data.nginx.log_dir) {
                document.getElementById('nginxLogDir').value = data.nginx.log_dir;
            }
            
            // 更新配置预览
            updateConfigPreview();
        }
    } catch (error) {
        // 显示错误
        showMessage(`加载Nginx配置失败: ${error.message}`, 'error', 'nginxConfigMessage');
    } finally {
        // 隐藏加载指示器
        const loadingIndicator = document.querySelector('.nginx-settings .loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}

// 更新配置预览
function updateConfigPreview() {
    const previewElement = document.getElementById('nginxConfigPreview');
    if (!previewElement) return;
    
    try {
        // 获取当前表单值
        const domain = document.getElementById('nginxDomain').value || 'yourdomain.com';
        const port = document.getElementById('nginxPort').value || 80;
        const template = document.getElementById('nginxTemplate').value || 'basic';
        
        // 如果模板库未加载
        if (!window.nginxTemplates) {
            previewElement.textContent = '# 模板库尚未加载，请刷新页面后重试';
            return;
        }
        
        // 获取选定的模板
        const templateContent = window.nginxTemplates[template];
        if (!templateContent) {
            previewElement.textContent = '# 未找到所选模板';
            return;
        }
        
        // 渲染模板
        const renderedTemplate = window.renderNginxTemplate(templateContent, domain, port);
        previewElement.textContent = renderedTemplate;
    } catch (error) {
        previewElement.textContent = `# 生成预览时出错: ${error.message}`;
    }
}

// 测试Nginx配置
async function testNginxConfig() {
    try {
        // 禁用按钮
        const testButton = document.getElementById('testNginxConfigBtn');
        if (testButton) {
            testButton.disabled = true;
            testButton.textContent = '测试中...';
        }
        
        // 获取表单值创建配置对象
        const domain = document.getElementById('nginxDomain').value;
        const port = parseInt(document.getElementById('nginxPort').value) || 80;
        const enabled = document.getElementById('nginxEnabled').checked;
        const template = document.getElementById('nginxTemplate').value || 'basic';
        
        // 高级配置
        const config = {
            enabled,
            domain,
            port,
            template,
        };
        
        // SSL证书路径(如果适用)
        if (template === 'https') {
            config.ssl_cert_path = document.getElementById('sslCertPath').value;
        }
        
        // 日志目录
        config.log_dir = document.getElementById('nginxLogDir').value;
        
        // 发送测试请求
        const response = await fetch(`${nginxApiBase}/config/nginx/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(config)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Nginx配置测试成功', 'success', 'nginxConfigMessage');
        } else {
            showMessage(`测试失败: ${data.error || '未知错误'}`, 'error', 'nginxConfigMessage');
        }
    } catch (error) {
        showMessage(`测试Nginx配置失败: ${error.message}`, 'error', 'nginxConfigMessage');
    } finally {
        // 恢复按钮状态
        const testButton = document.getElementById('testNginxConfigBtn');
        if (testButton) {
            testButton.disabled = false;
            testButton.textContent = '测试配置';
        }
    }
}

// 保存Nginx配置
async function saveNginxConfig() {
    try {
        // 禁用按钮
        const saveButton = document.getElementById('saveNginxConfigBtn');
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = '保存中...';
        }
        
        // 获取表单值创建配置对象
        const domain = document.getElementById('nginxDomain').value;
        const port = parseInt(document.getElementById('nginxPort').value) || 80;
        const enabled = document.getElementById('nginxEnabled').checked;
        const template = document.getElementById('nginxTemplate').value || 'basic';
        
        // 验证输入
        if (port < 1 || port > 65535) {
            showMessage('端口必须在1-65535之间', 'error', 'nginxConfigMessage');
            return;
        }
        
        // 高级配置
        const config = {
            enabled,
            domain,
            port,
            template,
        };
        
        // SSL证书路径(如果适用)
        if (template === 'https') {
            config.ssl_cert_path = document.getElementById('sslCertPath').value;
        }
        
        // 日志目录
        config.log_dir = document.getElementById('nginxLogDir').value;
        
        // 发送保存请求
        const response = await fetch(`${nginxApiBase}/config/nginx`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(config)
        });
        
        // 处理非200响应
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 判断成功条件
        if (!data.error && (data.message || data.nginx)) {
            showMessage('Nginx配置保存成功', 'success', 'nginxConfigMessage');
            
            // 更新当前配置
            currentNginxConfig = data.nginx || config;
            
            // 如果启用了Nginx模式，提示生成配置文件
            if (enabled && !data.error) {
                setTimeout(() => {
                    showMessage('配置保存成功！别忘了点击"生成配置文件"按钮来应用更改', 'info', 'nginxConfigMessage');
                }, 3000);
            }
        } else {
            showMessage(data.error || '保存失败', 'error', 'nginxConfigMessage');
        }
    } catch (error) {
        showMessage(`保存Nginx配置失败: ${error.message}`, 'error', 'nginxConfigMessage');
    } finally {
        // 恢复按钮状态
        const saveButton = document.getElementById('saveNginxConfigBtn');
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = '保存配置';
        }
    }
}

// 生成Nginx配置文件
async function generateNginxConfig() {
    try {
        // 禁用按钮
        const generateButton = document.getElementById('generateNginxConfigBtn');
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
                    generateButton.textContent = '生成配置文件';
                }
                return;
            }
        }
        
        // 发送生成配置文件请求
        const response = await fetch(`${nginxApiBase}/config/nginx/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        // 处理非200响应
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Windows环境下有特殊处理
        if (data.method === 'windows_simulation') {
            showMessage('配置文件已生成（Windows环境下不自动重载）', 'success', 'nginxConfigMessage');
            if (data.message) {
                showMessage(data.message, 'info', 'nginxConfigMessage');
            }
            return;
        }
        
        // 判断成功条件
        if (!data.error) {
            showMessage('Nginx配置文件生成成功', 'success', 'nginxConfigMessage');
            
            // 如果有路径信息
            if (data.path) {
                showMessage(`配置文件路径: ${data.path}`, 'info', 'nginxConfigMessage');
            }
            
            // 如果有警告信息
            if (data.warning) {
                showMessage(`警告: ${data.warning}`, 'warning', 'nginxConfigMessage');
            }
        } else {
            showMessage(data.error || '生成配置文件失败', 'error', 'nginxConfigMessage');
        }
    } catch (error) {
        showMessage(`生成Nginx配置文件失败: ${error.message}`, 'error', 'nginxConfigMessage');
    } finally {
        // 恢复按钮状态
        const generateButton = document.getElementById('generateNginxConfigBtn');
        if (generateButton) {
            generateButton.disabled = false;
            generateButton.textContent = '生成配置文件';
        }
    }
}

// 显示消息
function showMessage(text, type = 'info', elementId = 'nginxConfigMessage') {
    const messageEl = document.getElementById(elementId);
    if (!messageEl) return;
    
    // 设置消息类型样式
    messageEl.className = 'message ' + type;
    messageEl.textContent = text;
    messageEl.style.display = 'block';
    
    // 滚动到消息位置
    messageEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 导出函数到全局
window.loadNginxConfig = loadNginxConfig;
window.updateConfigPreview = updateConfigPreview;
window.saveNginxConfig = saveNginxConfig;
window.generateNginxConfig = generateNginxConfig;
window.testNginxConfig = testNginxConfig;
