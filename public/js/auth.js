const API_BASE = '/api';

// 加载登录页公告
async function loadLoginAnnouncements() {
    try {
        const response = await fetch(`${API_BASE}/announcements/login`);
        if (!response.ok) return;
        
        const data = await response.json();
        const announcements = data.announcements;
        
        if (announcements && announcements.length > 0) {
            const announcement = announcements[0]; // 显示第一个
            document.getElementById('announcementTitle').textContent = announcement.title;
            document.getElementById('announcementContent').textContent = announcement.content;
            
            const date = new Date(announcement.created_at);
            document.getElementById('announcementDate').textContent = `发布于 ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            
            document.getElementById('announcementContainer').style.display = 'block';
        }
    } catch (error) {
        console.error('Load announcements error:', error);
    }
}

// 页面加载完成后加载公告
document.addEventListener('DOMContentLoaded', () => {
    loadLoginAnnouncements();
});

// 切换到注册表单
function switchToRegister() {
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.add('active');
    hideMessage();
}

// 切换到登录表单
function switchToLogin() {
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('loginForm').classList.add('active');
    hideMessage();
}

// 显示消息
function showMessage(text, type = 'error') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = `message show ${type}`;
}

// 隐藏消息
function hideMessage() {
    const messageEl = document.getElementById('message');
    messageEl.className = 'message';
}

// 处理登录
async function handleLogin(event) {
    event.preventDefault();
    hideMessage();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 保存token
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.user.username);
            
            showMessage('登录成功！正在跳转...', 'success');
            
            // 跳转到控制台
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);
        } else {
            showMessage(data.error || '登录失败，请重试');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('网络错误，请检查连接');
    }
}

// 处理注册
async function handleRegister(event) {
    event.preventDefault();
    hideMessage();
    
    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
    
    // 验证密码确认
    if (password !== passwordConfirm) {
        showMessage('两次输入的密码不一致');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 保存token
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.user.username);
            
            showMessage('注册成功！正在跳转...', 'success');
            
            // 跳转到控制台
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);
        } else {
            showMessage(data.error || '注册失败，请重试');
        }
    } catch (error) {
        console.error('Register error:', error);
        showMessage('网络错误，请检查连接');
    }
}

// 检查是否已登录
function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        // 如果已登录，跳转到控制台
        window.location.href = '/dashboard.html';
    }
}

// 页面加载时检查登录状态
checkAuth();
