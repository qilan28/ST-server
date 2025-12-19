/**
 * SillyTavern运行时长限制管理
 * 管理员可以设置实例的最大运行时长，超时自动停止
 */

// 使用已存在的API_BASE或创建新变量
// 避免重复声明错误
if (typeof API_BASE === 'undefined') {
    window.API_BASE = '/api';
}

// 适配管理员页面的API请求函数
if (typeof apiRequest !== 'function') {
    async function apiRequest(url, options = {}) {
        const token = localStorage.getItem('token');
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        };
        
        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };
        
        // 使用协议帮手，如果有的话
        let apiUrl = url;
        if (window.protocolHelper) {
            apiUrl = window.protocolHelper.getApiUrl(url);
        }
        
        try {
            const response = await fetch(apiUrl, mergedOptions);
            
            if (response.status === 401) {
                console.warn('未授权访问，可能需要重新登录');
                if (showMessage) showMessage('会话已过期，请重新登录', 'error');
                // 可选：重定向到登录页面
                // window.location.href = '/login.html';
            }
            
            return response;
            
        } catch (error) {
            console.error('API请求错误:', error);
            if (showMessage) showMessage('网络请求失败', 'error');
            return null;
        }
    }
    
    // 将函数添加到全局作用域
    window.apiRequest = apiRequest;
}

// 格式化日期的帮助函数
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString; // 如果日期无效，直接返回原字符串
        
        return date.toLocaleString('zh-CN', {
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (error) {
        console.error('格式化日期错误:', error);
        return dateString;
    }
}

// 加载运行时长限制配置
async function loadRuntimeLimitConfig() {
    try {
        // 显示加载状态
        const configSection = document.getElementById('runtimeLimitConfig');
        if (configSection) {
            configSection.innerHTML = '<div class="loading-indicator">加载中...</div>';
        }

        console.log('开始加载运行时长限制配置...');
        
        // 设置请求超时
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('请求超时')), 5000);
        });
        
        // 直接使用fetch调用API
        const token = localStorage.getItem('token');
        const fetchPromise = fetch('/api/runtime-limit/config', {
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        
        // 使用Promise.race来实现超时处理
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!response.ok) {
            console.error('加载配置失败:', response.status, response.statusText);
            // 使用默认配置并显示错误
            const defaultConfig = {
                enabled: 0,
                max_runtime_minutes: 120,
                warning_minutes: 5,
                check_interval_seconds: 60
            };
            
            renderRuntimeLimitForm(defaultConfig);
            
            if (configSection) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.style.marginTop = '10px';
                errorDiv.innerHTML = `加载失败: ${response.status} ${response.statusText}。使用默认配置。`;
                configSection.appendChild(errorDiv);
            }
            
            if (typeof showMessage === 'function') {
                showMessage('配置加载失败，使用默认配置', 'warning');
            }
            return;
        }

        const data = await response.json();
        console.log('获取到的配置数据:', data);

        // 即使数据格式不正确，也使用默认配置呈现表单
        let config;
        
        if (data.success && data.config) {
            // 使用服务器返回的配置
            config = data.config;
        } else {
            // 如果服务器返回的数据格式不正确，使用默认配置
            console.warn('加载运行时长限制配置失败，使用默认配置:', data.error || '未知错误');
            config = {
                enabled: 0,
                max_runtime_minutes: 120,
                warning_minutes: 5,
                check_interval_seconds: 60
            };
            
            if (typeof showMessage === 'function') {
                showMessage('使用默认配置，请保存设置', 'warning');
            }
        }
        
        // 渲染表单
        renderRuntimeLimitForm(config);
    } catch (error) {
        console.error('加载运行时长限制配置错误:', error);
        
        // 出错时使用默认配置
        const defaultConfig = {
            enabled: 0,
            max_runtime_minutes: 120,
            warning_minutes: 5,
            check_interval_seconds: 60
        };
        
        // 确保表单渲染即使有错误
        const configSection = document.getElementById('runtimeLimitConfig');
        if (configSection) {
            renderRuntimeLimitForm(defaultConfig);
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.style.marginTop = '10px';
            errorDiv.innerHTML = `加载失败: ${error.message}。使用默认配置。`;
            configSection.appendChild(errorDiv);
        }
        
        if (typeof showMessage === 'function') {
            showMessage('加载配置失败: ' + error.message + '，使用默认配置', 'error');
        }
    }
}

