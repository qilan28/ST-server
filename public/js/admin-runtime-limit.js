/**
 * SillyTavern运行时长限制管理
 * 管理员可以设置实例的最大运行时长，超时自动停止
 */

const API_BASE = '/api';

// 加载运行时长限制配置
async function loadRuntimeLimitConfig() {
    try {
        // 显示加载状态
        const configSection = document.getElementById('runtimeLimitConfig');
        if (configSection) {
            configSection.innerHTML = '<div class="loading-indicator">加载中...</div>';
        }

        const response = await apiRequest(`${API_BASE}/runtime-limit/config`);
        if (!response) return;

        const data = await response.json();

        if (data.success && data.config) {
            // 渲染表单
            const config = data.config;
            renderRuntimeLimitForm(config);
        } else {
            showMessage('加载配置失败', 'error');
            console.error('加载运行时长限制配置失败:', data.error || '未知错误');
        }
    } catch (error) {
        console.error('加载运行时长限制配置错误:', error);
        showMessage('加载配置失败: ' + error.message, 'error');
    }
}

// 渲染运行时长限制表单
function renderRuntimeLimitForm(config) {
    const configSection = document.getElementById('runtimeLimitConfig');
    if (!configSection) return;

    configSection.innerHTML = `
    <div class="config-form">
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
        
        <div class="form-actions">
            <button onclick="saveRuntimeLimitConfig()" class="btn btn-primary">保存设置</button>
            <button onclick="loadRuntimeLimitStatus()" class="btn btn-secondary">查看当前状态</button>
        </div>
        
        <div id="runtimeLimitMessage" class="message" style="display: none;"></div>
    </div>
    
    <div id="runtimeLimitStatus" style="display: none; margin-top: 20px;">
        <h4>当前运行实例状态</h4>
        <div id="runtimeLimitStatusContent"></div>
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
        
        const response = await apiRequest(`${API_BASE}/runtime-limit/config`, {
            method: 'PUT',
            body: JSON.stringify({
                enabled,
                maxRuntimeMinutes,
                warningMinutes,
                checkIntervalSeconds
            })
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (data.success) {
            showRuntimeLimitMessage('配置已保存', 'success');
            
            // 如果启用了限制，提示用户关于实例的可能影响
            if (enabled) {
                showMessage(
                    `运行时长限制已启用！所有实例在运行超过 ${maxRuntimeMinutes} 分钟后将自动停止。`, 
                    'warning'
                );
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
        
        const response = await apiRequest(`${API_BASE}/runtime-limit/status`);
        if (!response) {
            statusContent.innerHTML = '<div class="error-message">加载失败</div>';
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            const { config, timeoutInstances, warningInstances } = data;
            
            // 创建状态概览
            let html = `
            <div class="status-overview">
                <div class="status-item">
                    <div class="status-label">功能状态</div>
                    <div class="status-value">
                        <span class="status-badge ${config.enabled ? 'status-running' : 'status-stopped'}">
                            ${config.enabled ? '已启用' : '已禁用'}
                        </span>
                    </div>
                </div>
                <div class="status-item">
                    <div class="status-label">最大运行时长</div>
                    <div class="status-value">${config.max_runtime_minutes} 分钟</div>
                </div>
                <div class="status-item">
                    <div class="status-label">超时实例数</div>
                    <div class="status-value">
                        <span class="${timeoutInstances.length > 0 ? 'warning-text' : ''}">
                            ${timeoutInstances.length}
                        </span>
                    </div>
                </div>
                <div class="status-item">
                    <div class="status-label">即将超时实例</div>
                    <div class="status-value">
                        <span class="${warningInstances.length > 0 ? 'notice-text' : ''}">
                            ${warningInstances.length}
                        </span>
                    </div>
                </div>
            </div>
            `;
            
            // 添加实例列表（如果有的话）
            if (timeoutInstances.length > 0 || warningInstances.length > 0) {
                html += '<h5 class="mt-4">实例详情</h5>';
                
                if (timeoutInstances.length > 0) {
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
                    
                    timeoutInstances.forEach(instance => {
                        html += `
                        <tr>
                            <td>${instance.username}</td>
                            <td>${formatDate(instance.start_time)}</td>
                            <td>${Math.floor(instance.runtime_minutes)} 分钟</td>
                            <td>
                                <button onclick="stopUserInstance('${instance.username}')" class="btn-action btn-stop" title="停止">⏸️</button>
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
                
                if (warningInstances.length > 0) {
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
                    
                    warningInstances.forEach(instance => {
                        const remainingMinutes = Math.floor(config.max_runtime_minutes - instance.runtime_minutes);
                        
                        html += `
                        <tr>
                            <td>${instance.username}</td>
                            <td>${formatDate(instance.start_time)}</td>
                            <td>${Math.floor(instance.runtime_minutes)} 分钟</td>
                            <td>${remainingMinutes} 分钟</td>
                            <td>
                                <button onclick="stopUserInstance('${instance.username}')" class="btn-action btn-stop" title="停止">⏸️</button>
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
    if (!messageEl) return;
    
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
