/**
 * Nginx配置自动修复脚本
 * 在页面加载时自动检查和修复Nginx配置问题
 */

// 页面加载时自动运行的诊断和修复函数
async function autoFixNginxConfig() {
    // 检查是否已经运行过自动修复
    if (sessionStorage.getItem('nginx_autofix_run')) {
        console.log('Nginx自动修复已在本次会话中运行过，跳过');
        return;
    }
    
    // 标记已运行
    sessionStorage.setItem('nginx_autofix_run', 'true');
    
    console.log('🔍 开始自动诊断和修复 Nginx 配置...');
    
    try {
        // 检查API端点是否可访问
        console.log('检查 Nginx 配置 API 是否可访问...');
        const response = await fetch('/api/config/nginx', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            console.log(`API响应失败: ${response.status}`);
            
            // 如果是401/403错误，不尝试修复（权限问题）
            if (response.status === 401 || response.status === 403) {
                console.log('权限问题，不尝试自动修复');
                return;
            }
            
            // 尝试创建默认配置
            await createDefaultConfig();
        } else {
            // 尝试解析配置
            const data = await response.json();
            
            if (!data || !data.nginx) {
                console.log('响应数据不包含有效的Nginx配置，尝试创建');
                await createDefaultConfig();
            } else {
                console.log('Nginx配置正常，无需修复');
            }
        }
    } catch (error) {
        console.error('自动修复过程出错:', error);
    }
}

// 创建默认配置
async function createDefaultConfig() {
    console.log('尝试创建默认Nginx配置...');
    
    try {
        const nginxConfig = {
            enabled: false,
            domain: 'localhost',
            port: 80
        };
        
        const response = await fetch('/api/config/nginx', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(nginxConfig)
        });
        
        if (response.ok) {
            console.log('✅ 成功创建默认Nginx配置');
            
            // 通知用户
            if (window.showMessage) {
                window.showMessage('Nginx配置已自动初始化', 'success');
            }
            
            // 延迟重新加载配置
            setTimeout(() => {
                if (typeof loadNginxConfig === 'function') {
                    loadNginxConfig();
                }
            }, 1000);
        } else {
            console.error(`❌ 创建默认配置失败: ${response.status}`);
            
            // 尝试获取错误详情
            try {
                const errorData = await response.json();
                console.error('错误详情:', errorData);
            } catch (e) {
                // 无法解析错误响应
            }
        }
    } catch (error) {
        console.error('创建默认配置时出错:', error);
    }
}

// 页面加载完成后运行自动修复
document.addEventListener('DOMContentLoaded', () => {
    // 延迟运行，确保其他组件已初始化
    setTimeout(autoFixNginxConfig, 2000);
});