// 渲染运行时长限制表单
function renderRuntimeLimitForm(config) {
    const configSection = document.getElementById('runtimeLimitConfig');
    if (!configSection) return;

    configSection.innerHTML = `
    <div class="config-form">
        <h3>运行时长限制设置</h3>
        
        <div class="form-group">
            <label class="form-label">
                <input type="checkbox" id="runtimeLimitEnabled" 
                       ${config.enabled ? 'checked' : ''}>
                启用运行时长限制
            </label>
            <div class="help-text">启用后，系统将定期检查实例运行时长，超过限制自动停止</div>
        </div>
        
        <div class="form-group">
            <label for="maxRuntimeMinutes">最大运行时长（分钟）</label>
            <input type="number" id="maxRuntimeMinutes" class="form-control" 
                   value="${config.max_runtime_minutes}" min="5" max="1440">
            <div class="help-text">实例允许的最大运行时长，超过后将自动停止（5-1440分钟）</div>
        </div>
        
        <div class="form-group">
            <label for="warningMinutes">提前警告时间（分钟）</label>
            <input type="number" id="warningMinutes" class="form-control" 
                   value="${config.warning_minutes}" min="1" max="60">
            <div class="help-text">在实例即将超时前多少分钟发送警告（1-60分钟）</div>
        </div>
        
        <div class="form-group">
            <label for="checkIntervalSeconds">检查间隔（秒）</label>
            <input type="number" id="checkIntervalSeconds" class="form-control" 
                   value="${config.check_interval_seconds}" min="10" max="3600">
            <div class="help-text">系统检查实例运行时长的间隔（10-3600秒）</div>
        </div>
        
        <div class="form-group">
            <label class="form-label">
                <input type="checkbox" id="autoRestartEnabled" 
                       ${config.auto_restart_after_stop ? 'checked' : ''}>
                超时后自动重启
            </label>
            <div class="help-text">当实例因时间限制被停止后，自动重启它</div>
        </div>
        
        <div class="form-actions">
            <button onclick="saveRuntimeLimitConfig()" class="btn btn-primary">保存设置</button>
            <button onclick="loadRuntimeLimitStatus()" class="btn btn-secondary">查看当前状态</button>
            <button onclick="loadExemptionsList()" class="btn btn-secondary">谁免名单</button>
            <button onclick="loadRuntimeStats()" class="btn btn-secondary">运行统计</button>
            <button onclick="forceCheckTimeout()" class="btn btn-warning">强制检查超时</button>
            <button onclick="loadInstanceRecords()" class="btn btn-info">实例记录状态</button>
        </div>
        
        <div id="runtimeLimitMessage" class="message" style="display: none;"></div>
    </div>
    
    <div id="runtimeLimitStatus" style="display: none; margin-top: 20px;">
        <h4>当前运行实例状态</h4>
        <div id="runtimeLimitStatusContent"></div>
    </div>
    
    <div id="runtimeExemptions" style="display: none; margin-top: 20px;">
        <h4>运行时间谁免名单</h4>
        <div id="runtimeExemptionsContent"></div>
    </div>
    
    <div id="runtimeStatsSection" style="display: none; margin-top: 20px;">
        <h4>运行时间统计数据</h4>
        <div id="runtimeStatsContent"></div>
    </div>
    
    <div id="instanceRecordsSection" style="display: none; margin-top: 20px;">
        <h4>实例记录状态</h4>
        <div id="instanceRecordsContent"></div>
    </div>
    `;
}

