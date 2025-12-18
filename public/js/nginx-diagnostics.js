/**
 * Nginx配置诊断工具
 * 用于解决配置加载问题
 */

// 诊断Nginx配置加载问题
async function diagnoseNginxConfig() {
    console.log('🔍 开始诊断 Nginx 配置问题...');
    
    // 检查UI元素
    const nginxSection = document.querySelector('.nginx-settings');
    if (!nginxSection) {
        console.error('❌ 诊断失败: 未找到 Nginx 配置区域');
        return {
            success: false,
            message: '未找到 Nginx 配置区域'
        };
    }
    
    console.log('✅ 找到 Nginx 配置区域');
    
    const enabledCheckbox = document.getElementById('nginxEnabled');
    const domainInput = document.getElementById('nginxDomain');
    const portInput = document.getElementById('nginxPort');
    
    if (!enabledCheckbox) console.error('❌ 未找到启用复选框元素');
    if (!domainInput) console.error('❌ 未找到域名输入元素');
    if (!portInput) console.error('❌ 未找到端口输入元素');
    
    if (!enabledCheckbox || !domainInput || !portInput) {
        return {
            success: false,
            message: '部分 UI 元素丢失'
        };
    }
    
    console.log('✅ 所有 UI 元素存在');
    
    // 测试API端点
    try {
        console.log('🔄 测试 Nginx 配置 API 端点...');
        const response = await fetch('/api/config/nginx');
        
        if (!response.ok) {
            console.error(`❌ API 响应错误: ${response.status} ${response.statusText}`);
            return {
                success: false,
                message: `API 错误: ${response.status} ${response.statusText}`,
                response: response
            };
        }
        
        const data = await response.json();
        console.log('✅ 收到 API 响应:', data);
        
        if (!data.config) {
            console.warn('⚠️ 响应中没有配置数据');
            return {
                success: true,
                message: 'API 响应成功，但没有配置数据',
                data: data,
                needsCreate: true
            };
        }
        
        return {
            success: true,
            message: 'API 响应成功',
            data: data
        };
    } catch (error) {
        console.error('❌ API 请求失败:', error);
        return {
            success: false,
            message: `API 请求失败: ${error.message}`,
            error: error
        };
    }
}

// 修复Nginx配置
async function fixNginxConfig() {
    console.log('🔧 尝试修复 Nginx 配置问题...');
    
    // 运行诊断
    const diagnosis = await diagnoseNginxConfig();
    
    if (diagnosis.success) {
        if (diagnosis.needsCreate) {
            // 如果需要创建配置
            console.log('📝 需要创建初始 Nginx 配置...');
            
            try {
                // 创建默认配置
                const response = await fetch('/api/config/nginx', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        enabled: false,
                        domain: '',
                        port: 80
                    })
                });
                
                if (!response.ok) {
                    console.error(`❌ 创建配置失败: ${response.status} ${response.statusText}`);
                    return {
                        success: false,
                        message: `创建配置失败: ${response.status} ${response.statusText}`
                    };
                }
                
                console.log('✅ 已创建默认配置');
                return {
                    success: true,
                    message: '已创建默认配置'
                };
            } catch (error) {
                console.error('❌ 创建配置失败:', error);
                return {
                    success: false,
                    message: `创建配置失败: ${error.message}`
                };
            }
        }
        
        // 如果诊断成功但没有需要修复的问题
        console.log('✅ Nginx 配置正常，无需修复');
        return {
            success: true,
            message: '配置正常，无需修复'
        };
    } else {
        // 尝试修复API连接问题
        console.log('🔄 尝试刷新令牌解决 API 问题...');
        
        try {
            // 尝试刷新令牌
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    localStorage.setItem('token', data.token);
                    console.log('✅ 令牌已刷新');
                    
                    // 重新加载配置
                    console.log('🔄 重新加载配置...');
                    return {
                        success: true,
                        message: '令牌已刷新，请重试',
                        action: 'reload'
                    };
                }
            }
            
            console.log('❌ 令牌刷新失败');
            return {
                success: false,
                message: '令牌刷新失败，请重新登录',
                action: 'relogin'
            };
        } catch (error) {
            console.error('❌ 修复失败:', error);
            return {
                success: false,
                message: `修复失败: ${error.message}`,
                action: 'manual'
            };
        }
    }
}

// 显示UI诊断按钮
function addDiagnosticButton() {
    const nginxSection = document.querySelector('.nginx-settings');
    if (!nginxSection) return;
    
    const actionDiv = nginxSection.querySelector('div[style*="display: flex; gap: 10px;"]');
    if (!actionDiv) return;
    
    // 创建诊断按钮
    const diagButton = document.createElement('button');
    diagButton.className = 'btn btn-secondary';
    diagButton.style.backgroundColor = '#4299e1';
    diagButton.style.marginLeft = '10px';
    diagButton.textContent = '诊断并修复';
    diagButton.onclick = async function() {
        // 显示加载中
        diagButton.disabled = true;
        diagButton.textContent = '诊断中...';
        
        try {
            // 运行修复
            const result = await fixNginxConfig();
            
            // 根据结果处理
            if (result.success) {
                if (result.action === 'reload') {
                    // 重新加载配置
                    window.showMessage('配置修复完成，正在重新加载', 'success');
                    setTimeout(() => loadNginxConfig(), 500);
                } else {
                    window.showMessage(result.message, 'success');
                }
            } else {
                window.showMessage(result.message, 'error');
                if (result.action === 'relogin') {
                    if (confirm('需要重新登录以解决问题，是否立即重定向到登录页？')) {
                        window.location.href = '/login.html';
                    }
                }
            }
        } catch (error) {
            console.error('诊断过程出错:', error);
            window.showMessage('诊断过程出错: ' + error.message, 'error');
        } finally {
            // 恢复按钮
            diagButton.disabled = false;
            diagButton.textContent = '诊断并修复';
        }
    };
    
    // 添加到DOM
    actionDiv.appendChild(diagButton);
}

// 页面加载完成后添加诊断按钮
document.addEventListener('DOMContentLoaded', function() {
    // 延迟添加按钮，确保其他元素已加载
    setTimeout(addDiagnosticButton, 1000);
});
