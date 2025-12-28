// 测试站点设置功能
document.addEventListener('DOMContentLoaded', function() {
    console.log('测试脚本已加载');
    
    // 设置测试按钮
    const saveBtn = document.getElementById('saveSiteSettings');
    if (saveBtn) {
        console.log('找到保存按钮，添加测试点击事件');
        saveBtn.addEventListener('click', testSaveSettings);
    } else {
        console.error('未找到保存按钮!');
    }
});

// 测试保存站点设置
async function testSaveSettings() {
    console.log('测试保存站点设置...');
    // 测试点击事件正常工作
    
    const projectName = document.getElementById('projectName')?.value || '测试项目名';
    const siteName = document.getElementById('siteName')?.value || '测试网站名';
    
    console.log('将要发送的数据:', { 
        project_name: projectName, 
        site_name: siteName 
    });
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('错误: 未找到认证令牌，请重新登录');
            return;
        }
        
        console.log('开始发送API请求...');
        
        // 使用相对路径和当前协议
        const protocol = window.location.protocol;
        const host = window.location.host;
        const apiUrl = '/api/site-settings';
        console.log(`当前环境: 协议=${protocol}, 主机=${host}, API路径=${apiUrl}`);
        
        const response = await fetch(apiUrl, {
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
        
        console.log('收到响应:', response);
        console.log('响应状态:', response.status);
        
        const data = await response.json();
        console.log('响应数据:', data);
        
        console.log('API响应:', data);
    } catch (error) {
        console.error('测试保存设置时出错:', error);
        // 在控制台显示错误而不是弹窗
        console.error('错误消息:', error.message);
    }
}