// 保存运行时长限制配置
async function saveRuntimeLimitConfig() {
    try {
        const enabled = document.getElementById('runtimeLimitEnabled').checked;
        const maxRuntimeMinutes = parseInt(document.getElementById('maxRuntimeMinutes').value);
        const warningMinutes = parseInt(document.getElementById('warningMinutes').value);
        const checkIntervalSeconds = parseInt(document.getElementById('checkIntervalSeconds').value);
        const autoRestart = document.getElementById('autoRestartEnabled').checked;
        
        // 验证输入
        if (isNaN(maxRuntimeMinutes) || maxRuntimeMinutes < 5 || maxRuntimeMinutes > 1440) {
            showRuntimeLimitMessage('最大运行时长必须在5-1440分钟之间', 'error');
            return;
        }
        
        if (isNaN(warningMinutes) || warningMinutes < 1 || warningMinutes > 60) {
            showRuntimeLimitMessage('警告提前时间必须在1-60分钟之间', 'error');
            return;
        }
        
        if (isNaN(checkIntervalSeconds) || checkIntervalSeconds < 10 || checkIntervalSeconds > 3600) {
            showRuntimeLimitMessage('检查间隔必须在10-3600秒之间', 'error');
            return;
        }
        
        if (warningMinutes >= maxRuntimeMinutes) {
            showRuntimeLimitMessage('警告提前时间必须小于最大运行时长', 'error');
            return;
        }
        
        // 显示保存中状态
        showRuntimeLimitMessage('保存中...', 'info');
        
        // 直接使用fetch
        const token = localStorage.getItem('token');
        const response = await fetch('/api/runtime-limit/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({
                enabled,
                maxRuntimeMinutes,
                warningMinutes,
                checkIntervalSeconds,
                autoRestart
            })
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (data.success) {
            showRuntimeLimitMessage('配置已保存', 'success');
            
            // 如果启用了限制，提示用户关于实例的可能影响
            if (enabled) {
                let message = `运行时长限制已启用！所有实例在运行超过 ${maxRuntimeMinutes} 分钟后将自动停止`;  
                
                if (autoRestart) {
                    message += '，并自动重启。';
                } else {
                    message += '。';
                }
                
                showMessage(message, 'warning');
            }
        } else {
            showRuntimeLimitMessage(data.error || '保存失败', 'error');
        }
    } catch (error) {
        console.error('保存运行时长限制配置错误:', error);
        showRuntimeLimitMessage('保存失败: ' + error.message, 'error');
    }
}

