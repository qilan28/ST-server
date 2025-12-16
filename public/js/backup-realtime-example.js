/**
 * 备份实时日志示例
 * 使用 Server-Sent Events (SSE) 接收备份进度
 */

// 执行备份并显示实时日志
async function startBackupWithLogs() {
    const logContainer = document.getElementById('backup-logs');
    const backupButton = document.getElementById('backup-button');
    
    // 清空日志
    logContainer.innerHTML = '';
    
    // 禁用按钮
    backupButton.disabled = true;
    backupButton.textContent = '备份中...';
    
    try {
        // 创建 EventSource 连接
        const eventSource = new EventSource('/api/backup/backup', {
            withCredentials: true  // 发送认证 Cookie
        });
        
        // 监听日志消息
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // 添加日志到界面
                addLog(data.message, data.type);
                
                // 检查是否完成
                if (data.type === 'done') {
                    console.log('备份成功:', data.result);
                    eventSource.close();
                    backupButton.disabled = false;
                    backupButton.textContent = '立即备份';
                    
                    // 显示成功消息
                    showNotification('备份成功！', 'success');
                } else if (data.type === 'error') {
                    console.error('备份失败:', data.error);
                    eventSource.close();
                    backupButton.disabled = false;
                    backupButton.textContent = '立即备份';
                    
                    // 显示错误消息
                    showNotification(`备份失败: ${data.error}`, 'error');
                }
            } catch (err) {
                console.error('解析日志消息失败:', err);
            }
        };
        
        // 监听错误
        eventSource.onerror = (error) => {
            console.error('SSE 连接错误:', error);
            eventSource.close();
            backupButton.disabled = false;
            backupButton.textContent = '立即备份';
            
            addLog('❌ 连接失败，请重试', 'error');
        };
        
    } catch (error) {
        console.error('启动备份失败:', error);
        backupButton.disabled = false;
        backupButton.textContent = '立即备份';
        showNotification('启动备份失败', 'error');
    }
}

// 添加日志到界面
function addLog(message, type = 'info') {
    const logContainer = document.getElementById('backup-logs');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    
    // 添加时间戳
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `
        <span class="log-time">[${timestamp}]</span>
        <span class="log-message">${escapeHtml(message)}</span>
    `;
    
    logContainer.appendChild(logEntry);
    
    // 自动滚动到底部
    logContainer.scrollTop = logContainer.scrollHeight;
}

// 转义 HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 显示通知
function showNotification(message, type = 'info') {
    // 这里可以使用你的通知系统
    alert(message);
}

// 页面加载完成后绑定事件
document.addEventListener('DOMContentLoaded', () => {
    const backupButton = document.getElementById('backup-button');
    if (backupButton) {
        backupButton.addEventListener('click', startBackupWithLogs);
    }
});
