/**
 * API诊断工具
 * 用于诊断和修复API连接问题
 */

// 测试API端点并返回结果
async function testApiEndpoint(endpoint) {
    console.log(`🔍 测试API端点: ${endpoint}`);
    try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        const startTime = Date.now();
        const response = await fetch(endpoint, { headers });
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const status = response.status;
        const ok = response.ok;
        
        let data = null;
        try {
            data = await response.json();
        } catch (e) {
            console.log(`解析JSON失败: ${e.message}`);
        }
        
        if (ok) {
            console.log(`✅ API端点 ${endpoint} 可访问 (状态: ${status}, 耗时: ${duration}ms)`);
        } else {
            console.log(`❌ API端点 ${endpoint} 返回错误 (状态: ${status}, 耗时: ${duration}ms)`);
        }
        
        return { endpoint, status, ok, duration, data };
    } catch (error) {
        console.error(`❌ 无法访问API端点 ${endpoint}: ${error.message}`);
        return { endpoint, error: error.message, ok: false };
    }
}

// 诊断所有关键API端点
async function diagnoseAllEndpoints() {
    console.log('🔄 开始全面API诊断...');
    
    const endpoints = [
        '/api/health',
        '/api/admin/stats',
        '/api/admin/users',
        '/api/admin/instances',
        '/api/admin/announcements',
        '/api/config/nginx',
        '/api/auth/profile'
    ];
    
    const results = [];
    let hasErrors = false;
    
    for (const endpoint of endpoints) {
        const result = await testApiEndpoint(endpoint);
        results.push(result);
        
        if (!result.ok) {
            hasErrors = true;
        }
        
        // 短暂延迟，避免过多请求
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (hasErrors) {
        console.warn('⚠️ 发现API端点问题，可能影响功能');
    } else {
        console.log('✅ 所有API端点正常访问');
    }
    
    return {
        hasErrors,
        results,
        timestamp: new Date().toISOString()
    };
}

// 修复常见问题
async function attemptAutoFix() {
    console.log('🔧 尝试自动修复常见问题...');
    
    // 检查是否需要刷新token
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('❌ 未找到认证令牌，请重新登录');
        return {
            success: false,
            message: '未找到认证令牌，请重新登录',
            action: 'redirect',
            redirectTo: '/login.html'
        };
    }
    
    try {
        // 尝试刷新用户会话
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.token) {
                localStorage.setItem('token', data.token);
                console.log('✅ 会话刷新成功，已更新令牌');
                
                // 尝试设置cookie
                document.cookie = `st_token=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}`;
                
                return {
                    success: true,
                    message: '会话刷新成功，问题可能已解决',
                    action: 'refresh'
                };
            }
        }
        
        console.log('⚠️ 会话刷新失败，可能需要重新登录');
        return {
            success: false,
            message: '会话刷新失败，可能需要重新登录',
            action: 'manual'
        };
    } catch (error) {
        console.error('❌ 自动修复过程出错:', error);
        return {
            success: false,
            message: `自动修复失败: ${error.message}`,
            action: 'manual'
        };
    }
}

// 执行完整诊断并尝试修复
async function diagnoseAndFix() {
    const diagnosisResults = await diagnoseAllEndpoints();
    
    // 如果有错误，尝试修复
    if (diagnosisResults.hasErrors) {
        const fixResult = await attemptAutoFix();
        return {
            diagnosis: diagnosisResults,
            fix: fixResult
        };
    }
    
    return {
        diagnosis: diagnosisResults,
        fix: { success: true, message: '无需修复，所有API正常' }
    };
}

// 导出为全局函数
window.diagnoseApi = {
    testEndpoint: testApiEndpoint,
    diagnoseAll: diagnoseAllEndpoints,
    attemptFix: attemptAutoFix,
    diagnoseAndFix: diagnoseAndFix
};