// 加载运行实例状态
async function loadRuntimeLimitStatus() {
    try {
        const statusDiv = document.getElementById('runtimeLimitStatus');
        const statusContent = document.getElementById('runtimeLimitStatusContent');
        
        if (!statusDiv || !statusContent) return;
        
        // 显示加载中
        statusDiv.style.display = 'block';
        statusContent.innerHTML = '<div class="loading-indicator">加载中...</div>';
        
        // 设置请求超时
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('请求超时')), 5000);
        });
        
        // 直接使用fetch
        const token = localStorage.getItem('token');
        const fetchPromise = fetch('/api/runtime-limit/status', {
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        
        // 使用Promise.race来实现超时处理
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!response || !response.ok) {
            statusContent.innerHTML = `<div class="error-message">加载失败: ${response ? response.status + ' ' + response.statusText : '网络错误'}</div>`;
            return;
        }
        
        const data = await response.json().catch(err => {
            console.error('解析响应数据失败:', err);
            statusContent.innerHTML = `<div class="error-message">解析数据失败: ${err.message}</div>`;
            return null;
        });
        
        if (!data) return;
        
        if (data.success) {
            const { config, timeoutInstances, warningInstances } = data;
            
            // 预设默认的config，以防数据不完整
            const safeConfig = config || {
                enabled: 0,
                max_runtime_minutes: 120,
                warning_minutes: 5,
                check_interval_seconds: 60
            };
            
            // 确保实例数组有效
            const safeTimeoutInstances = Array.isArray(timeoutInstances) ? timeoutInstances : [];
            const safeWarningInstances = Array.isArray(warningInstances) ? warningInstances : [];
            
            // 创建状态概览
            let html = `
            <div class="status-overview">
                <div class="status-item">
                    <div class="status-label">功能状态</div>
                    <div class="status-value">
                        <span class="status-badge ${safeConfig.enabled ? 'status-running' : 'status-stopped'}">
                            ${safeConfig.enabled ? '已启用' : '已禁用'}
                        </span>
                    </div>
                </div>
                <div class="status-item">
                    <div class="status-label">最大运行时长</div>
                    <div class="status-value">${safeConfig.max_runtime_minutes} 分钟</div>
                </div>
                <div class="status-item">
                    <div class="status-label">超时实例数</div>
                    <div class="status-value">
                        <span class="${safeTimeoutInstances.length > 0 ? 'warning-text' : ''}">
                            ${safeTimeoutInstances.length}
                        </span>
                    </div>
                </div>
                <div class="status-item">
                    <div class="status-label">即将超时实例</div>
                    <div class="status-value">
                        <span class="${safeWarningInstances.length > 0 ? 'notice-text' : ''}">
                            ${safeWarningInstances.length}
                        </span>
                    </div>
                </div>
            </div>
            `;
            
            // 添加实例列表（如果有的话）
            if (safeTimeoutInstances.length > 0 || safeWarningInstances.length > 0) {
                html += '<h5 class="mt-4">实例详情</h5>';
                
                if (safeTimeoutInstances.length > 0) {
                    html += `
                    <div class="instance-group">
                        <h6>已超时实例</h6>
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>用户名</th>
                                    <th>启动时间</th>
                                    <th>已运行</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                    
                    safeTimeoutInstances.forEach(instance => {
                        html += `
                        <tr>
                            <td>${instance.username || '-'}</td>
                            <td>${formatDate(instance.start_time || '')}</td>
                            <td>${Math.floor(instance.runtime_minutes || 0)} 分钟</td>
                            <td>
                                <button onclick="stopUserInstance('${instance.username || ''}')" class="btn-action btn-stop" title="停止">⏸️</button>
                            </td>
                        </tr>
                        `;
                    });
                    
                    html += `
                            </tbody>
                        </table>
                    </div>
                    `;
                }
                
                if (safeWarningInstances.length > 0) {
                    html += `
                    <div class="instance-group">
                        <h6>即将超时实例</h6>
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>用户名</th>
                                    <th>启动时间</th>
                                    <th>已运行</th>
                                    <th>剩余时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                    
                    safeWarningInstances.forEach(instance => {
                        const remainingMinutes = Math.floor(safeConfig.max_runtime_minutes - (instance.runtime_minutes || 0));
                        
                        html += `
                        <tr>
                            <td>${instance.username || '-'}</td>
                            <td>${formatDate(instance.start_time || '')}</td>
                            <td>${Math.floor(instance.runtime_minutes || 0)} 分钟</td>
                            <td>${remainingMinutes} 分钟</td>
                            <td>
                                <button onclick="stopUserInstance('${instance.username || ''}')" class="btn-action btn-stop" title="停止">⏸️</button>
                            </td>
                        </tr>
                        `;
                    });
                    
                    html += `
                            </tbody>
                        </table>
                    </div>
                    `;
                }
            } else {
                html += `
                <div class="no-instances">
                    <p>当前没有运行中的实例或即将超时的实例。</p>
                </div>
                `;
            }
            
            statusContent.innerHTML = html;
        } else {
            statusContent.innerHTML = `<div class="error-message">加载失败: ${data.error || '未知错误'}</div>`;
        }
    } catch (error) {
        console.error('加载运行实例状态错误:', error);
        const statusContent = document.getElementById('runtimeLimitStatusContent');
        if (statusContent) {
            statusContent.innerHTML = `<div class="error-message">加载失败: ${error.message}</div>`;
        }
    }
}

// 显示运行时长限制相关消息
function showRuntimeLimitMessage(text, type = 'error') {
    const messageEl = document.getElementById('runtimeLimitMessage');
    if (!messageEl) {
        // 如果找不到消息元素，尝试使用全局的showMessage函数
        if (typeof showMessage === 'function') {
            showMessage(text, type);
        } else {
            console.warn('无法显示消息:', text);
            alert(text); // 作为最后的备选方案
        }
        return;
    }
    
    messageEl.textContent = text;
    messageEl.className = `message show ${type}`;
    messageEl.style.display = 'block';
    
    // 3秒后自动隐藏成功消息
    if (type === 'success') {
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 3000);
    }
}

// 页面加载完成后自动加载配置
// 停止用户实例的函数
async function stopUserInstance(username) {
    if (!username) {
        showMessage('用户名无效', 'error');
        return;
    }
    
    try {
        if (!confirm(`确定要停止用户 ${username} 的实例吗？`)) {
            return;
        }
        
        showMessage(`正在停止 ${username} 的实例...`, 'info');
        
        // 直接使用fetch
        const token = localStorage.getItem('token');
        // 使用运行时限制器提供的管理员专用端点
        const response = await fetch('/api/runtime-limit/admin-stop/' + encodeURIComponent(username), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            // 管理API的响应格式没有success字段，而是直接在200响应中返回消息
            showMessage(`已停止 ${username} 的实例`, 'success');
            // 重新加载状态
            setTimeout(loadRuntimeLimitStatus, 1000);
        } else {
            // 尝试解析错误信息
            try {
                const errorData = await response.json();
                showMessage(`停止失败: ${errorData.error || response.statusText}`, 'error');
            } catch (e) {
                showMessage(`停止失败: ${response.status} ${response.statusText}`, 'error');
            }
        }
    } catch (error) {
        console.error('停止实例错误:', error);
        showMessage('停止实例时出错: ' + error.message, 'error');
    }
}

// 加载豁免用户名单
async function loadExemptionsList() {
    try {
        const exemptionsSection = document.getElementById('runtimeExemptions');
        const exemptionsContent = document.getElementById('runtimeExemptionsContent');
        
        if (!exemptionsSection || !exemptionsContent) return;
        
        // 显示加载中
        exemptionsSection.style.display = 'block';
        exemptionsContent.innerHTML = '<div class="loading-indicator">加载中...</div>';
        
        // 设置请求超时
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('请求超时')), 5000);
        });
        
        // 发起请求
        const token = localStorage.getItem('token');
        const fetchPromise = fetch('/api/runtime-limit/exemptions', {
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!response || !response.ok) {
            exemptionsContent.innerHTML = `<div class="error-message">加载失败: ${response ? response.status + ' ' + response.statusText : '网络错误'}</div>`;
            return;
        }
        
        const data = await response.json().catch(err => {
            console.error('解析响应数据失败:', err);
            exemptionsContent.innerHTML = `<div class="error-message">解析数据失败: ${err.message}</div>`;
            return null;
        });
        
        if (!data) return;
        
        if (data.success) {
            const exemptions = data.exemptions || [];
            
            // 创建添加豁免表单
            let html = `
            <div class="add-exemption-form">
                <h5>添加豁免用户</h5>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <input type="text" id="exemptUsername" class="form-control" placeholder="输入用户名" style="flex-grow: 1;">
                    <input type="text" id="exemptReason" class="form-control" placeholder="豁免原因（可选）" style="flex-grow: 2;">
                    <button onclick="addExemptionUser()" class="btn btn-primary">添加</button>
                </div>
            </div>
            `;
            
            // 如果已有豁免用户，显示列表
            if (exemptions.length > 0) {
                html += `
                <div class="exemptions-list">
                    <h5>当前豁免用户</h5>
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>用户名</th>
                                <th>邮箱</th>
                                <th>原因</th>
                                <th>添加者</th>
                                <th>添加时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                exemptions.forEach(exemption => {
                    html += `
                    <tr>
                        <td>${exemption.username || '-'}</td>
                        <td>${exemption.email || '-'}</td>
                        <td>${exemption.reason || '-'}</td>
                        <td>${exemption.added_by || 'system'}</td>
                        <td>${formatDate(exemption.created_at || '')}</td>
                        <td>
                            <button onclick="removeExemptionUser('${exemption.username}')" class="btn-action btn-danger" title="移除豁免">✖</button>
                        </td>
                    </tr>
                    `;
                });
                
                html += `
                        </tbody>
                    </table>
                </div>
                `;
            } else {
                html += `
                <div class="no-exemptions">
                    <p>当前没有用户在豁免名单中。</p>
                </div>
                `;
            }
            
            exemptionsContent.innerHTML = html;
        } else {
            exemptionsContent.innerHTML = `<div class="error-message">加载失败: ${data.error || '未知错误'}</div>`;
        }
    } catch (error) {
        console.error('加载豁免名单错误:', error);
        const exemptionsContent = document.getElementById('runtimeExemptionsContent');
        if (exemptionsContent) {
            exemptionsContent.innerHTML = `<div class="error-message">加载失败: ${error.message}</div>`;
        }
    }
}

// 添加豁免用户
async function addExemptionUser() {
    try {
        const username = document.getElementById('exemptUsername').value.trim();
        const reason = document.getElementById('exemptReason').value.trim();
        
        if (!username) {
            showMessage('请输入用户名', 'error');
            return;
        }
        
        showMessage(`正在添加用户 ${username} 到豁免名单...`, 'info');
        
        // 发送请求
        const token = localStorage.getItem('token');
        const response = await fetch('/api/runtime-limit/exemptions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ username, reason })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            showMessage(`添加失败: ${response.status} ${errorText}`, 'error');
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            showMessage(`用户 ${username} 已添加到豁免名单`, 'success');
            
            // 重新加载豁免名单
            setTimeout(loadExemptionsList, 1000);
            
            // 清空输入框
            document.getElementById('exemptUsername').value = '';
            document.getElementById('exemptReason').value = '';
        } else {
            showMessage(`添加失败: ${data.error || '未知错误'}`, 'error');
        }
    } catch (error) {
        console.error('添加豁免用户错误:', error);
        showMessage('添加豁免用户时出错: ' + error.message, 'error');
    }
}

// 移除豁免用户
async function removeExemptionUser(username) {
    if (!username) {
        showMessage('用户名无效', 'error');
        return;
    }
    
    try {
        if (!confirm(`确定要移除用户 ${username} 的豁免吗？`)) {
            return;
        }
        
        showMessage(`正在移除用户 ${username} 的豁免...`, 'info');
        
        // 发送请求
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/runtime-limit/exemptions/${encodeURIComponent(username)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            showMessage(`移除失败: ${response.status} ${errorText}`, 'error');
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            showMessage(`用户 ${username} 已从豁免名单中移除`, 'success');
            // 重新加载豁免名单
            setTimeout(loadExemptionsList, 1000);
        } else {
            showMessage(`移除失败: ${data.error || '未知错误'}`, 'error');
        }
    } catch (error) {
        console.error('移除谐免用户错误:', error);
        showMessage('移除谐免用户时出错: ' + error.message, 'error');
    }
}

// 加载运行时间统计信息
async function loadRuntimeStats() {
    try {
        const statsSection = document.getElementById('runtimeStatsSection');
        const statsContent = document.getElementById('runtimeStatsContent');
        
        if (!statsSection || !statsContent) return;
        
        // 显示加载中
        statsSection.style.display = 'block';
        statsContent.innerHTML = '<div class="loading-indicator">加载中...</div>';
        
        // 发送请求
        const token = localStorage.getItem('token');
        const response = await fetch('/api/runtime-limit/stats', {
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        
        if (!response.ok) {
            statsContent.innerHTML = `<div class="error-message">加载失败: ${response.status} ${response.statusText}</div>`;
            return;
        }
        
        const data = await response.json();
        
        if (data.success && data.stats) {
            const stats = data.stats;
            
            // 格式化时间数据的函数
            const formatTime = (minutes) => {
                if (!minutes || isNaN(minutes)) return '0';
                
                const hours = Math.floor(minutes / 60);
                const mins = Math.floor(minutes % 60);
                
                if (hours > 0) {
                    return `${hours}小时${mins > 0 ? ` ${mins}分钟` : ''}`;
                } else {
                    return `${mins}分钟`;
                }
            };
            
            // 创建统计卡片
            let html = `
            <div class="stats-overview">
                <div class="stats-item">
                    <div class="stats-label">运行中实例</div>
                    <div class="stats-value">${stats.running_instances || 0}</div>
                </div>
                <div class="stats-item">
                    <div class="stats-label">谁免实例</div>
                    <div class="stats-value">${stats.exempt_instances || 0}</div>
                </div>
                <div class="stats-item">
                    <div class="stats-label">受限制实例</div>
                    <div class="stats-value">${stats.watched_instances || 0}</div>
                </div>
                <div class="stats-item">
                    <div class="stats-label">总历史会话</div>
                    <div class="stats-value">${stats.total_sessions || 0}</div>
                </div>
            </div>
            
            <div class="stats-details">
                <h5>总体统计</h5>
                <div class="stats-grid">
                    <div class="stats-detail-item">
                        <div class="stats-detail-label">平均会话时长</div>
                        <div class="stats-detail-value">${formatTime(stats.avg_duration)}</div>
                    </div>
                    <div class="stats-detail-item">
                        <div class="stats-detail-label">最长会话时长</div>
                        <div class="stats-detail-value">${formatTime(stats.max_duration)}</div>
                    </div>
                    <div class="stats-detail-item">
                        <div class="stats-detail-label">累计运行时间</div>
                        <div class="stats-detail-value">${formatTime(stats.total_runtime)}</div>
                    </div>
                </div>
                
                <h5>今日统计</h5>
                <div class="stats-grid">
                    <div class="stats-detail-item">
                        <div class="stats-detail-label">今日会话数</div>
                        <div class="stats-detail-value">${stats.today_sessions || 0}</div>
                    </div>
                    <div class="stats-detail-item">
                        <div class="stats-detail-label">今日平均时长</div>
                        <div class="stats-detail-value">${formatTime(stats.today_avg_duration)}</div>
                    </div>
                    <div class="stats-detail-item">
                        <div class="stats-detail-label">今日总时长</div>
                        <div class="stats-detail-value">${formatTime(stats.today_runtime)}</div>
                    </div>
                </div>
            </div>
            `;
            
            statsContent.innerHTML = html;
            
            // 添加美化样式
            const style = document.createElement('style');
            style.textContent = `
                .stats-overview {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .stats-item {
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    text-align: center;
                }
                .stats-label {
                    color: #718096;
                    font-size: 0.9rem;
                    margin-bottom: 5px;
                }
                .stats-value {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #2d3748;
                }
                .stats-details {
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .stats-detail-item {
                    padding: 10px;
                    background: #f7fafc;
                    border-radius: 6px;
                }
                .stats-detail-label {
                    color: #4a5568;
                    font-size: 0.85rem;
                    margin-bottom: 3px;
                }
                .stats-detail-value {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #2d3748;
                }
                h5 {
                    color: #4a5568;
                    margin: 15px 0 10px 0;
                    font-size: 16px;
                }
            `;
            document.head.appendChild(style);
        } else {
            statsContent.innerHTML = `<div class="error-message">加载失败: ${data.error || '未知错误'}</div>`;
        }
    } catch (error) {
        console.error('加载运行时间统计错误:', error);
        const statsContent = document.getElementById('runtimeStatsContent');
        if (statsContent) {
            statsContent.innerHTML = `<div class="error-message">加载失败: ${error.message}</div>`;
        }
    }
}

// 强制检查超时实例
async function forceCheckTimeout() {
    try {
        showMessage('正在强制检查超时实例...', 'info');
        
        // 发送请求
        const token = localStorage.getItem('token');
        const response = await fetch('/api/runtime-limit/force-check', {
            method: 'POST',
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        
        if (!response.ok) {
            showMessage(`检查失败: ${response.status} ${response.statusText}`, 'error');
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('强制检查完成，请刷新状态查看结果', 'success');
            // 自动刷新状态
            setTimeout(loadRuntimeLimitStatus, 2000);
        } else {
            showMessage(`检查失败: ${data.error || '未知错误'}`, 'error');
        }
    } catch (error) {
        console.error('强制检查超时实例错误:', error);
        showMessage('强制检查超时实例失败: ' + error.message, 'error');
    }
}

// 加载实例记录状态
async function loadInstanceRecords() {
    try {
        const recordsSection = document.getElementById('instanceRecordsSection');
        const recordsContent = document.getElementById('instanceRecordsContent');
        
        if (!recordsSection || !recordsContent) return;
        
        // 显示加载中
        recordsSection.style.display = 'block';
        recordsContent.innerHTML = '<div class="loading-indicator">加载中...</div>';
        
        // 设置请求超时
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('请求超时')), 5000);
        });
        
        // 发起请求
        const token = localStorage.getItem('token');
        const fetchPromise = fetch('/api/runtime-limit/instance-records', {
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!response || !response.ok) {
            recordsContent.innerHTML = `<div class="error-message">加载失败: ${response ? response.status + ' ' + response.statusText : '网络错误'}</div>`;
            return;
        }
        
        const data = await response.json().catch(err => {
            console.error('解析响应数据失败:', err);
            recordsContent.innerHTML = `<div class="error-message">解析数据失败: ${err.message}</div>`;
            return null;
        });
        
        if (!data) return;
        
        if (data.success) {
            const records = data.records || [];
            
            if (records.length > 0) {
                // 格式化运行时间的函数
                const formatRuntime = (minutes) => {
                    if (!minutes) return '0分钟';
                    if (minutes < 60) return `${Math.floor(minutes)}分钟`;
                    return `${Math.floor(minutes / 60)}小时 ${Math.floor(minutes % 60)}分钟`;
                };
                
                let html = `
                <div class="records-table-container">
                    <table class="table table-sm table-striped">
                        <thead>
                            <tr>
                                <th>用户名</th>
                                <th>启动时间</th>
                                <th>已运行</th>
                                <th>实例状态</th>
                                <th>谁免状态</th>
                                <th>警告状态</th>
                                <th>重启次数</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                records.forEach(record => {
                    const runtimeFormatted = formatRuntime(record.runtime_minutes);
                    const isExempt = record.is_exempt === 1;
                    const warningSent = record.warning_sent === 1;
                    
                    html += `
                    <tr class="${isExempt ? 'exempt-row' : record.runtime_minutes > 120 ? 'timeout-row' : ''}">
                        <td>${record.username || '-'}</td>
                        <td>${formatDate(record.start_time || '')}</td>
                        <td>${runtimeFormatted}</td>
                        <td>${record.status || '-'}</td>
                        <td>
                            <span class="${isExempt ? 'status-badge exempt-badge' : 'status-badge normal-badge'}">
                                ${isExempt ? '已谁免' : '正常'}
                            </span>
                        </td>
                        <td>
                            <span class="${warningSent ? 'status-badge warning-badge' : 'status-badge normal-badge'}">
                                ${warningSent ? '已发送' : '未警告'}
                            </span>
                        </td>
                        <td>${record.restart_count || 0}</td>
                    </tr>
                    `;
                });
                
                html += `
                        </tbody>
                    </table>
                </div>
                
                <div class="actions-container" style="margin-top: 15px;">
                    <button onclick="forceCheckTimeout()" class="btn btn-warning">立即检查超时</button>
                </div>
                `;
                
                recordsContent.innerHTML = html;
            } else {
                recordsContent.innerHTML = `
                <div class="no-records">
                    <p>当前没有实例启动时间记录。</p>
                </div>
                `;
            }
            
            // 添加颜色样式
            const style = document.createElement('style');
            style.textContent = `
                .exempt-row {
                    background-color: #d4edda !important;
                }
                .timeout-row {
                    background-color: #f8d7da !important;
                }
                .exempt-badge {
                    background-color: #28a745;
                    color: white;
                }
                .warning-badge {
                    background-color: #ffc107;
                    color: #212529;
                }
                .normal-badge {
                    background-color: #e2e3e5;
                    color: #212529;
                }
            `;
            document.head.appendChild(style);
            
        } else {
            recordsContent.innerHTML = `<div class="error-message">加载失败: ${data.error || '未知错误'}</div>`;
        }
    } catch (error) {
        console.error('加载实例记录错误:', error);
        const recordsContent = document.getElementById('instanceRecordsContent');
        if (recordsContent) {
            recordsContent.innerHTML = `<div class="error-message">加载失败: ${error.message}</div>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('运行时长限制脚本已加载');
    
    // 检查配置区域是否存在
    const configSection = document.getElementById('runtimeLimitConfig');
    if (configSection) {
        // 没有从admin.js中调用时自动加载
        if (configSection.querySelector('.loading-indicator')) {
            console.log('自动加载运行时长限制配置...');
            setTimeout(loadRuntimeLimitConfig, 100); // 稍微延迟加载以确保页面已完全加载
        }
    }
});
